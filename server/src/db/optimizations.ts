import db from "./database.js";

/**
 * DB Optimization Migration
 * 
 * This script applies high-impact performance optimizations:
 * 1. Composite indices for unread message/notification counts.
 * 2. Denormalized seller ratings in the users table.
 * 3. Composite index for meetup reminders.
 * 4. Search index for subjects.
 */
const applyOptimizations = async () => {
  console.log("🚀 Starting database optimizations...");

  const steps = [
    // ── 1. Composite Indices for Unread Counts ──────────────────────────
    // Makes "SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND is_read = 0" instant
    "CREATE INDEX IF NOT EXISTS idx_messages_unread_composite ON messages(receiver_id, is_read)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_unread_composite ON notifications(user_id, is_read)",

    // ── 2. Meetup Reminders ─────────────────────────────────────────────
    // Speeds up background worker looking for upcoming accepted meetups
    "CREATE INDEX IF NOT EXISTS idx_meetup_reminders_composite ON meetup_proposals(reminder_sent, proposed_time)",

    // ── 3. Subject Search ───────────────────────────────────────────────
    // Speeds up filtering listings by subject name
    "CREATE INDEX IF NOT EXISTS idx_listing_subjects_name ON listing_subjects(subject_name)",

    // ── 4. Denormalized Seller Ratings ──────────────────────────────────
    // First, add the columns if they don't exist
    "ALTER TABLE users ADD COLUMN rating_avg REAL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN rating_count INTEGER DEFAULT 0",
  ];

  for (const sql of steps) {
    try {
      await db.execute(sql);
      console.log(`✅ Success: ${sql.substring(0, 50)}...`);
    } catch (err: any) {
      if (err.message?.includes("duplicate column") || err.message?.includes("already exists")) {
        console.log(`ℹ️  Skipped (Already exists): ${sql.substring(0, 50)}...`);
      } else {
        console.error(`❌ Error executing "${sql}":`, err.message);
      }
    }
  }

  // ── 5. Backfill Denormalized Ratings ────────────────────────────────
  console.log("📊 Backfilling seller ratings...");
  try {
    // This query calculates averages for all sellers and updates the users table in one go
    const backfillSql = `
      UPDATE users 
      SET 
        rating_avg = (
          SELECT COALESCE(AVG(rating), 0) 
          FROM reviews 
          WHERE reviews.seller_id = users.id
        ),
        rating_count = (
          SELECT COUNT(*) 
          FROM reviews 
          WHERE reviews.seller_id = users.id
        )
      WHERE id IN (SELECT DISTINCT seller_id FROM reviews)
    `;
    await db.execute(backfillSql);
    console.log("✅ Ratings backfill completed.");
  } catch (err: any) {
    console.error("❌ Failed to backfill ratings:", err.message);
  }

  console.log("✨ Optimizations completed.");
};

// Execute if called directly
applyOptimizations().catch(err => {
  console.error("Critical failure during optimizations:", err);
  process.exit(1);
});

export default applyOptimizations;
