import express from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db/database.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { upload, getFileUrl } from "../utils/cloudinary.js";

const router = express.Router();

/**
 * @route GET /api/resources
 * @desc Get all resources with filtering
 */
router.get("/", async (req, res, next) => {
  try {
    const { semester, category, search } = req.query;
    let query = `
      SELECT r.*, u.name as uploader_name
      FROM resources r
      JOIN users u ON r.uploader_id = u.id
      WHERE r.status = 'active'
    `;
    const args = [];

    if (semester) {
      query += " AND r.semester = ?";
      args.push(semester as string);
    }
    if (category) {
      query += " AND r.category = ?";
      args.push(category as string);
    }
    if (search) {
      query += " AND (r.title LIKE ? OR r.subject_name LIKE ? OR r.course_code LIKE ?)";
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += " ORDER BY r.created_at DESC";

    const result = await db.execute({ sql: query, args });
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resources
 * @desc Upload a new resource
 */
router.post("/", authenticate as any, upload.single("file") as any, async (req: AuthRequest, res, next) => {
  try {
    const uploaderId = req.user!.id;
    const { title, description, semester, category, subject_name, course_code } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    if (!title || !semester || !category || !subject_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const fileUrl = getFileUrl(req.file);
    
    // Better file type mapping
    const mimeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/zip': 'zip',
      'application/x-zip-compressed': 'zip',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/octet-stream': 'file'
    };
    const fileType = mimeMap[req.file.mimetype] || req.file.mimetype.split('/')[1] || "file";
    const id = uuidv4();

    await db.execute({
      sql: `INSERT INTO resources (id, uploader_id, title, description, file_url, file_type, semester, category, subject_name, course_code)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, uploaderId, title, description || null, fileUrl, fileType, semester, category, subject_name, course_code || null]
    });

    res.status(201).json({ message: "Resource uploaded successfully", id });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resources/:id/download
 * @desc Increment download count
 */
router.post("/:id/download", async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: "UPDATE resources SET download_count = download_count + 1 WHERE id = ?",
      args: [id]
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/resources/:id
 * @desc Soft delete a resource
 */
router.delete("/:id", authenticate as any, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check ownership or admin
    const resource = await db.execute({
      sql: "SELECT uploader_id FROM resources WHERE id = ?",
      args: [id]
    });

    if (resource.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found" });
    }

    if (resource.rows[0].uploader_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await db.execute({
      sql: "UPDATE resources SET status = 'deleted' WHERE id = ?",
      args: [id]
    });

    res.json({ message: "Resource deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
