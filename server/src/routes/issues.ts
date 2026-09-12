import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import db from '../db/database.js';
import { optionalAuthenticate, type AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../utils/notifications.js';
import { getFileUrl, imageUpload } from '../utils/cloudinary.js';

const router = Router();

const CATEGORIES = new Set([
  'otp_verification',
  'login_registration',
  'listing_upload',
  'order_checkout',
  'messages_notifications',
  'study_resources',
  'other',
]);

const issueLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many issue reports. Please try again later.' },
});

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Public by design: users must be able to report login and OTP problems.
router.post('/', issueLimiter as any, optionalAuthenticate as any, imageUpload.single('screenshot') as any, async (req: AuthRequest, res) => {
  try {
    const { email, category, subject, description, page_url, website, technical_context } = req.body ?? {};

    // Honeypot for automated form spam. Respond successfully without storing it.
    if (website) {
      return res.status(201).json({ success: true, reference: 'RECEIVED' });
    }

    const contactEmail = String(email || req.user?.email || '').trim().toLowerCase();
    const cleanCategory = String(category || '').trim();
    const cleanSubject = String(subject || '').trim();
    const cleanDescription = String(description || '').trim();
    const cleanPageUrl = String(page_url || '').trim().slice(0, 500);
    const cleanTechnicalContext = String(technical_context || '').trim().slice(0, 1000);
    const screenshotUrl = req.file ? getFileUrl(req.file) : null;

    if (!isValidEmail(contactEmail) || contactEmail.length > 254) {
      return res.status(400).json({ error: 'Please provide a valid contact email.' });
    }
    if (!CATEGORIES.has(cleanCategory)) {
      return res.status(400).json({ error: 'Please select a valid issue category.' });
    }
    if (cleanSubject.length < 5 || cleanSubject.length > 120) {
      return res.status(400).json({ error: 'Subject must be between 5 and 120 characters.' });
    }
    if (cleanDescription.length < 10 || cleanDescription.length > 2000) {
      return res.status(400).json({ error: 'Description must be between 10 and 2000 characters.' });
    }

    const id = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO issue_reports
            (id, user_id, email, category, subject, description, page_url, user_agent,
             screenshot_url, technical_context)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        req.user?.id || null,
        contactEmail,
        cleanCategory,
        cleanSubject,
        cleanDescription,
        cleanPageUrl || null,
        String(req.get('user-agent') || '').slice(0, 500) || null,
        screenshotUrl,
        cleanTechnicalContext || null,
      ],
    });

    const admins = await db.execute(
      "SELECT id FROM users WHERE role = 'admin' AND (status IS NULL OR status != 'blocked')",
    );
    const categoryLabel = cleanCategory.replace(/_/g, ' ');
    await Promise.allSettled(admins.rows.map((admin) =>
      createNotification(
        String(admin.id),
        'issue_report',
        'New issue reported',
        `${categoryLabel}: ${cleanSubject}`,
        '/admin?tab=issues',
      ),
    ));

    return res.status(201).json({
      success: true,
      reference: id.split('-')[0].toUpperCase(),
      message: 'Your issue has been sent to the OpenNotes admin.',
    });
  } catch (error) {
    console.error('[Issue Report] Failed to save report:', error);
    return res.status(500).json({ error: 'Could not submit the issue report. Please try again.' });
  }
});

export default router;
