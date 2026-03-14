import fetch from 'node-fetch'; // Using fetch from Node 18+ if available, otherwise polyfill

const API_URL = 'http://localhost:5000/api';
const SEED_USER = {
  email: 'seeder@pilani.bits-pilani.ac.in',
  password: 'password123',
  name: 'Seeder User'
};

const SEMESTERS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2"];
const MATERIAL_TYPES = ["handwritten", "printed", "digital", "other"];
const CONDITIONS = ["New", "Like New", "Good", "Fair", "Heavily Used"];
const COURSE_CODES = [
  "BITS F111", "MATH F111", "CHEM F111", "PHY F111", "CS F111",
  "EEE F211", "ECON F211", "MATH F211", "CS F211", "ME F211",
  "GS F211", "HSS F221", "CS F301", "EEE F311", "CHE F311",
  "MATH F311", "PHY F311", "BITS F411", "CS F411", "ME F411"
];
const TITLES = [
  "Complete Course Notes", "Handwritten Lectures", "Exam Preparation Guide",
  "Previous Year Questions Solved", "Formula Sheet & Summary", "Lab Manual & Reports",
  "Textbook Highlights", "Last Minute Revision Notes", "Problem Sets & Solutions",
  "Detailed Theory Notes"
];

async function seed() {
  console.log('🚀 Starting Seeding Process...');

  try {
    // 1. Register or Login Seeder User
    console.log('🔑 Logging in/Registering seeder user...');
    let response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SEED_USER.email, password: SEED_USER.password })
    });

    let data = await response.json();

    if (!response.ok) {
      console.log('📝 User not found, registering...');
      response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SEED_USER)
      });
      data = await response.json();
      if (!response.ok) {
        throw new Error(`Registration failed: ${data.error}`);
      }
    }

    const token = data.token;
    console.log('✅ Logged in successfully!');

    // 2. Generate and Create 100 Listings
    console.log('📦 Creating 100 listings...');
    for (let i = 1; i <= 100; i++) {
      const courseCode = COURSE_CODES[Math.floor(Math.random() * COURSE_CODES.length)];
      const titlePrefix = TITLES[Math.floor(Math.random() * TITLES.length)];
      const semester = SEMESTERS[Math.floor(Math.random() * SEMESTERS.length)];
      const materialType = MATERIAL_TYPES[Math.floor(Math.random() * MATERIAL_TYPES.length)];
      const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
      
      const listing = {
        title: `${titlePrefix} for ${courseCode} (Set ${i})`,
        course_code: courseCode,
        semester: semester,
        condition: condition,
        price: Math.floor(Math.random() * 500) + 50, // 50 to 550
        location: 'BITS Pilani Campus',
        quantity: Math.floor(Math.random() * 5) + 1,
        material_type: materialType,
        is_multiple_subjects: false,
        delivery_method: 'in_person',
        meetup_location: 'V-Mess Front'
      };

      // Since we don't have a file, the API uses a default image if none provided
      // But listings.ts Expects a multipart form if uploading.
      // However, it handles missing file by using a default Unsplash URL.
      // We need to send it as JSON or Multipart. The route uses upload.single("image")
      // Multer handles both multipart and if we send JSON without file, it might work if the body is parsed.
      
      const res = await fetch(`${API_URL}/listings`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(listing)
      });

      if (res.ok) {
        process.stdout.write(`\r✅ Created listing ${i}/100`);
      } else {
        const err = await res.json();
        console.error(`\r❌ Failed to create listing ${i}:`, err.error);
      }
    }

    console.log('\n\n✨ Seeding completed successfully!');
  } catch (err) {
    console.error('\n💥 Seeding failed:', err.message);
  }
}

seed();
