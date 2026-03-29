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
    const { semester, search, material_type, location } = req.query;
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
    const locationStr = typeof location === 'string' ? location : '';

    if (searchStr) {
      query += " AND (l.course_code LIKE ? OR l.title LIKE ?)";
      args.push(`%${searchStr}%`, `%${searchStr}%`);
    }

    if (materialTypeStr) {
      query += " AND l.material_type = ?";
      args.push(materialTypeStr);
    }

    if (locationStr) {
      query += " AND l.location = ?";
      args.push(locationStr);
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
      const parsedOriginalPrice = req.body.original_price ? parseInt(req.body.original_price) : null;

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
  sql: `INSERT INTO listings (id, seller_id, title, description, course_code, semester, condition, price, original_price, location, image_url, quantity, material_type, is_multiple_subjects, delivery_method, preferred_meetup_spot, meetup_location, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
  args: [
    listingId,
    sellerId,
    title,
    description || null,
    course_code,
    semester,
    condition,
    parsedPrice,
    parsedOriginalPrice,
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
        WHERE l.seller_id = ? AND l.status != 'archived'
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

// ─── PUT /api/listings/:id — Edit a listing (seller only) ────────────────────
router.put("/:id", authenticate as any, async (req: AuthRequest, res, next) => {
  try {
    const sellerId = req.user!.id;
    const { id } = req.params;

    // Verify listing exists and is owned by this seller
    const listingRes = await db.execute({
      sql: "SELECT * FROM listings WHERE id = ?",
      args: [id],
    });
    const listing = listingRes.rows[0] as any;
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.seller_id !== sellerId) return res.status(403).json({ error: "You do not own this listing" });

    // Check for active pending orders
    const activeOrdersRes = await db.execute({
      sql: "SELECT id FROM order_items WHERE listing_id = ? AND status IN ('pending_meetup', 'acknowledged')",
      args: [id],
    });
    const hasActiveOrders = activeOrdersRes.rows.length > 0;

    const {
      title,
      description,
      price,
      quantity,
      condition,
      location,
      preferred_meetup_spot,
      meetup_location,
      imageUrls: rawImageUrls,
      subjects: rawSubjects,
    } = req.body;

    // Validate editable fields
    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: "Title cannot be empty" });
    }

    let parsedPrice = listing.price;
    if (price !== undefined) {
      if (hasActiveOrders) return res.status(400).json({ error: "Cannot change price while a buyer order is pending" });
      parsedPrice = parseInt(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ error: "Price must be 0 or a positive number" });
    }

    let parsedQuantity = listing.quantity;
    if (quantity !== undefined) {
      if (hasActiveOrders) return res.status(400).json({ error: "Cannot change quantity while a buyer order is pending" });
      parsedQuantity = parseInt(quantity);
      if (isNaN(parsedQuantity) || parsedQuantity <= 0) return res.status(400).json({ error: "Quantity must be a positive number" });
    }

    // Build dynamic update
    const setClauses: string[] = [];
    const args: any[] = [];

    if (title !== undefined)               { setClauses.push("title = ?");                    args.push(title.trim()); }
    if (description !== undefined)         { setClauses.push("description = ?");               args.push(description || null); }
    if (price !== undefined)               { setClauses.push("price = ?");                     args.push(parsedPrice); }
    if (quantity !== undefined)            { setClauses.push("quantity = ?");                  args.push(parsedQuantity); }
    if (condition !== undefined)           { setClauses.push("condition = ?");                 args.push(condition); }
    if (location !== undefined)            { setClauses.push("location = ?");                  args.push(location); }
    if (preferred_meetup_spot !== undefined) { setClauses.push("preferred_meetup_spot = ?");  args.push(preferred_meetup_spot || null); }
    if (meetup_location !== undefined)     { setClauses.push("meetup_location = ?");           args.push(meetup_location || null); }

    // Re-activate if sold-out listing gets restocked
    if (quantity !== undefined && parsedQuantity > 0 && listing.status === 'archived') {
      setClauses.push("status = 'active'");
    }

    if (setClauses.length > 0) {
      args.push(id);
      await db.execute({
        sql: `UPDATE listings SET ${setClauses.join(", ")} WHERE id = ?`,
        args,
      });
    }

    // Update images (only if no active orders)
    if (rawImageUrls !== undefined) {
      if (hasActiveOrders) return res.status(400).json({ error: "Cannot change images while a buyer order is pending" });
      let imageUrls: string[] = [];
      try {
        imageUrls = typeof rawImageUrls === "string" ? JSON.parse(rawImageUrls) : rawImageUrls;
      } catch { /* ignore */ }
      if (!Array.isArray(imageUrls)) imageUrls = typeof imageUrls === "string" ? [imageUrls] : [];

      if (imageUrls.length > 0) {
        await db.execute({ sql: "DELETE FROM listing_images WHERE listing_id = ?", args: [id] });
        for (let i = 0; i < imageUrls.length; i++) {
          await db.execute({
            sql: "INSERT INTO listing_images (id, listing_id, url, is_main) VALUES (?, ?, ?, ?)",
            args: [uuidv4(), id, imageUrls[i], i === 0 ? 1 : 0],
          });
        }
        await db.execute({ sql: "UPDATE listings SET image_url = ? WHERE id = ?", args: [imageUrls[0], id] });
      }
    }

    // Update subjects for multi-subject listings
    if (rawSubjects !== undefined && listing.is_multiple_subjects) {
      try {
        const subjectList = typeof rawSubjects === "string" ? JSON.parse(rawSubjects) : rawSubjects;
        if (Array.isArray(subjectList) && subjectList.length > 0) {
          await db.execute({ sql: "DELETE FROM listing_subjects WHERE listing_id = ?", args: [id] });
          for (const subject of subjectList) {
            await db.execute({
              sql: "INSERT INTO listing_subjects (listing_id, subject_name) VALUES (?, ?)",
              args: [id, subject],
            });
          }
        }
      } catch { /* ignore malformed subjects */ }
    }

    // Return the updated listing
    const updatedRes = await db.execute({
      sql: `SELECT l.*, u.name as seller_name FROM listings l JOIN users u ON l.seller_id = u.id WHERE l.id = ?`,
      args: [id],
    });

    // Attach images
    const imagesRes = await db.execute({
      sql: "SELECT url FROM listing_images WHERE listing_id = ? ORDER BY is_main DESC, created_at ASC",
      args: [id],
    });
    const updatedListing = updatedRes.rows[0] as any;
    if (updatedListing) {
      updatedListing.images = imagesRes.rows.map((r: any) => r.url);
      updatedListing.image = updatedListing.images[0] || updatedListing.image_url;
    }

    res.json({ message: "Listing updated successfully", listing: updatedListing });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/listings/:id — Soft-delete a listing (seller only) ──────────
router.delete("/:id", authenticate as any, async (req: AuthRequest, res, next) => {
  try {
    const sellerId = req.user!.id;
    const { id } = req.params;

    // Verify listing exists and is owned by this seller
    const listingRes = await db.execute({
      sql: "SELECT id, seller_id, status FROM listings WHERE id = ?",
      args: [id],
    });
    const listing = listingRes.rows[0] as any;
    if (!listing) return res.status(404).json({ error: "Listing not found" });
    if (listing.seller_id !== sellerId) return res.status(403).json({ error: "You do not own this listing" });

    // Block if there are active in-progress orders
    const activeOrdersRes = await db.execute({
      sql: "SELECT id FROM order_items WHERE listing_id = ? AND status IN ('pending_meetup', 'acknowledged')",
      args: [id],
    });
    if (activeOrdersRes.rows.length > 0) {
      return res.status(409).json({
        error: "Cannot delete this listing — a buyer has an active order for it. Please complete or cancel the transaction first.",
      });
    }

    // Soft-delete: set status to archived
    await db.execute({
      sql: "UPDATE listings SET status = 'archived' WHERE id = ?",
      args: [id],
    });

    res.json({ message: "Listing removed successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;

