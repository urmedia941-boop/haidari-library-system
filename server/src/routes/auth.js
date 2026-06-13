import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { asyncHandler, badRequest, unauthorized } from '../utils/http.js';
import { authenticate, requireRole, signToken } from '../middleware/auth.js';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) throw badRequest('username and password are required');
    const { rows } = await query(
      'SELECT * FROM users WHERE username = $1 AND is_active = TRUE',
      [username],
    );
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw unauthorized('Invalid credentials');
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    });
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      'SELECT id, username, full_name, role FROM users WHERE id = $1',
      [req.user.id],
    );
    res.json(rows[0] || null);
  }),
);

// ----- user management (admin only) -----
router.get(
  '/users',
  authenticate,
  requireRole('admin', 'manager'),
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id',
    );
    res.json(rows);
  }),
);

router.post(
  '/users',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name) {
      throw badRequest('username, password and full_name are required');
    }
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, COALESCE($4, 'cashier'))
       RETURNING id, username, full_name, role, is_active, created_at`,
      [username, hash, full_name, role],
    );
    res.status(201).json(rows[0]);
  }),
);

router.patch(
  '/users/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { full_name, role, is_active, password } = req.body;
    const hash = password ? bcrypt.hashSync(password, 10) : null;
    const { rows } = await query(
      `UPDATE users SET
         full_name = COALESCE($2, full_name),
         role = COALESCE($3, role),
         is_active = COALESCE($4, is_active),
         password_hash = COALESCE($5, password_hash)
       WHERE id = $1
       RETURNING id, username, full_name, role, is_active, created_at`,
      [req.params.id, full_name, role, is_active, hash],
    );
    res.json(rows[0]);
  }),
);

export default router;
