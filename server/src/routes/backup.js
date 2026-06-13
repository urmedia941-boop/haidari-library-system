import { Router } from 'express';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { asyncHandler, badRequest, notFound } from '../utils/http.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('admin', 'manager'));

const BACKUP_NAME = /^[\w.-]+\.sql$/;

async function ensureBackupDir() {
  await mkdir(config.backupDir, { recursive: true });
  return path.resolve(config.backupDir);
}

// pg_dump / psql read connection details from PG* / the URL.
function pgEnv() {
  return { ...process.env, PGSSLMODE: process.env.PGSSLMODE || 'prefer' };
}

// Run a command via spawn (no shell) so the database URL can never be
// interpreted as shell syntax. Optionally redirect stdio to/from a file.
function run(cmd, args, { stdout, stdin } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: pgEnv() });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    if (stdout) child.stdout.pipe(createWriteStream(stdout));
    if (stdin) createReadStream(stdin).pipe(child.stdin);
    child.on('close', (code) => (
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}: ${stderr}`))
    ));
  });
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
    await run('pg_dump', ['--no-owner', '--no-privileges', config.databaseUrl], { stdout: file });
    const s = await stat(file);
    res.status(201).json({ name: path.basename(file), size: s.size, created_at: s.mtime });
  }),
);

router.post(
  '/restore',
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !BACKUP_NAME.test(name)) throw badRequest('invalid backup name');
    const dir = await ensureBackupDir();
    const file = path.join(dir, name);
    try {
      await stat(file);
    } catch {
      throw notFound('backup file not found');
    }
    await run('psql', [config.databaseUrl], { stdin: file });
    res.json({ ok: true, restored: name });
  }),
);

router.delete(
  '/:name',
  asyncHandler(async (req, res) => {
    const { name } = req.params;
    if (!BACKUP_NAME.test(name)) throw badRequest('invalid backup name');
    const dir = await ensureBackupDir();
    await unlink(path.join(dir, name)).catch(() => {});
    res.json({ ok: true });
  }),
);

export default router;
