import express from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db/database.js";
import { authenticate, AuthRequest, optionalAuthenticate } from "../middleware/auth.js";
import { upload, getFileUrl } from "../utils/cloudinary.js";

const router = express.Router();

const isDev = process.env.NODE_ENV !== 'production';

// Debug middleware for resources (only in dev)
if (isDev) {
  router.use((req, res, next) => {
    console.log(`[Resources Debug] ${req.method} ${req.url}`);
    next();
  });
}

/**
 * @route GET /api/resources/quota
 * @desc Get current month's upload quota status
 */
router.get("/quota", authenticate as any, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const userResult = await db.execute({
      sql: "SELECT role, monthly_upload_limit FROM users WHERE id = ?",
      args: [userId]
    });
    const user = userResult.rows[0] as any;
    
    if (!user) return res.status(404).json({ error: "User not found" });

    const limit = user.monthly_upload_limit || 10;
    const isAdmin = user.role === 'admin';

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const countResult = await db.execute({
      sql: "SELECT COUNT(*) as count FROM resources WHERE uploader_id = ? AND created_at >= ?",
      args: [userId, startOfMonth.toISOString()]
    });
    const used = Number((countResult.rows[0] as any).count);

    res.json({
      used,
      limit: isAdmin ? 999999 : limit,
      remaining: isAdmin ? 999999 : Math.max(0, limit - used),
      isAdmin
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resources/:id/download
 * @desc Proxy route to download from Cloudinary and stream with attachment headers
 */
router.get("/:id/download", optionalAuthenticate as any, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    if (isDev) console.log(`[Resources Debug] Attempting download for ID: ${id}`);
    
    const resourceResult = await db.execute({
      sql: "SELECT * FROM resources WHERE id = ?",
      args: [id]
    });
    const resource = resourceResult.rows[0] as any;

    if (!resource) {
      if (isDev) console.log(`[Resources Debug] Resource NOT FOUND in DB for ID: ${id}`);
      return res.status(404).json({ error: "Resource not found" });
    }

    // ── Handle Download Count ───────────────────────────────────────────────
    const userId = req.user?.id;

    if (userId) {
      const trackResult = await db.execute({
        sql: "INSERT OR IGNORE INTO resource_downloads (user_id, resource_id) VALUES (?, ?)",
        args: [userId, id]
      });
      if (trackResult.rowsAffected > 0) {
        await db.execute({
          sql: "UPDATE resources SET download_count = download_count + 1 WHERE id = ?",
          args: [id]
        });
      }
    } else {
      await db.execute({
        sql: "UPDATE resources SET download_count = download_count + 1 WHERE id = ?",
        args: [id]
      });
    }

    // ── Streaming the file ───────────────────────────────────────────────────
    const fileUrl = resource.file_url;
    
    // Set headers to force download
    const filename = `${resource.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${resource.file_type}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (fileUrl.startsWith('http')) {
      const https = await import('https');
      
      const streamFile = (url: string) => {
        if (isDev) console.log(`[Resources Debug] Streaming from storage URL: ${url}`);
        const request = https.get(url, (response) => {
          // Handle Redirects
          if ((response.statusCode === 301 || response.statusCode === 302) && response.headers.location) {
            return streamFile(response.headers.location);
          }

          if (response.statusCode === 200) {
            if (response.headers['content-length']) {
              res.setHeader('Content-Length', response.headers['content-length']);
            }
            res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
            res.status(200);
            response.pipe(res);
          } else {
            if (!res.headersSent) res.status(response.statusCode || 500).send('Error fetching file from storage');
          }
        });

        request.setTimeout(15000, () => {
          request.destroy();
          if (!res.headersSent) res.status(504).send('Storage timeout');
        });

        request.on('error', (err) => {
          console.error('Proxy Download Internal Error:', err);
          if (!res.headersSent) res.status(500).send('Internal Storage Error');
        });
      };

      streamFile(fileUrl);
    } else {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const filePath = path.join(__dirname, "../../", fileUrl);
      
      if (fs.existsSync(filePath)) {
        res.download(filePath, filename);
      } else {
        res.status(404).send('File not found on server');
      }
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resources
 * @desc Get all resources with filtering and pagination
 */
router.get("/", async (req, res, next) => {
  try {
    const { semester, category, search } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    let query = `
      SELECT r.*, u.name as uploader_name
      FROM resources r
      JOIN users u ON r.uploader_id = u.id
      WHERE r.status = 'active'
    `;
    const args: any[] = [];

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
      const searchPattern = `%${search}%`;
      args.push(searchPattern, searchPattern, searchPattern);
    }

    query += " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
    args.push(limit, offset);

    const result = await db.execute({ sql: query, args });
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * Quota check middleware
 */
const checkQuota = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    const userId = req.user!.id;
    const userResult = await db.execute({
      sql: "SELECT role, monthly_upload_limit FROM users WHERE id = ?",
      args: [userId]
    });
    const user = userResult.rows[0] as any;
    
    if (user && user.role !== 'admin') {
      const limit = user.monthly_upload_limit || 10;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const countResult = await db.execute({
        sql: "SELECT COUNT(*) as count FROM resources WHERE uploader_id = ? AND created_at >= ?",
        args: [userId, startOfMonth.toISOString()]
      });
      const uploadCount = Number((countResult.rows[0] as any).count);

      if (uploadCount >= limit) {
        return res.status(403).json({ 
          error: `Monthly upload limit reached (${limit}). Please contact an admin to increase your quota.` 
        });
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * @route POST /api/resources
 * @desc Upload a new resource
 */
router.post("/", authenticate as any, checkQuota as any, upload.single("file") as any, async (req: AuthRequest, res, next) => {
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
 * @route DELETE /api/resources/:id
 * @desc Soft delete a resource
 */
router.delete("/:id", authenticate as any, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

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

/**
 * @route GET /api/resources/subject-links
 * @desc Get all subject drive links
 */
router.get("/subject-links", async (_req, res, next) => {
  try {
    const result = await db.execute("SELECT * FROM subject_drive_links");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
