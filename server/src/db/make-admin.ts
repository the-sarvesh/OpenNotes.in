// Usage: npx tsx server/src/db/make-admin.ts <email>
import db from './database.js';

const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx server/src/db/make-admin.ts <email>');
  process.exit(1);
}

const run = async () => {
  const result = await db.execute({
    sql: 'SELECT id, name, role FROM users WHERE email = ?',
    args: [email]
  });

  if (result.rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  await db.execute({
    sql: "UPDATE users SET role = 'admin' WHERE email = ?",
    args: [email]
  });

  console.log(`✅ User "${result.rows[0].name}" (${email}) is now an admin.`);
};

run().catch(console.error);
