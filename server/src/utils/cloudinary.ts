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
  });
}

// ── Cloudinary Storage ───────────────────────────────────────────────────────
const cloudinaryStorage = isCloudinaryConfigured ? new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const folder = req.baseUrl.includes('users') ? 'opennotes/profiles' : 'opennotes/listings';
    return {
      folder: folder,
      allowed_formats: ['jpg', 'png', 'webp', 'jpeg', 'pdf', 'docx', 'doc', 'zip'],
      public_id: `file-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      transformation: [
        { width: 1000, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
      ]
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
  limits: { fileSize: 5 * 1024 * 1024 }
});

/**
 * Utility to get the correct public URL for an uploaded file
 */
export const getFileUrl = (file: any) => {
  if (isCloudinaryConfigured) {
    // In Cloudinary mode, 'path' is the full secure URL
    // We append auto-optimization parameters for better delivery performance
    if (file.path && file.path.includes('cloudinary.com')) {
      const parts = file.path.split('/upload/');
      if (parts.length === 2) {
        return `${parts[0]}/upload/q_auto,f_auto/${parts[1]}`;
      }
    }
    return file.path;
  } else {
    // In Local mode, we return the relative web path
    return `/uploads/${file.filename}`;
  }
};

export default cloudinary;
