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

import { upload, getFileUrl } from "../utils/cloudinary.js";

// Get all listings (with filtering)
router.get("/", async (req, res, next) => {
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
      args.push(semester as string);
    }

    const searchStr = typeof search === 'string' ? search : '';
    const materialTypeStr = typeof material_type === 'string' ? material_type : '';

    if (searchStr) {
      query += " AND (l.course_code LIKE ? OR l.title LIKE ?)";
      args.push(`%${searchStr}%`, `%${searchStr}%`);
    }

    if (materialTypeStr) {
      query += " AND l.material_type = ?";
      args.push(materialTypeStr);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    query += " GROUP BY l.id ORDER BY l.created_at DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    const listings = await db.execute({ sql: query, args });

    // Fetch images and subjects for filtered listings in batch
    const allListingIds = listings.rows.map((l: any) => l.id);
    
    if (allListingIds.length > 0) {
      const placeholders = allListingIds.map(() => "?").join(",");
      
      // Fetch all images for these listings
      const imagesRes = await db.execute({
        sql: `SELECT listing_id, url, is_main FROM listing_images WHERE listing_id IN (${placeholders}) ORDER BY is_main DESC, created_at ASC`,
        args: allListingIds,
      });

      const imagesByListing = imagesRes.rows.reduce((acc: any, row: any) => {
        const lid = String(row.listing_id);
        if (!acc[lid]) acc[lid] = [];
        acc[lid].push(row.url);
        return acc;
      }, {});

      // Fetch subjects for multiple-subject listings
      const multiSubjectIds = listings.rows
        .filter((l: any) => l.is_multiple_subjects)
        .map((l: any) => l.id);

      let subjectsByListing: any = {};
      if (multiSubjectIds.length > 0) {
        const subPlaceholders = multiSubjectIds.map(() => "?").join(",");
        const subjectsRes = await db.execute({
          sql: `SELECT listing_id, subject_name FROM listing_subjects WHERE listing_id IN (${subPlaceholders})`,
          args: multiSubjectIds,
        });

        subjectsByListing = subjectsRes.rows.reduce((acc: any, row: any) => {
          const lid = String(row.listing_id);
          if (!acc[lid]) acc[lid] = [];
          acc[lid].push(row.subject_name);
          return acc;
        }, {});
      }

      listings.rows.forEach((l: any) => {
        const lid = String(l.id);
        l.images = imagesByListing[lid] || [l.image_url];
        // Ensure legacy image field is populated
        l.image = l.images[0] || l.image_url;
        
        if (l.is_multiple_subjects) {
          l.subjects = subjectsByListing[lid] || [];
        }
      });
    }

    res.json(listings.rows);
  } catch (error) {
    next(error);
  }
});

// Create a new listing
router.post(
  "/upload-image",
  authenticate as any,
  upload.single("image") as any,
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image provided" });
      }
      const url = getFileUrl(req.file);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  }
);

// Create a new listing
router.post(
  "/",
  authenticate as any,
  async (req: AuthRequest, res, next) => {
    try {
      const sellerId = req.user!.id;
      const {
        title,
        description,
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
        preferred_meetup_spot,
        meetup_location,
        imageUrls: preUploadedUrls
      } = req.body;

      // Handle pre-uploaded image URLs (JSON or Array)
      let imageUrls: string[] = [];
      const rawImageUrls = req.body.imageUrls || preUploadedUrls;
      if (rawImageUrls) {
        try {
          imageUrls = typeof rawImageUrls === 'string' 
            ? JSON.parse(rawImageUrls) 
            : rawImageUrls;
        } catch (e) {
          console.error('[Listings] Failed to parse imageUrls:', e);
        }
      }
      
      // Ensure we have an array of strings
      if (!Array.isArray(imageUrls)) {
        imageUrls = typeof imageUrls === 'string' ? [imageUrls] : [];
      }
      
      // Fallback if no images provided
      if (imageUrls.length === 0) {
        imageUrls.push("https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=800&auto=format&fit=crop");
      }
      
      const mainImageUrl = imageUrls[0];

      if (
        !title ||
        !course_code ||
        !semester ||
        !condition ||
        (price === undefined || price === null || price === '') ||
        !location ||
        !material_type
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Input Validation
      const parsedPrice = parseInt(price);
      const parsedQuantity = quantity !== undefined ? parseInt(quantity) : 1;

      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: "Price must be 0 or a positive number" });
      }
      if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        return res.status(400).json({ error: "Quantity must be a positive number" });
      }

      const validSemesters = ["Sem1", "Sem2", "Sem3", "Sem4", "Sem5", "Sem6", "Sem7", "Sem8"];
      if (!validSemesters.includes(semester)) {
        return res.status(400).json({ error: "Invalid semester" });
      }

      const validMaterialTypes = ["handwritten", "printed", "digital", "book", "ppt", "other"];
      if (!validMaterialTypes.includes(material_type)) {
        return res.status(400).json({ error: "Invalid material type" });
      }

      const listingId = uuidv4();
      const isMultiple =
        is_multiple_subjects === "true" || is_multiple_subjects === true;
      const deliveryMethod = delivery_method || "in_person";
      const meetupLoc = meetup_location || null;
await db.execute({
  sql: `INSERT INTO listings (id, seller_id, title, description, course_code, semester, condition, price, location, image_url, quantity, material_type, is_multiple_subjects, delivery_method, preferred_meetup_spot, meetup_location, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
  args: [
    listingId,
    sellerId,
    title,
    description || null,
    course_code,
    semester,
    condition,
    parsedPrice,
    location,
    mainImageUrl,
    parsedQuantity,
    material_type,
    isMultiple ? 1 : 0,
    deliveryMethod,
    preferred_meetup_spot || null,
    meetupLoc,
  ],
});
      // Insert all images into listing_images table
      for (let i = 0; i < imageUrls.length; i++) {
        await db.execute({
          sql: "INSERT INTO listing_images (id, listing_id, url, is_main) VALUES (?, ?, ?, ?)",
          args: [uuidv4(), listingId, imageUrls[i], i === 0 ? 1 : 0],
        });
      }

      if (isMultiple && subjects) {
        try {
          const subjectList = typeof subjects === 'string' 
            ? JSON.parse(subjects) 
            : subjects;
          
          if (!Array.isArray(subjectList)) {
            throw new Error("Subjects must be an array");
          }
          for (const subject of subjectList) {
            await db.execute({
              sql: "INSERT INTO listing_subjects (listing_id, subject_name) VALUES (?, ?)",
              args: [listingId, subject],
            });
          }
        } catch (e) {
          return res.status(400).json({ error: "Invalid subjects format" });
        }
      }

      res
        .status(201)
        .json({ message: "Listing created successfully", id: listingId });
    } catch (error: any) {
      console.error('[Listings] ERROR creating listing:', error.message || error);
      next(error);
    }
  },
);

// Get my listings
router.get("/me", authenticate, async (req: AuthRequest, res, next) => {
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

    const rows = listings.rows as any[];
    if (rows.length > 0) {
      const allListingIds = rows.map((l: any) => l.id);
      const placeholders = allListingIds.map(() => "?").join(",");
      
      const imagesRes = await db.execute({
        sql: `SELECT listing_id, url, is_main FROM listing_images WHERE listing_id IN (${placeholders}) ORDER BY is_main DESC, created_at ASC`,
        args: allListingIds,
      });

      const imagesByListing = imagesRes.rows.reduce((acc: any, row: any) => {
        const lid = String(row.listing_id);
        if (!acc[lid]) acc[lid] = [];
        acc[lid].push(row.url);
        return acc;
      }, {});

      rows.forEach((l: any) => {
        l.images = imagesByListing[String(l.id)] || [l.image_url];
        l.image = l.images[0] || l.image_url;
      });
    }

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Increment view count for a listing
router.post("/:id/view", async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: "UPDATE listings SET views = views + 1 WHERE id = ?",
      args: [id],
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/listings/validate-cart
// Accepts { ids: string[] } — returns availability status for each listing.
// Used by the frontend CartContext to purge stale items on load.
router.post("/validate-cart", authenticate, async (req: AuthRequest, res, next) => {
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
    next(error);
  }
});

export default router;
