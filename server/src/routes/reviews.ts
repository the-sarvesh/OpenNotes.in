import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// POST /api/reviews — leave a review after purchase
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const reviewerId = req.user!.id;
    const { seller_id, order_id, listing_id, rating, comment } = req.body;

    if (!seller_id || !order_id || !listing_id || !rating) {
      return res.status(400).json({ error: 'seller_id, order_id, listing_id, and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (reviewerId === seller_id) {
      return res.status(400).json({ error: 'Cannot review yourself' });
    }

    // Verify the reviewer actually purchased from this order AND it's completed
    const orderCheck = await db.execute({
      sql: 'SELECT id, status FROM orders WHERE id = ? AND buyer_id = ?',
      args: [order_id, reviewerId]
    });
    if (orderCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You can only review orders you placed' });
    }
    if (orderCheck.rows[0].status !== 'completed') {
      return res.status(400).json({ error: 'You can only leave a review once the order is fully completed' });
    }

    // Check for duplicate review
    const existing = await db.execute({
      sql: 'SELECT id FROM reviews WHERE reviewer_id = ? AND order_id = ? AND listing_id = ?',
      args: [reviewerId, order_id, listing_id]
    });
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this item' });
    }

    const reviewId = uuidv4();
    await db.execute({
      sql: 'INSERT INTO reviews (id, reviewer_id, seller_id, order_id, listing_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [reviewId, reviewerId, seller_id, order_id, listing_id, rating, comment || null]
    });

    res.status(201).json({ message: 'Review submitted', id: reviewId });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reviews/seller/:sellerId — get all reviews for a seller
router.get('/seller/:sellerId', async (req, res) => {
  try {
    const reviews = await db.execute({
      sql: `
        SELECT r.*, u.name as reviewer_name, l.title as listing_title
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.id
        JOIN listings l ON r.listing_id = l.id
        WHERE r.seller_id = ?
        ORDER BY r.created_at DESC
      `,
      args: [req.params.sellerId]
    });

    // Calculate average rating
    const avgResult = await db.execute({
      sql: 'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE seller_id = ?',
      args: [req.params.sellerId]
    });

    res.json({
      reviews: reviews.rows,
      averageRating: Number(avgResult.rows[0]?.avg_rating || 0).toFixed(1),
      totalReviews: Number(avgResult.rows[0]?.count || 0)
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reviews/my-reviews — reviews I've written
router.get('/my-reviews', authenticate, async (req: AuthRequest, res) => {
  try {
    const reviews = await db.execute({
      sql: `
        SELECT r.*, u.name as seller_name, l.title as listing_title
        FROM reviews r
        JOIN users u ON r.seller_id = u.id
        JOIN listings l ON r.listing_id = l.id
        WHERE r.reviewer_id = ?
        ORDER BY r.created_at DESC
      `,
      args: [req.user!.id]
    });
    res.json(reviews.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
