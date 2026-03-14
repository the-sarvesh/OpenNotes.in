import db from "./database.js";
import { v4 as uuidv4 } from "uuid";

const migrateMultipleImages = async () => {
  try {
    console.log("🚀 Starting multiple images migration...");

    // 1. Create the listing_images table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS listing_images (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL,
        url TEXT NOT NULL,
        is_main BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
      );
    `);
    console.log("✅ Created listing_images table.");

    // 2. Migrate existing image_url from listings to listing_images
    const listings = await db.execute("SELECT id, image_url FROM listings");
    console.log(`📦 Found ${listings.rows.length} listings to migrate.`);

    for (const listing of listings.rows) {
      const listingId = listing.id as string;
      const imageUrl = listing.image_url as string;

      if (!imageUrl) continue;

      // Check if this listing already has images in the new table
      const existing = await db.execute({
        sql: "SELECT id FROM listing_images WHERE listing_id = ? AND url = ?",
        args: [listingId, imageUrl]
      });

      if (existing.rows.length === 0) {
        await db.execute({
          sql: "INSERT INTO listing_images (id, listing_id, url, is_main) VALUES (?, ?, ?, ?)",
          args: [uuidv4(), listingId, imageUrl, 1]
        });
      }
    }

    console.log("✅ Successfully migrated existing images.");
    console.log("✨ Migration completed.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
};

migrateMultipleImages();
