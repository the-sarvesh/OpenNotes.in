import express from "express";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { getSetting, updateSetting } from "../utils/settings.js";

const router = express.Router();

// GET /api/settings - Public settings (platform_fee, etc)
router.get("/", async (req, res, next) => {
  try {
    const platformFee = await getSetting("platform_fee_percentage", "0");
    const recDiscount = await getSetting("recommended_discount_percentage", "40");
    res.json({
      platform_fee_percentage: Number(platformFee),
      recommended_discount_percentage: Number(recDiscount),
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

    const { platform_fee_percentage, recommended_discount_percentage } = req.body;
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

    if (!updated) {
      return res.status(400).json({ error: "No recognized settings provided or no changes made" });
    }

    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
