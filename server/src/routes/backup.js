import { Router } from 'express';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const execAsync = promisify(exec);
const router = Router();
router.use(authenticate, requireRole('admin', 'manager'));

async function ensureBackupDir() {
  await mkdir(config.backupDir, { recursive: true });
  return path.resolve(config.backupDir);
}

// pg_dump / pg_restore read connection details from PG* / the URL.
function pgEnv() {
  return { ...process.env, PGSSLMODE: process.env.PGSSLMODE || 'prefer' };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const dir = await ensureBackupDir();
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql'));
    const items = await Promise.all(
      files.map(async (name) => {
        const s = await stat(path.join(dir, name));
        return { name, size: s.size, created_at: s.mtime };
      }),
    );
    items.sort((a, b) => b.created_at - a.created_at);
    res.json(items);
  }),
);

router.post(
  '/',
  asyncHandler(async (_req, res) => {
    const dir = await ensureBackupDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `backup-${stamp}.sql`);
    await execAsync(`pg_dump --no-owner --no-privileges "${config.databaseUrl}" > "${file}"`, {
      env: pgEnv(),
      maxBuffer: 1024 * 1024 * 256,
    });
    const s = await stat(file);
    res.status(201).json({ name: path.basename(file), size: s.size, created_at: s.mtime });
  }),
);

router.post(
  '/restore',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || name.includes('/') || name.includes('..')) throw badRequest('invalid backup name');
    const dir = await ensureBackupDir();
    const file = path.join(dir, name);
    try {
      await stat(file);
    } catch {
      throw notFound('backup file not found');
    }
    await execAsync(`psql "${config.databaseUrl}" < "${file}"`, {
      env: pgEnv(),
      maxBuffer: 1024 * 1024 * 256,
    });
    res.json({ ok: true, restored: name });
  }),
);

router.delete(
  '/:name',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    if (name.includes('/') || name.includes('..')) throw badRequest('invalid backup name');
    const dir = await ensureBackupDir();
    await unlink(path.join(dir, name)).catch(() => {});
    res.json({ ok: true });
  }),
);

export default router;
