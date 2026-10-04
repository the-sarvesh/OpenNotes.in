import express from "express";
import rateLimit from "express-rate-limit";
import db from "../db/database.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import { extractMarks, rollNumberFromEmail } from "../utils/results.js";

const router = express.Router();
const upstream = process.env.RESULTS_UPSTREAM_URL ||
  "http://wilp-bits-sri1.us-east-1.elasticbeanstalk.com/api/students/courses";

const resultsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user!.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many result checks. Please try again later." },
});

router.get("/me", authenticate as any, resultsLimiter as any, async (req: AuthRequest, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const rollNumber = rollNumberFromEmail(req.user!.email);
  if (!rollNumber) {
    return res.status(403).json({ error: "Results require a verified roll-number WILP email account." });
  }

  try {
    const account = await db.execute({
      sql: "SELECT is_verified FROM users WHERE id = ?",
      args: [req.user!.id],
    });
    if (Number(account.rows[0]?.is_verified) !== 1) {
      return res.status(403).json({ error: "Verify your WILP email before viewing results." });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(upstream, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ bitsId: rollNumber }),
        signal: controller.signal,
        redirect: "error",
      });
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 404) return res.json({ rollNumber, name: null, rows: [] });
    if (!response.ok) return res.status(502).json({ error: "Results service is unavailable. Please try again." });
    const marks = extractMarks(await response.json());
    return res.json({ rollNumber, ...marks });
  } catch {
    return res.status(502).json({ error: "Could not load results. Please try again." });
  }
});

export default router;
