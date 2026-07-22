const bcrypt = require('bcrypt');

let sql = null;
let DB_ENABLED = !!process.env.DATABASE_URL;

const memUsers = [];
const memRegistrations = [];
const memEvents = [];
let memUserCounter = 0;
let memRegCounter = 0;
let memEventCounter = 0;

function getSQL() { return sql; }
function setSQL(s) { sql = s; }
function isDBEnabled() { return DB_ENABLED; }
function setDBEnabled(v) { DB_ENABLED = v; }

function getMemUsers() { return memUsers; }
function getMemRegistrations() { return memRegistrations; }
function getMemEvents() { return memEvents; }
function getNextUserId() { return ++memUserCounter; }
function getNextRegIdMem() { return ++memRegCounter; }
function getNextEventId() { return ++memEventCounter; }

function setMemCounters(userCount, regCount, eventCount) {
  if (userCount != null) memUserCounter = userCount;
  if (regCount != null) memRegCounter = regCount;
  if (eventCount != null) memEventCounter = eventCount;
}

async function initDB(sqlFn) {
  await sqlFn`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" VARCHAR NOT NULL COLLATE "default",
      "sess" JSONB NOT NULL,
      "expire" TIMESTAMP(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    )
  `;
  await sqlFn`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(200) UNIQUE NOT NULL,
      phone VARCHAR(30),
      password_hash VARCHAR(200) NOT NULL,
      display_name VARCHAR(100),
      role VARCHAR(20) DEFAULT 'user',
      profile_image TEXT,
      known_ip VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      event_date DATE,
      venue VARCHAR(200) DEFAULT 'Rochas Foundation, Ideato, Orlu, Imo State',
      status VARCHAR(20) DEFAULT 'upcoming',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reg_id VARCHAR(20) UNIQUE NOT NULL,
      event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(200) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      category VARCHAR(50) NOT NULL,
      sub_category VARCHAR(100),
      ticket_type VARCHAR(20) DEFAULT 'Regular',
      talent VARCHAR(100),
      talent_description TEXT,
      perf_time VARCHAR(50),
      profile_image TEXT,
      qr_code TEXT,
      payment_status VARCHAR(20) DEFAULT 'pending',
      payment_tx_ref VARCHAR(100),
      amount_paid NUMERIC(10,2) DEFAULT 0,
      checked_in BOOLEAN DEFAULT FALSE,
      checked_in_time TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS videos (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      video_type VARCHAR(20) NOT NULL,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT,
      category VARCHAR(100),
      duration VARCHAR(20),
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  console.log('✓ Database tables ready');
}

async function seedAdmin(sqlFn, password) {
  const hash = bcrypt.hashSync(password || 'admin123', 10);
  const existing = await sqlFn`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
  if (existing.length === 0) {
    await sqlFn`
      INSERT INTO users (username, email, phone, password_hash, display_name, role)
      VALUES ('admin', 'admin@silververse.com', '08000000000', ${hash}, 'SilverVerse Admin', 'admin')
    `;
    console.log('✓ Admin user seeded');
  }
}

async function seedEvent(sqlFn) {
  const existing = await sqlFn`SELECT id FROM events LIMIT 1`;
  if (existing.length === 0) {
    await sqlFn`
      INSERT INTO events (name, description, event_date, venue, status)
      VALUES (
        'Voices & Visions Festival 2026',
        'A grand celebration of talent, culture, and creativity.',
        '2026-08-01',
        'Rochas Foundation, Ideato, Orlu, Imo State',
        'upcoming'
      )
    `;
    console.log('✓ Default event seeded');
  }
}

async function seedTestUser(sqlFn) {
  const existing = await sqlFn`SELECT id FROM users WHERE username = 'testuser'`;
  if (existing.length === 0) {
    const hash = bcrypt.hashSync('test123', 10);
    await sqlFn`
      INSERT INTO users (username, email, phone, password_hash, display_name, role)
      VALUES ('testuser', 'test@silververse.com', '08000000000', ${hash}, 'Test User', 'user')
    `;
    console.log('✓ Test user seeded (testuser / test123)');
  }
}

async function seedVideos(sqlFn) {
  const existing = await sqlFn`SELECT id FROM videos LIMIT 1`;
  if (existing.length === 0) {
    const event = await sqlFn`SELECT id FROM events LIMIT 1`;
    const eventId = event.length > 0 ? event[0].id : null;
    const videos = [
      { title: 'Nigerian Idol — Best Auditions 2025', desc: 'Watch the most incredible auditions from Nigerian Idol 2025. Raw talent, powerful voices, and unforgettable moments.', url: 'https://www.youtube.com/watch?v=VIDEO_ID_1', cat: 'Music', dur: '12:34', sort: 1 },
      { title: "Africa's Got Talent — Incredible Performances", desc: 'Show-stopping performances from across Africa. Dance, music, and amazing acts that wowed the judges.', url: 'https://www.youtube.com/watch?v=VIDEO_ID_2', cat: 'Dance', dur: '8:21', sort: 2 },
      { title: 'Nigeria Comedy Talent Hunt — Highlights', desc: 'The funniest comedians from Nigeria compete for the crown. Side-splitting comedy and hilarious stand-up routines.', url: 'https://www.youtube.com/watch?v=VIDEO_ID_3', cat: 'Comedy', dur: '15:07', sort: 3 },
      { title: 'West Africa Drama Festival — Best Scenes', desc: 'Powerful dramatic performances from the best theatre groups across West Africa. Emotional and captivating storytelling.', url: 'https://www.youtube.com/watch?v=VIDEO_ID_4', cat: 'Drama', dur: '10:45', sort: 4 },
    ];
    for (const v of videos) {
      await sqlFn`
        INSERT INTO videos (event_id, title, description, video_type, video_url, category, duration, sort_order)
        VALUES (${eventId}, ${v.title}, ${v.desc}, 'youtube', ${v.url}, ${v.cat}, ${v.dur}, ${v.sort})
      `;
    }
    console.log('✓ 4 talent hunt videos seeded');
  }
}

async function setupDB(sqlFn) {
  if (!sqlFn) {
    console.log('⚠ Using in-memory store (data resets on restart)');
    return;
  }
  try {
    const testPromise = sqlFn`SELECT 1 as test`;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 5000));
    await Promise.race([testPromise, timeoutPromise]);
    console.log('✓ NeonDB connected');

    await initDB(sqlFn);
    await seedAdmin(sqlFn, process.env.ADMIN_PASSWORD || 'admin123');
    await seedEvent(sqlFn);
    await seedTestUser(sqlFn);
    await seedVideos(sqlFn);
  } catch (err) {
    console.error('⚠ Database unavailable, falling back to in-memory:', err.message);
    setDBEnabled(false);
  }
}

module.exports = {
  setupDB, getSQL, setSQL, isDBEnabled, setDBEnabled,
  getMemUsers, getMemRegistrations, getMemEvents,
  getNextUserId, getNextRegIdMem, getNextEventId, setMemCounters
};
