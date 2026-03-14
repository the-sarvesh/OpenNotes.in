import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for local file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Correctly point to the shared uploads folder at the root
    cb(null, path.resolve(__dirname, "../../../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      "profile-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max for profile pics
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

// Get my profile
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT id, email, name, upi_id, role, mobile_number, location, profile_image_url, created_at FROM users WHERE id = ?',
      args: [req.user!.id]
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update my profile
router.put('/me', authenticate, upload.single('profile_image') as any, async (req: AuthRequest, res, next) => {
  try {
    const { name, upi_id, mobile_number, location } = req.body;
    const userId = req.user!.id;

    const updates: string[] = [];
    const args: any[] = [];

    if (name) {
      if (name.length < 2 || name.length > 50) {
        return res.status(400).json({ error: 'Name must be between 2 and 50 characters' });
      }
      updates.push('name = ?');
      args.push(name);
    }
    
    if (upi_id !== undefined) {
      updates.push('upi_id = ?');
      args.push(upi_id || null);
    }

    if (mobile_number !== undefined) {
      updates.push('mobile_number = ?');
      args.push(mobile_number || null);
    }

    if (location !== undefined) {
      updates.push('location = ?');
      args.push(location || null);
    }

    if (req.file) {
      const imageUrl = `/uploads/${req.file.filename}`;
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
    next(error);
  }
});

export default router;
