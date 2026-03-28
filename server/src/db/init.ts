import db from "./database.js";

const initDb = async () => {
  try {
    console.log("Initializing database tables...");

    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT,
        upi_id TEXT,
        mobile_number TEXT,
        location TEXT,
        profile_image_url TEXT,
        google_id TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        is_verified INTEGER NOT NULL DEFAULT 0,
        verification_token TEXT,
        verification_token_expires_at DATETIME,
        last_seen_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS listings (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        title TEXT NOT NULL,
        course_code TEXT NOT NULL,
        semester TEXT NOT NULL,
        condition TEXT NOT NULL,
        price INTEGER NOT NULL,
        location TEXT NOT NULL,
        image_url TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        material_type TEXT NOT NULL,
        is_multiple_subjects BOOLEAN NOT NULL DEFAULT 0,
        delivery_method TEXT NOT NULL DEFAULT 'in_person',
        preferred_meetup_spot TEXT,
        meetup_location TEXT,
        views INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS listing_subjects (
        listing_id TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
        PRIMARY KEY (listing_id, subject_name)
      );

      CREATE TABLE IF NOT EXISTS listing_images (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL,
        url TEXT NOT NULL,
        is_main BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        buyer_id TEXT NOT NULL,
        total_amount INTEGER NOT NULL,
        platform_fee INTEGER NOT NULL,
        platform_fee_waived INTEGER NOT NULL DEFAULT 0,
        coupon_code TEXT,
        status TEXT NOT NULL DEFAULT 'pending_payment',
        delivery_details TEXT,
        collection_date TEXT,
        meetup_pin TEXT,
        platform_fee_paid BOOLEAN NOT NULL DEFAULT 0,
        buyer_location TEXT,
        buyer_preferred_spot TEXT,
        buyer_availability TEXT,
        buyer_note TEXT,
        buyer_meetup_details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price_at_purchase INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_meetup',
        meetup_pin TEXT,
        meetup_signal_count INTEGER NOT NULL DEFAULT 0,
        last_meetup_signal_at DATETIME,
        pin_attempts INTEGER NOT NULL DEFAULT 0,
        last_pin_attempt_at DATETIME,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (listing_id) REFERENCES listings(id),
        FOREIGN KEY (seller_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        listing_id TEXT,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        metadata TEXT,
        is_read BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id),
        FOREIGN KEY (listing_id) REFERENCES listings(id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        reviewer_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reviewer_id) REFERENCES users(id),
        FOREIGN KEY (seller_id) REFERENCES users(id),
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (listing_id) REFERENCES listings(id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        is_read BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS coupon_codes (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        discount_type TEXT NOT NULL DEFAULT 'percentage',
        discount_value INTEGER NOT NULL DEFAULT 100,
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT OR IGNORE INTO settings (key, value) VALUES ('platform_fee_percentage', '0');

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS meetup_proposals (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        listing_id TEXT NOT NULL,
        proposed_time DATETIME NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reminder_sent BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id),
        FOREIGN KEY (listing_id) REFERENCES listings(id)
      );

      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        uploader_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL,
        semester TEXT NOT NULL,
        category TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        course_code TEXT,
        download_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploader_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS subject_drive_links (
        semester TEXT NOT NULL,
        subject_name TEXT NOT NULL,
        drive_link TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (semester, subject_name)
      );
    `);

    console.log("Core tables created or verified.");

    // Run migrations for existing databases
    console.log("Starting migrations...");
    const migrations = [
      "ALTER TABLE listings ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'in_person'",
      "ALTER TABLE listings ADD COLUMN meetup_location TEXT",
      "ALTER TABLE listings ADD COLUMN preferred_meetup_spot TEXT",
      "ALTER TABLE listings ADD COLUMN views INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
      "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
      "ALTER TABLE users ADD COLUMN mobile_number TEXT",
      "ALTER TABLE users ADD COLUMN location TEXT",
      "ALTER TABLE users ADD COLUMN profile_image_url TEXT",
      "ALTER TABLE users ADD COLUMN google_id TEXT",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL",
      "ALTER TABLE messages ADD COLUMN conversation_id TEXT",
      "ALTER TABLE reviews ADD COLUMN order_id TEXT",
      "ALTER TABLE orders ADD COLUMN delivery_details TEXT",
      "ALTER TABLE orders ADD COLUMN collection_date TEXT",
      "ALTER TABLE orders ADD COLUMN meetup_pin TEXT",
      "ALTER TABLE orders ADD COLUMN platform_fee_paid BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN buyer_location TEXT",
      "ALTER TABLE orders ADD COLUMN buyer_preferred_spot TEXT",
      "ALTER TABLE orders ADD COLUMN buyer_availability TEXT",
      "ALTER TABLE orders ADD COLUMN buyer_note TEXT",
      "ALTER TABLE orders ADD COLUMN buyer_meetup_details TEXT",
      "ALTER TABLE order_items ADD COLUMN meetup_pin TEXT",
      "ALTER TABLE order_items ADD COLUMN meetup_signal_count INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE order_items ADD COLUMN last_meetup_signal_at DATETIME",
      // ── Coupon / fee-waiver migrations ────────────────────────────────────
      "ALTER TABLE orders ADD COLUMN platform_fee_waived INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN coupon_code TEXT",

      // ── Performance indexes (BE-9) ─────────────────────────────────────────
      "CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings(seller_id)",
      "CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)",
      "CREATE INDEX IF NOT EXISTS idx_listings_semester ON listings(semester)",
      "CREATE INDEX IF NOT EXISTS idx_listings_material_type ON listings(material_type)",
      "CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id)",
      "CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)",
      "CREATE INDEX IF NOT EXISTS idx_order_items_listing_id ON order_items(listing_id)",
      "CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id)",
      "CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)",
      "CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)",
      "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id)",
      "CREATE INDEX IF NOT EXISTS idx_coupon_codes_code ON coupon_codes(code)",
      "CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token)",
      "CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_duplicate_prevent ON reviews(reviewer_id, order_id, listing_id)",
      "CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id)",
      "ALTER TABLE messages ADD COLUMN type TEXT NOT NULL DEFAULT 'text'",
      "ALTER TABLE messages ADD COLUMN metadata TEXT",
      "ALTER TABLE meetup_proposals ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT 0",
      "ALTER TABLE listings ADD COLUMN description TEXT",
      "ALTER TABLE users ADD COLUMN rating_avg REAL DEFAULT 0",
      "ALTER TABLE users ADD COLUMN rating_count INTEGER DEFAULT 0",
      "CREATE INDEX IF NOT EXISTS idx_messages_unread_composite ON messages(receiver_id, is_read)",
      "CREATE INDEX IF NOT EXISTS idx_notifications_unread_composite ON notifications(user_id, is_read)",
      "CREATE INDEX IF NOT EXISTS idx_meetup_reminders_composite ON meetup_proposals(reminder_sent, proposed_time)",
      "CREATE INDEX IF NOT EXISTS idx_listing_subjects_name ON listing_subjects(subject_name)",
      "CREATE INDEX IF NOT EXISTS idx_resources_semester ON resources(semester)",
      "CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category)",
      "ALTER TABLE users ADD COLUMN monthly_upload_limit INTEGER DEFAULT 10",
      "CREATE TABLE IF NOT EXISTS resource_downloads (user_id TEXT NOT NULL, resource_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, resource_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE)",
      "CREATE INDEX IF NOT EXISTS idx_res_downloads_res_id ON resource_downloads(resource_id)",
      "ALTER TABLE users ADD COLUMN telegram_chat_id TEXT",
      "ALTER TABLE users ADD COLUMN telegram_link_token TEXT",
      "CREATE INDEX IF NOT EXISTS idx_users_telegram_token ON users(telegram_link_token)",
      "ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE users ADD COLUMN verification_token TEXT",
      "ALTER TABLE users ADD COLUMN verification_token_expires_at DATETIME",
      "ALTER TABLE order_items ADD COLUMN pin_attempts INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE order_items ADD COLUMN last_pin_attempt_at DATETIME",
      // ── Orders Migration: total_amount & platform_fee (BE-9.1) ─────────────
      "ALTER TABLE orders ADD COLUMN total_amount REAL NOT NULL DEFAULT 0",
      "ALTER TABLE orders ADD COLUMN platform_fee REAL NOT NULL DEFAULT 0",
      "UPDATE orders SET total_amount = COALESCE((SELECT SUM(price_at_purchase * quantity) FROM order_items WHERE order_items.order_id = orders.id), 0)",
      "UPDATE orders SET platform_fee = COALESCE((SELECT SUM(platform_fee) FROM order_items WHERE order_items.order_id = orders.id), 0)",
      "CREATE TABLE IF NOT EXISTS subject_drive_links (semester TEXT NOT NULL, subject_name TEXT NOT NULL, drive_link TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (semester, subject_name))",
    ];

    for (const migration of migrations) {
      try {
        await db.execute(migration);
        console.log(`Migration applied: ${migration.substring(0, 60)}...`);
      } catch (err: any) {
        if (
          err.message?.includes("duplicate column") ||
          err.message?.includes("already exists") ||
          err.message?.includes("already has")
        ) {
          // Already applied — ignore silently
        } else {
          console.log(
            `Migration skipped: ${migration.substring(0, 60)} — ${err.message}`,
          );
        }
      }
    }

    // ── Special Migration: Backfill listing_images ──────────────────────────
    try {
      const listings = await db.execute("SELECT id, image_url FROM listings");
      for (const listing of listings.rows) {
        const lid = String(listing.id);
        const url = String(listing.image_url);
        if (!url) continue;

        const existing = await db.execute({
          sql: "SELECT id FROM listing_images WHERE listing_id = ? AND url = ?",
          args: [lid, url]
        });

        if (existing.rows.length === 0) {
          await db.execute({
            sql: "INSERT INTO listing_images (id, listing_id, url, is_main) VALUES (?, ?, ?, 1)",
            args: [crypto.randomUUID ? crypto.randomUUID() : `img-${Date.now()}-${Math.random()}`, lid, url]
          });
        }
      }
      console.log("Listing images backfill checked.");
    } catch (err: any) {
      console.warn("Listing images backfill skipped/failed:", err.message);
    }

    // ── Special Migration: Backfill Ratings ─────────────────────────────────
    try {
      await db.execute(`
        UPDATE users 
        SET 
          rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE reviews.seller_id = users.id),
          rating_count = (SELECT COUNT(*) FROM reviews WHERE reviews.seller_id = users.id)
        WHERE id IN (SELECT DISTINCT seller_id FROM reviews)
      `);
      console.log("Ratings backfill applied.");
    } catch (err: any) {
      console.warn("Ratings backfill skipped/failed:", err.message);
    }

    // Special migration: Convert password_hash to nullable (requires table recreation in SQLite)
    try {
      const usersTableInfo = await db.execute("PRAGMA table_info(users)");
      const passwordHashCol = (usersTableInfo.rows as any[]).find(
        (row) => row.name === "password_hash",
      );

      if (passwordHashCol && passwordHashCol.notnull === 1) {
        console.log("Migrating users table to allow null password_hash...");
        await db.execute("PRAGMA foreign_keys = OFF");
        await db.execute("DROP TABLE IF EXISTS users_new");
        await db.executeMultiple(`
          CREATE TABLE users_new (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT,
            upi_id TEXT,
            google_id TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            is_verified INTEGER NOT NULL DEFAULT 0,
            verification_token TEXT,
            verification_token_expires_at DATETIME,
            rating_avg REAL DEFAULT 0,
            rating_count INTEGER DEFAULT 0,
            monthly_upload_limit INTEGER DEFAULT 10,
            telegram_chat_id TEXT,
            telegram_link_token TEXT,
            last_seen_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO users_new (id, email, name, password_hash, upi_id, google_id, role, status, is_verified, verification_token, verification_token_expires_at, rating_avg, rating_count, monthly_upload_limit, telegram_chat_id, telegram_link_token, last_seen_at, created_at)
          SELECT id, email, name, password_hash, upi_id, google_id, role, status, is_verified, verification_token, verification_token_expires_at,
                 COALESCE(rating_avg, 0), COALESCE(rating_count, 0), COALESCE(monthly_upload_limit, 10),
                 telegram_chat_id, telegram_link_token, NULL, created_at FROM users;
          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_users_telegram_token ON users(telegram_link_token) WHERE telegram_link_token IS NOT NULL;
        `);
        await db.execute("PRAGMA foreign_keys = ON");
        console.log("Users table migration completed successfully.");
      }
    } catch (err: any) {
      console.error("Failed to migrate users table schema:", err.message);
    }

    // Seed a default FREE100 coupon if none exist yet
    try {
      const existing = await db.execute(
        "SELECT id FROM coupon_codes WHERE code = 'FREE100'",
      );
      if (existing.rows.length === 0) {
        await db.execute({
          sql: `INSERT INTO coupon_codes (id, code, description, discount_type, discount_value, max_uses, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            "default-free100",
            "FREE100",
            "Free platform fee — launch promo (admin seeded)",
            "percentage",
            100,
            null, // unlimited uses
            1,
          ],
        });
        console.log("[Seed] Default coupon FREE100 created.");
      }
    } catch (err: any) {
      console.warn("[Seed] Could not seed default coupon:", err.message);
    }

    console.log("Database tables initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
};

initDb();
