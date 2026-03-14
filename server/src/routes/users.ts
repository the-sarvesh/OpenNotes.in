import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get my profile
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id, email, name, upi_id, role, created_at FROM users WHERE id = ?',
      args: [req.user!.id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update my profile
router.put('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, upi_id } = req.body;
    const userId = req.user!.id;

    const updates: string[] = [];
    const args: any[] = [];

    if (name) {
      updates.push('name = ?');
      args.push(name);
    }
    if (upi_id !== undefined) {
      updates.push('upi_id = ?');
      args.push(upi_id || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    args.push(userId);
    await db.execute({
      sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      args
    });

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/me/password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user!.id;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const userRes = await db.execute({
      sql: 'SELECT password_hash FROM users WHERE id = ?',
      args: [userId]
    });

    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(current_password, user.password_hash as string);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [newHash, userId]
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
