import db from "./database.js";

async function migrate() {
  console.log("Starting conversation migration...");

  try {
    // 1. Update messages table
    const messages = await db.execute("SELECT id, conversation_id FROM messages");
    console.log(`Found ${messages.rows.length} messages to check.`);

    for (const row of messages.rows) {
      const oldId = row.conversation_id as string;
      const parts = oldId.split("_");
      
      // If it has 3 parts (user1, user2, listingId), migrate it
      if (parts.length === 3) {
        const newId = `${parts[0]}_${parts[1]}`;
        await db.execute({
          sql: "UPDATE messages SET conversation_id = ? WHERE id = ?",
          args: [newId, row.id]
        });
      }
    }
    console.log("Messages table migration complete.");

    // 2. Update meetup_proposals table
    const proposals = await db.execute("SELECT id, conversation_id FROM meetup_proposals");
    console.log(`Found ${proposals.rows.length} meetup proposals to check.`);

    for (const row of proposals.rows) {
      const oldId = row.conversation_id as string;
      const parts = oldId.split("_");
      
      if (parts.length === 3) {
        const newId = `${parts[0]}_${parts[1]}`;
        await db.execute({
          sql: "UPDATE meetup_proposals SET conversation_id = ? WHERE id = ?",
          args: [newId, row.id]
        });
      }
    }
    console.log("Meetup proposals table migration complete.");

    console.log("Migration finished successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

migrate();
