import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import db from "../db/database.js";
import { sendMail, passwordResetEmail } from "../utils/email.js";

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "opennotes-dev-secret-change-in-prod";
const JWT_EXPIRES_IN = "7d";
const RESET_TOKEN_EXPIRES_MINUTES = 30;

// ── Allowed email domains ─────────────────────────────────────────────────────
const ALLOWED_DOMAINS = [
  "pilani.bits-pilani.ac.in",
  "hyderabad.bits-pilani.ac.in",
  "goa.bits-pilani.ac.in",
  "wilp.bits-pilani.ac.in",
  // Testing / dev — remove or restrict before hard launch
];

const TESTING_EMAILS: string[] = [
  // Add specific test emails here, e.g.:
  // 'tester@example.com',
];

const isAllowedEmail = (email: string): boolean => {
  // ── Development Mode Toggle ────────────────────────────────────────────────
  // Allow all email domains in development
  if (process.env.NODE_ENV === "development") return true;

  const lower = email.toLowerCase().trim();
  if (TESTING_EMAILS.includes(lower)) return true;
  const domain = lower.split("@")[1];
  if (!domain) return false;
  return ALLOWED_DOMAINS.includes(domain);
};

// ── Rate limiters ─────────────────────────────────────────────────────────────

// max 10 auth attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// max 5 password reset requests per hour per IP
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    error: "Too many password reset requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Passport Google Strategy ──────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "dummy-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy-secret",
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:5000/api/auth/google/callback",
      proxy: true,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) {
          console.error(
            "Google Auth Error: No email found in profile",
            profile,
          );
          return done(new Error("No email found in Google profile"));
        }
        console.log("Processing Google Auth for email:", email);

        // ── Domain enforcement for Google sign-in ────────────────────────────
        if (!isAllowedEmail(email)) {
          console.warn(
            `Google OAuth blocked — disallowed email domain: ${email}`,
          );
          return done(null, false, {
            message: `Only BITS Pilani email addresses are allowed. Got: ${email.split("@")[1]}`,
          });
        }

        // Find or create user
        let result = await db.execute({
          sql: "SELECT * FROM users WHERE google_id = ? OR email = ?",
          args: [profile.id, email],
        });

        let user = result.rows[0];

        if (!user) {
          console.log("Creating new Google user:", email);
          const userId = uuidv4();
          await db.execute({
            sql: "INSERT INTO users (id, email, name, google_id, role, status) VALUES (?, ?, ?, ?, ?, ?)",
            args: [
              userId,
              email,
              profile.displayName,
              profile.id,
              "user",
              "active",
            ],
          });
          console.log("Successfully created new Google user:", userId);
          result = await db.execute({
            sql: "SELECT * FROM users WHERE id = ?",
            args: [userId],
          });
          user = result.rows[0];
        } else {
          // Check if user is blocked
          if (user.status === "blocked") {
            return done(null, false, {
              message: "Your account has been blocked.",
            });
          }

          // Link Google ID to existing email/password account
          if (!user.google_id) {
            console.log("Linking Google ID to existing user:", email);
            await db.execute({
              sql: "UPDATE users SET google_id = ? WHERE id = ?",
              args: [profile.id, user.id],
            });
            user.google_id = profile.id;
          }
        }

        return done(null, user as any);
      } catch (err: any) {
        console.error("Google Strategy Error:", err);
        return done(err);
      }
    },
  ),
);

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", authLimiter as any, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await db.execute({
      sql: "SELECT * FROM users WHERE email = ?",
      args: [email],
    });

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.status === "blocked") {
      return res.status(403).json({
        error:
          "Your account has been blocked by an administrator. Please contact support if you believe this is an error.",
      });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        error: "This account uses Google Login. Please sign in with Google.",
      });
    }

    const isValidPassword = await bcrypt.compare(
      password,
      user.password_hash as string,
    );
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        upi_id: user.upi_id,
        role: user.role || "user",
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", authLimiter as any, async (req, res, next) => {
  try {
    const { email, password, name, upi_id } = req.body;

    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "Email, password, and name are required" });
    }

    // ── Domain enforcement ───────────────────────────────────────────────────
    if (!isAllowedEmail(email)) {
      const domain = email.split("@")[1] || "unknown";
      return res.status(403).json({
        error: `Registration is restricted to BITS Pilani email addresses. "${domain}" is not an allowed domain.`,
      });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }

    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.execute({
      sql: "INSERT INTO users (id, email, name, password_hash, upi_id) VALUES (?, ?, ?, ?, ?)",
      args: [userId, email, name, hashedPassword, upi_id || null],
    });

    const token = jwt.sign({ id: userId, email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: userId,
        email,
        name,
        upi_id,
        role: "user",
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const getUrls = (req: any) => {
  const origin = req.get("origin") || req.get("referer");

  let frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
  const host = req.get("host");
  const protocol = req.protocol;
  let callbackUrl =
    process.env.GOOGLE_CALLBACK_URL ||
    `${protocol}://${host}/api/auth/google/callback`;

  if (
    origin &&
    (origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.match(/\d+\.\d+\.\d+\.\d+/))
  ) {
    const url = new URL(origin);
    frontendUrl = `${url.protocol}//${url.host}`;
  }

  return { frontendUrl, callbackUrl };
};

// ── GET /api/auth/google — initiate OAuth ────────────────────────────────────
router.get("/google", (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    callbackURL:
      req.query.device === "true"
        ? process.env.GOOGLE_CALLBACK_URL || "http://192.168.1.52:5000/api/auth/google/callback"
        : process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:5000/api/auth/google/callback",
  } as any)(req, res, next);
});

// ── GET /api/auth/google/callback ────────────────────────────────────────────
router.get("/google/callback", (req, res, next) => {
  const { frontendUrl, callbackUrl } = getUrls(req);

  passport.authenticate(
    "google",
    {
      session: false,
      callbackURL: callbackUrl,
    } as any,
    (err: any, user: any, info: any) => {
      console.log("[Auth Callback] Start", { hasUser: !!user, hasErr: !!err, info });
      if (err) {
        console.error("[Auth Callback] Error:", err);
        return next(err);
      }

      if (!user) {
        console.warn("[Auth Callback] No user found", info);
        if (info?.message === "Your account has been blocked.") {
          return res.redirect(`${frontendUrl}/?error=blocked`);
        }
        const msg = encodeURIComponent(
          info?.message || "Authentication failed",
        );
        return res.redirect(`${frontendUrl}/?error=auth_failed&reason=${msg}`);
      }

      console.log("[Auth Callback] Success for user:", user.email);
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const params = new URLSearchParams({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
      });

      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    },
  )(req, res, next);
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Accepts { email }. Always responds 200 to prevent user enumeration.
router.post("/forgot-password", resetLimiter as any, async (req, res, next) => {
  const GENERIC_OK = {
    message:
      "If an account with that email exists, a reset link has been sent.",
  };

  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }

    const userRes = await db.execute({
      sql: "SELECT id, name, email, password_hash FROM users WHERE email = ?",
      args: [email.toLowerCase().trim()],
    });

    const user = userRes.rows[0];

    // No user found or Google-only account → silent success
    if (!user || !user.password_hash) {
      return res.json(GENERIC_OK);
    }

    // Invalidate any existing tokens for this user
    await db.execute({
      sql: "UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0",
      args: [user.id],
    });

    const rawToken = randomBytes(32).toString("hex");
    const tokenId = uuidv4();
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000,
    ).toISOString();

    await db.execute({
      sql: `INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
            VALUES (?, ?, ?, ?)`,
      args: [tokenId, user.id, rawToken, expiresAt],
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    const mailOpts = passwordResetEmail(
      user.name as string,
      resetUrl,
      RESET_TOKEN_EXPIRES_MINUTES,
    );
    mailOpts.to = user.email as string;
    await sendMail(mailOpts);

    return res.json(GENERIC_OK);
  } catch (error) {
    next(error);
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Accepts { token, new_password }. Verifies token and updates the password.
router.post("/reset-password", resetLimiter as any, async (req, res, next) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res
        .status(400)
        .json({ error: "token and new_password are required" });
    }

    if ((new_password as string).length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const tokenRes = await db.execute({
      sql: `SELECT prt.id as token_id, prt.user_id, u.email, u.name
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.id
            WHERE prt.token = ?
              AND prt.used = 0
              AND prt.expires_at > CURRENT_TIMESTAMP`,
      args: [token],
    });

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({
        error:
          "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    const row = tokenRes.rows[0];
    const hashedPassword = await bcrypt.hash(new_password as string, 10);

    await db.execute({
      sql: "UPDATE users SET password_hash = ? WHERE id = ?",
      args: [hashedPassword, row.user_id],
    });

    // Mark all tokens for this user as used
    await db.execute({
      sql: "UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?",
      args: [row.user_id],
    });

    res.json({ message: "Password updated successfully. You can now log in." });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token");
  res.json({ message: "Logged out successfully" });
});

export default router;
