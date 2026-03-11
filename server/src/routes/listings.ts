import express from "express";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import db from "../db/database.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";

import { fileURLToPath } from "url";

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
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

// Get all listings (with filtering)
router.get("/", async (req, res) => {
  try {
    const { semester, search, material_type } = req.query;
    let query = `
      SELECT l.*, u.name as seller_name, COALESCE(AVG(r.rating), 0) as seller_rating
      FROM listings l
      JOIN users u ON l.seller_id = u.id
      LEFT JOIN reviews r ON r.seller_id = u.id
      WHERE l.status = 'active'
    `;
    const args = [];

    if (semester) {
      query += " AND l.semester = ?";
      args.push(semester);
    }

    if (search) {
      query += " AND (l.course_code LIKE ? OR l.title LIKE ?)";
      args.push(`%${search}%`, `%${search}%`);
    }

    if (material_type) {
      query += " AND l.material_type = ?";
      args.push(material_type);
    }

    query += " GROUP BY l.id ORDER BY l.created_at DESC";

    const listings = await db.execute({ sql: query, args });

    // Fetch subjects for each listing if it has multiple subjects
    for (const listing of listings.rows) {
      if (listing.is_multiple_subjects) {
        const subjects = await db.execute({
          sql: "SELECT subject_name FROM listing_subjects WHERE listing_id = ?",
          args: [listing.id],
        });
        (listing as any).subjects = subjects.rows.map(
          (row) => row.subject_name,
        );
      }
    }

    res.json(listings.rows);
  } catch (error) {
    console.error("Error fetching listings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new listing
router.post(
  "/",
  authenticate as any,
  upload.single("image") as any,
  async (req: AuthRequest, res) => {
    try {
      const sellerId = req.user!.id;
      const {
        title,
        course_code,
        semester,
        condition,
        price,
        location,
        quantity,
        material_type,
        is_multiple_subjects,
        subjects,
        delivery_method,
        meetup_location,
      } = req.body;

      // Using local storage for demo, real app would use Cloudinary/S3
      const imageUrl = req.file
        ? `/uploads/${req.file.filename}`
        : "https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=800&auto=format&fit=crop";

      if (
        !title ||
        !course_code ||
        !semester ||
        !condition ||
        !price ||
        !location ||
        !material_type
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const listingId = uuidv4();
      const isMultiple =
        is_multiple_subjects === "true" || is_multiple_subjects === true;
      const deliveryMethod = delivery_method || "in_person";
      const meetupLoc = meetup_location || null;

      await db.execute({
        sql: `INSERT INTO listings (id, seller_id, title, course_code, semester, condition, price, location, image_url, quantity, material_type, is_multiple_subjects, delivery_method, meetup_location, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        args: [
          listingId,
          sellerId,
          title,
          course_code,
          semester,
          condition,
          parseInt(price),
          location,
          imageUrl,
          parseInt(quantity) || 1,
          material_type,
          isMultiple ? 1 : 0,
          deliveryMethod,
          meetupLoc,
        ],
      });

      if (isMultiple && subjects) {
        const subjectList = JSON.parse(subjects);
        for (const subject of subjectList) {
          await db.execute({
            sql: "INSERT INTO listing_subjects (listing_id, subject_name) VALUES (?, ?)",
            args: [listingId, subject],
          });
        }
      }

      res
        .status(201)
        .json({ message: "Listing created successfully", id: listingId });
    } catch (error) {
      console.error("Error creating listing:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Get my listings
router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const listings = await db.execute({
      sql: `
        SELECT l.*,
               COALESCE((SELECT AVG(rating) FROM reviews WHERE seller_id = l.seller_id), 0) as seller_rating
        FROM listings l
        WHERE l.seller_id = ?
        ORDER BY l.created_at DESC`,
      args: [req.user!.id],
    });
    res.json(listings.rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/listings/validate-cart
// Accepts { ids: string[] } — returns availability status for each listing.
// Used by the frontend CartContext to purge stale items on load.
router.post("/validate-cart", authenticate, async (req: AuthRequest, res) => {
  try {
    const { ids } = req.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }

    // Cap to 50 items to avoid abuse
    const safeIds = ids.slice(0, 50);
    const placeholders = safeIds.map(() => "?").join(", ");

    const result = await db.execute({
      sql: `SELECT id, title, quantity, status, price FROM listings WHERE id IN (${placeholders})`,
      args: safeIds,
    });

    const found = new Map(result.rows.map((l) => [l.id as string, l]));

    const validation = safeIds.map((id) => {
      const listing = found.get(id);
      if (!listing) {
        return { id, available: false, reason: "Listing no longer exists" };
      }
      if (listing.status !== "active") {
        return { id, available: false, reason: "Listing is no longer active" };
      }
      if (Number(listing.quantity) === 0) {
        return { id, available: false, reason: "Out of stock" };
      }
      return {
        id,
        available: true,
        quantity: Number(listing.quantity),
        price: Number(listing.price),
        title: listing.title as string,
      };
    });

    res.json(validation);
  } catch (error) {
    console.error("validate-cart error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
