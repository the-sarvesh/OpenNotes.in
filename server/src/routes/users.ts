import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

import { imageUpload, getFileUrl } from "../utils/cloudinary.js";

// Get my profile
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id, email, name, upi_id, role, mobile_number, location, profile_image_url, monthly_upload_limit, created_at, password_hash, telegram_chat_id FROM users WHERE id = ?',
      args: [req.user!.id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const userResponse = { ...user };
    (userResponse as any).has_password = !!user.password_hash;
    delete (userResponse as any).password_hash;

    res.json(userResponse);

  } catch (error) {
    next(error);
  }
});

// Get unread counts (messages + notifications)
router.get('/me/unread-counts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const [msgResult, notifResult] = await Promise.all([
      db.execute({
        sql: 'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0',
        args: [userId]
      }),
      db.execute({
        sql: 'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        args: [userId]
      })
    ]);

    res.json({
      messages: Number(msgResult.rows[0]?.count || 0),
      notifications: Number(notifResult.rows[0]?.count || 0)
    });
  } catch (error) {
    next(error);
  }
});

// Update my profile
router.put('/me', authenticate, imageUpload.single('profile_image') as any, async (req: AuthRequest, res, next) => {
  try {
    const { name, upi_id, mobile_number, location } = req.body;
    const userId = req.user!.id;

    const updates: string[] = [];
    const args: any[] = [];

    if (name !== undefined) {
      const cleanName = String(name).trim().replace(/\s+/g, ' ');
      if (cleanName.length < 2 || cleanName.length > 80) {
        return res.status(400).json({ error: 'Name must be between 2 and 80 characters' });
      }
      updates.push('name = ?');
      args.push(cleanName);
    }
    
    if (upi_id !== undefined) {
      const cleanUpiId = String(upi_id || '').trim().toLowerCase();
      if (cleanUpiId && (cleanUpiId.length > 100 || !/^[a-z0-9._-]{2,64}@[a-z0-9.-]{2,64}$/i.test(cleanUpiId))) {
        return res.status(400).json({ error: 'Please enter a valid UPI ID' });
      }
      updates.push('upi_id = ?');
      args.push(cleanUpiId || null);
    }

    if (mobile_number !== undefined) {
      const cleanMobile = String(mobile_number || '').replace(/[\s()-]/g, '');
      const localMobile = cleanMobile.startsWith('+91') ? cleanMobile.slice(3) : cleanMobile;
      if (localMobile && !/^[6-9]\d{9}$/.test(localMobile)) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number' });
      }
      updates.push('mobile_number = ?');
      args.push(localMobile || null);
    }

    if (location !== undefined) {
      const cleanLocation = String(location || '').trim().replace(/\s+/g, ' ');
      if (cleanLocation.length > 120) {
        return res.status(400).json({ error: 'Location must be 120 characters or fewer' });
      }
      updates.push('location = ?');
      args.push(cleanLocation || null);
    }

    if (req.file) {
      const imageUrl = getFileUrl(req.file);
      updates.push('profile_image_url = ?');
      args.push(imageUrl);
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
    next(error);
  }
});

// Get public profile (with privacy logic)
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const targetUserId = req.params.id;
    const requesterId = req.user!.id;
    const requesterRole = req.user!.role;

    const result = await db.execute({
      sql: 'SELECT id, email, name, role, mobile_number, location, profile_image_url, created_at FROM users WHERE id = ?',
      args: [targetUserId]
    });

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if requester is Admin
    if (requesterRole === 'admin' || requesterId === targetUserId) {
      return res.json(user);
    }

    // Check if there is ANY transaction between these two users (Requester and Target)
    const purchaseCheck = await db.execute({
      sql: `SELECT o.id FROM orders o 
            JOIN order_items oi ON o.id = oi.order_id
            WHERE (o.buyer_id = ? AND oi.seller_id = ?) 
               OR (o.buyer_id = ? AND oi.seller_id = ?) 
            LIMIT 1`,
      args: [requesterId, targetUserId, targetUserId, requesterId]
    });

    const isBuyer = purchaseCheck.rows.length > 0;

    // Redact sensitive info if not authorized
    if (!isBuyer) {
      delete (user as any).mobile_number;
      delete (user as any).location;
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Change password
router.put('/me/password', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user!.id;

    if (typeof new_password !== 'string' || !new_password) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (new_password.length < 6 || new_password.length > 128) {
      return res.status(400).json({ error: 'New password must be between 6 and 128 characters' });
    }

    const userRes = await db.execute({
      sql: 'SELECT password_hash FROM users WHERE id = ?',
      args: [userId]
    });

    const user = userRes.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user already has a password, verify the current one
    if (user.password_hash) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      const isValid = await bcrypt.compare(current_password, user.password_hash as string);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }
    // If no password_hash, user is social-only and is setting their first password


    const newHash = await bcrypt.hash(new_password, 10);
    await db.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [newHash, userId]
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
