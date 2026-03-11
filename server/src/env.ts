import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory first, then root
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

// ── Security: Hard-fail if JWT_SECRET is missing in production ──────────────
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error(
    "[FATAL] JWT_SECRET environment variable is not set in production. " +
      "Server startup aborted to prevent insecure token signing.",
  );
  process.exit(1);
}

if (process.env.NODE_ENV !== "production" && !process.env.JWT_SECRET) {
  console.warn(
    "[WARN] JWT_SECRET is not set. Using the insecure development fallback. " +
      "This MUST be set before going to production.",
  );
}
