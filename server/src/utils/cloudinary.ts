import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    timeout: 120000 // 120 seconds
  });
}

// ── Cloudinary Storage ───────────────────────────────────────────────────────
const cloudinaryStorage = isCloudinaryConfigured ? new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    console.log(`[Cloudinary Storage] Processing upload for: ${file.originalname} (${file.mimetype})`);
    const isProfile = req.baseUrl.includes('users');
    const folder = isProfile ? 'opennotes/profiles' : 'opennotes/resources';
    
    // Determine Cloudinary resource_type
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    const resource_type = imageTypes.includes(file.mimetype) ? 'image' : 'raw';
    
    console.log(`[Cloudinary Storage] Folder: ${folder}, Type: ${resource_type}`);

    return {
      folder: folder,
      resource_type: resource_type,
      allowed_formats: ['jpg', 'png', 'webp', 'jpeg', 'pdf', 'docx', 'doc', 'zip', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'],
      public_id: `file-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    };
  },
}) : null;

// ── Local Disk Storage (Fallback for local testing) ─────────────────────────
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, "../../../uploads"));
  },
  filename: (req, file, cb) => {
    const prefix = req.baseUrl.includes('users') ? 'profile-' : 'listing-';
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({ 
  storage: isCloudinaryConfigured ? cloudinaryStorage! : diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

/**
 * Utility to get the correct public URL for an uploaded file
 */
export const getFileUrl = (file: any) => {
  if (isCloudinaryConfigured) {
    // In Cloudinary mode, 'path' is the full secure URL
    // We append auto-optimization parameters for better delivery performance
    if (file.path && file.path.includes('cloudinary.com')) {
      // Only apply image transformations if it's actually an image
      const isImage = file.mimetype && file.mimetype.startsWith('image/');
      if (isImage) {
        const parts = file.path.split('/upload/');
        if (parts.length === 2) {
          return `${parts[0]}/upload/q_auto,f_auto/${parts[1]}`;
        }
      }
    }
    return file.path;
  } else {
    // In Local mode, we return the relative web path
    return `/uploads/${file.filename}`;
  }
};

export default cloudinary;
