import { v2 as cloudinary } from 'cloudinary';
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
const cloudinaryStorage: multer.StorageEngine | null = isCloudinaryConfigured ? {
  _handleFile(req, file, cb) {
    console.log(`[Cloudinary Storage] Processing upload for: ${file.originalname} (${file.mimetype})`);
    const isProfile = req.baseUrl.includes('users');
    const isIssue = req.baseUrl.includes('issues');
    const isListing = req.baseUrl.includes('listings');
    const folder = isProfile
      ? 'opennotes/profiles'
      : isIssue
        ? 'opennotes/issues'
        : isListing
          ? 'opennotes/listings'
          : 'opennotes/resources';
    
    // Determine Cloudinary resource_type
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    const resource_type = imageTypes.includes(file.mimetype) ? 'image' : 'raw';
    
    console.log(`[Cloudinary Storage] Folder: ${folder}, Type: ${resource_type}`);

    const uploadStream = cloudinary.uploader.upload_stream({
      folder,
      resource_type,
      allowed_formats: ['jpg', 'png', 'webp', 'jpeg', 'pdf', 'docx', 'doc', 'zip', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'],
      public_id: `file-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    }, (error, result) => {
      if (error) return cb(error);
      if (!result) return cb(new Error('Cloudinary upload completed without a result.'));

      cb(null, {
        destination: 'cloudinary',
        filename: result.public_id,
        path: result.secure_url,
        size: result.bytes,
        cloudinaryResourceType: result.resource_type,
      } as Partial<Express.Multer.File> & { cloudinaryResourceType: string });
    });

    file.stream.pipe(uploadStream);
  },
  _removeFile(_req, file, cb) {
    if (!file.filename) return cb(null);

    const resourceType = (file as Express.Multer.File & {
      cloudinaryResourceType?: 'image' | 'raw' | 'video';
    }).cloudinaryResourceType ?? 'image';

    cloudinary.uploader.destroy(file.filename, { resource_type: resourceType })
      .then(() => cb(null))
      .catch((error: Error) => cb(error));
  },
} : null;

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

const storage = isCloudinaryConfigured ? cloudinaryStorage! : diskStorage;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const RESOURCE_MIME_TYPES = new Set([
  ...IMAGE_MIME_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
]);

const fileFilter = (allowedTypes: Set<string>) =>
  (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!allowedTypes.has(file.mimetype.toLowerCase())) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
    cb(null, true);
  };

export const imageUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: fileFilter(IMAGE_MIME_TYPES),
});

export const resourceUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: fileFilter(RESOURCE_MIME_TYPES),
});

// Backwards-compatible export for any external imports.
export const upload = resourceUpload;

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
