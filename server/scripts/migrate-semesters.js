import db from '../src/db/database.js';

const mapping = {
  '1-1': 'Sem1',
  '1-2': 'Sem2',
  '2-1': 'Sem3',
  '2-2': 'Sem4',
  '3-1': 'Sem5',
  '3-2': 'Sem6',
  '4-1': 'Sem7',
  '4-2': 'Sem8'
};

async function migrate() {
  console.log('🔄 Starting semester migration...');
  
  try {
    for (const [oldVal, newVal] of Object.entries(mapping)) {
      const res = await db.execute({
        sql: 'UPDATE listings SET semester = ? WHERE semester = ?',
        args: [newVal, oldVal]
      });
      console.log(`✅ Updated ${res.rowsAffected} listings from ${oldVal} to ${newVal}`);
    }
    console.log('✨ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
