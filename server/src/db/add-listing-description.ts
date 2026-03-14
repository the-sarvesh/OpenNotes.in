import db from "./database.js";

const addListingDescription = async () => {
  try {
    console.log("🚀 Adding description column to listings...");
    await db.execute("ALTER TABLE listings ADD COLUMN description TEXT");
    console.log("✅ Description column added successfully.");
  } catch (error: any) {
    if (error.message?.includes("duplicate column")) {
      console.log("ℹ️ Description column already exists.");
    } else {
      console.error("❌ Failed to add description column:", error);
    }
  }
};

addListingDescription();
