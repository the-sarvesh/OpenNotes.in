import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { getSetting, updateSetting } from "../utils/settings.js";
import { DEFAULT_SUBJECTS_BY_SEM, normalizeSubjectCatalog, validateSubjectCatalog } from "../utils/subjects.js";

const router = express.Router();

// GET /api/settings - Public settings (platform_fee, etc)
router.get("/", async (req, res, next) => {
  try {
    const platformFee = await getSetting("platform_fee_percentage", "0");
    const recDiscount = await getSetting("recommended_discount_percentage", "40");
    const subjectsJson = await getSetting("subjects_by_semester", JSON.stringify(DEFAULT_SUBJECTS_BY_SEM));
    let subjectsBySem = DEFAULT_SUBJECTS_BY_SEM;
    try {
      const parsed = JSON.parse(subjectsJson);
      if (validateSubjectCatalog(parsed)) subjectsBySem = parsed;
    } catch {
      // Preserve the built-in catalogue if a legacy value is malformed.
    }
    res.json({
      platform_fee_percentage: Number(platformFee),
      recommended_discount_percentage: Number(recDiscount),
      subjects_by_sem: subjectsBySem,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/settings - Admin only update
router.patch("/", authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: "Only admins can update settings" });
    }

    const { platform_fee_percentage, recommended_discount_percentage, subjects_by_sem } = req.body;
    let updated = false;

    if (platform_fee_percentage !== undefined) {
      const val = Number(platform_fee_percentage);
      if (isNaN(val) || val < 0 || val > 100) {
        return res.status(400).json({ error: "Invalid platform fee percentage" });
      }
      await updateSetting("platform_fee_percentage", String(val));
      updated = true;
    }

    if (recommended_discount_percentage !== undefined) {
      const val = Number(recommended_discount_percentage);
      if (isNaN(val) || val < 0 || val > 100) {
        return res.status(400).json({ error: "Invalid recommended discount percentage" });
      }
      await updateSetting("recommended_discount_percentage", String(val));
      updated = true;
    }

    if (subjects_by_sem !== undefined) {
      if (!validateSubjectCatalog(subjects_by_sem)) {
        return res.status(400).json({ error: "Invalid subject catalogue" });
      }
      const normalized = normalizeSubjectCatalog(subjects_by_sem);
      await updateSetting("subjects_by_semester", JSON.stringify(normalized));
      updated = true;
    }

    if (!updated) {
      return res.status(400).json({ error: "No recognized settings provided or no changes made" });
    }

    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
