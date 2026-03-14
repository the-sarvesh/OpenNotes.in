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
        status TEXT NOT NULL DEFAULT 'active',
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
        buyer_availability TEXT,
        buyer_note TEXT,
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
      "ALTER TABLE orders ADD COLUMN buyer_availability TEXT",
      "ALTER TABLE orders ADD COLUMN buyer_note TEXT",
      "ALTER TABLE order_items ADD COLUMN meetup_pin TEXT",
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
    ];

    for (const migration of migrations) {
      try {
        await db.execute(migration);
        console.log(`Migration applied: ${migration.substring(0, 60)}...`);
      } catch (err: any) {
        if (
          err.message?.includes("duplicate column") ||
          err.message?.includes("already exists")
        ) {
          // Already applied — ignore silently
        } else {
          console.log(
            `Migration skipped: ${migration.substring(0, 60)} — ${err.message}`,
          );
        }
      }
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO users_new (id, email, name, password_hash, upi_id, google_id, role, status, created_at)
          SELECT id, email, name, password_hash, upi_id, google_id, role, status, created_at FROM users;
          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
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
