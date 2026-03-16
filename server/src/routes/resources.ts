import express from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db/database.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { upload, getFileUrl } from "../utils/cloudinary.js";

const router = express.Router();

// Debug middleware for resources
router.use((req, res, next) => {
  console.log(`[Resources Debug] ${req.method} ${req.url}`);
  next();
});

/**
 * @route GET /api/resources/:id/download
 * @desc Proxy route to download from Cloudinary and stream with attachment headers
 */
router.get("/:id/download", async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(`[Resources Debug] Attempting download for ID: ${id}`);
    
    const resourceResult = await db.execute({
      sql: "SELECT * FROM resources WHERE id = ?",
      args: [id]
    });
    const resource = resourceResult.rows[0] as any;

    if (!resource) {
      console.log(`[Resources Debug] Resource NOT FOUND in DB for ID: ${id}`);
      return res.status(404).json({ error: "Resource not found" });
    }

    console.log(`[Resources Debug] Found resource: ${resource.title}, URL: ${resource.file_url}`);

    // ── Handle Download Count (Copied from existing logic) ──────────────────
    const authHeaders = req.cookies.auth_token;
    let userId: string | null = null;
    if (authHeaders) {
      try {
        const decoded = (await import('jsonwebtoken')).default.verify(
          authHeaders, 
          process.env.JWT_SECRET || "opennotes-dev-secret-change-in-prod"
        ) as any;
        userId = decoded.id;
      } catch (err) {}
    }

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
    
    // Debug Logs for Cloudinary path verification
    console.log('[Download Debug] file_url from DB:', fileUrl);
    console.log('[Download Debug] resource_type guess:', fileUrl.includes('/raw/') ? 'raw' : 'image');

    // Set headers to force download
    const filename = `${resource.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${resource.file_type}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (fileUrl.startsWith('http')) {
      // Proxying remote files (Cloudinary)
      const https = await import('https');
      
      const streamFile = (url: string) => {
        console.log(`[Resources Debug] Streaming from storage URL: ${url}`);
        https.get(url, (response) => {
          // Handle Redirects (Cloudinary sometimes does this)
          if ((response.statusCode === 301 || response.statusCode === 302) && response.headers.location) {
            console.log(`[Resources Debug] Following redirect to: ${response.headers.location}`);
            return streamFile(response.headers.location);
          }

          if (response.statusCode === 200) {
            // Transfer critical headers
            if (response.headers['content-length']) {
              res.setHeader('Content-Length', response.headers['content-length']);
            }
            res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
            res.status(200);
            response.pipe(res);
          } else {
            console.error(`Storage Error: ${response.statusCode} for ${url}`);
            if (!res.headersSent) res.status(response.statusCode || 500).send('Error fetching file from storage');
          }
        }).on('error', (err) => {
          console.error('Proxy Download Internal Error:', err);
          if (!res.headersSent) res.status(500).send('Internal Storage Error');
        });
      };

      streamFile(fileUrl);
    } else {
      // Local file fallback
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
 * @route POST /api/resources
 * @desc Upload a new resource
 */
router.post("/", authenticate as any, (req, res, next) => {
  console.log('[Resources Debug] Incoming upload request...');
  next();
}, upload.single("file") as any, async (req: AuthRequest, res, next) => {
  try {
    console.log('[Resources Debug] File received by multer:', req.file?.originalname);
    const uploaderId = req.user!.id;
    const { title, description, semester, category, subject_name, course_code } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    if (!title || !semester || !category || !subject_name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ── Monthly Upload Quota Check ──────────────────────────────────────────
    const userResult = await db.execute({
      sql: "SELECT role, monthly_upload_limit FROM users WHERE id = ?",
      args: [uploaderId]
    });
    const user = userResult.rows[0] as any;
    
    if (user && user.role !== 'admin') {
      const limit = user.monthly_upload_limit || 10;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const countResult = await db.execute({
        sql: "SELECT COUNT(*) as count FROM resources WHERE uploader_id = ? AND created_at >= ?",
        args: [uploaderId, startOfMonth.toISOString()]
      });
      const uploadCount = Number((countResult.rows[0] as any).count);

      if (uploadCount >= limit) {
        return res.status(403).json({ 
          error: `Monthly upload limit reached (${limit}). Please contact an admin to increase your quota.` 
        });
      }
    }
    // ────────────────────────────────────────────────────────────────────────

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
 * @desc (DEPRECATED) Increment download count
 */
router.post("/:id/download", async (req, res, next) => {
  res.status(410).json({ error: "Use GET /api/resources/:id/download instead" });
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
