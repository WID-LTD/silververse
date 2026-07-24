const bcrypt = require('bcrypt');

let sql = null;
let DB_ENABLED = !!process.env.DATABASE_URL;

const memUsers = [];
const memRegistrations = [];
const memEvents = [];
const memBlogPosts = [];
const memBlogComments = [];
const memBlogLikes = [];
const memRoadmapMilestones = [];
const memContactSettings = [];
const memAboutContent = [];
const memVideos = [];
let memUserCounter = 0;
let memRegCounter = 0;
let memEventCounter = 0;
let memBlogPostCounter = 0;
let memBlogCommentCounter = 0;
let memBlogLikeCounter = 0;
let memRoadmapCounter = 0;
let memContactSettingCounter = 0;
let memAboutCounter = 0;

function getSQL() { return sql; }
function setSQL(s) { sql = s; }
function isDBEnabled() { return DB_ENABLED; }
function setDBEnabled(v) { DB_ENABLED = v; }

function getMemUsers() { return memUsers; }
function getMemRegistrations() { return memRegistrations; }
function getMemEvents() { return memEvents; }
function getMemBlogPosts() { return memBlogPosts; }
function getMemBlogComments() { return memBlogComments; }
function getMemBlogLikes() { return memBlogLikes; }
function getMemRoadmapMilestones() { return memRoadmapMilestones; }
function getMemContactSettings() { return memContactSettings; }
function getMemAboutContent() { return memAboutContent; }
function getMemVideos() { return memVideos; }
function getNextUserId() { return ++memUserCounter; }
function getNextRegIdMem() { return ++memRegCounter; }
function getNextEventId() { return ++memEventCounter; }
function getNextBlogPostId() { return ++memBlogPostCounter; }
function getNextBlogCommentId() { return ++memBlogCommentCounter; }
function getNextBlogLikeId() { return ++memBlogLikeCounter; }
function getNextRoadmapId() { return ++memRoadmapCounter; }
function getNextContactSettingId() { return ++memContactSettingCounter; }
function getNextAboutId() { return ++memAboutCounter; }

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

  await sqlFn`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false`;
  await sqlFn`ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time TIME DEFAULT '09:00:00'`;
  await sqlFn`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT false`;
  try { await sqlFn`CREATE UNIQUE INDEX IF NOT EXISTS idx_events_single_main ON events ((true::boolean)) WHERE is_main = true`; } catch(_) {}

  await sqlFn`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(300) NOT NULL,
      slug VARCHAR(300) UNIQUE NOT NULL,
      content TEXT,
      excerpt TEXT,
      featured_image TEXT,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      published BOOLEAN DEFAULT false,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS blog_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS blog_likes (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES blog_posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS roadmap_milestones (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      milestone_date VARCHAR(100),
      status VARCHAR(20) DEFAULT 'upcoming',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS contact_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sqlFn`
    CREATE TABLE IF NOT EXISTS about_content (
      id SERIAL PRIMARY KEY,
      section_key VARCHAR(100) UNIQUE NOT NULL,
      title VARCHAR(300),
      content TEXT,
      image_url TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
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
      INSERT INTO events (name, description, event_date, venue, status, is_main)
      VALUES (
        'Voices & Visions Festival 2026',
        'A grand celebration of talent, culture, and creativity.',
        '2026-08-01',
        'Rochas Foundation, Ideato, Orlu, Imo State',
        'upcoming',
        true
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
      { title: 'Nigerian Idol — Best Auditions 2025', desc: 'Watch the most incredible auditions from Nigerian Idol 2025. Raw talent, powerful voices, and unforgettable moments.', url: 'https://www.youtube.com/watch?v=2Vv-BfVoq4g', cat: 'Music', dur: '12:34', sort: 1 },
      { title: "Africa's Got Talent — Incredible Performances", desc: 'Show-stopping performances from across Africa. Dance, music, and amazing acts that wowed the judges.', url: 'https://www.youtube.com/watch?v=5vPm1iE8FJk', cat: 'Dance', dur: '8:21', sort: 2 },
      { title: 'Nigeria Comedy Talent Hunt — Highlights', desc: 'The funniest comedians from Nigeria compete for the crown. Side-splitting comedy and hilarious stand-up routines.', url: 'https://www.youtube.com/watch?v=vFqFynv0oGo', cat: 'Comedy', dur: '15:07', sort: 3 },
      { title: 'Voices & Visions Festival — Grand Finale Teaser', desc: 'Powerful performances from the Voices & Visions Festival grand finale. Emotional and captivating moments from the stage.', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', cat: 'Drama', dur: '10:45', sort: 4 },
    ];
    for (const v of videos) {
      await sqlFn`
        INSERT INTO videos (event_id, title, description, video_type, video_url, category, duration, sort_order)
        VALUES (${eventId}, ${v.title}, ${v.desc}, 'youtube', ${v.url}, ${v.cat}, ${v.dur}, ${v.sort})
      `;
    }
    console.log('✓ 4 talent hunt videos seeded');
  } else {
    // Fix existing records with placeholder URLs
    await sqlFn`UPDATE videos SET video_url = 'https://www.youtube.com/watch?v=2Vv-BfVoq4g' WHERE video_url LIKE '%VIDEO_ID_1%'`;
    await sqlFn`UPDATE videos SET video_url = 'https://www.youtube.com/watch?v=5vPm1iE8FJk' WHERE video_url LIKE '%VIDEO_ID_2%'`;
    await sqlFn`UPDATE videos SET video_url = 'https://www.youtube.com/watch?v=vFqFynv0oGo' WHERE video_url LIKE '%VIDEO_ID_3%'`;
    await sqlFn`UPDATE videos SET video_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' WHERE video_url LIKE '%VIDEO_ID_4%'`;
    console.log('✓ Existing video URLs fixed');
  }
}

async function seedRoadmap(sqlFn) {
  const existing = await sqlFn`SELECT id FROM roadmap_milestones LIMIT 1`;
  if (existing.length === 0) {
    const event = await sqlFn`SELECT id FROM events WHERE is_trending = true LIMIT 1`;
    let eventId = event.length > 0 ? event[0].id : null;
    if (!eventId) {
      const evt = await sqlFn`SELECT id FROM events LIMIT 1`;
      eventId = evt.length > 0 ? evt[0].id : null;
    }
    if (eventId) {
      const milestones = [
        { title: 'Registration Open', desc: 'Registration is now open. Secure your spot at the Voices & Visions Festival.', date: 'January 2026', status: 'completed', sort: 1 },
        { title: 'Training & Mentorship', desc: 'Contestants receive intensive training and mentorship from industry professionals.', date: 'March – July 2026', status: 'live', sort: 2 },
        { title: 'Auditions & Selection', desc: 'Auditions across multiple zones. Only the best advance to the grand stage.', date: 'August 2026', status: 'upcoming', sort: 3 },
        { title: 'Grand Finale LIVE', desc: 'The Voices & Visions Festival Grand Finale. The ultimate showcase of talent.', date: '15 August 2026', status: 'upcoming', sort: 4 },
      ];
      for (const m of milestones) {
        await sqlFn`
          INSERT INTO roadmap_milestones (event_id, title, description, milestone_date, status, sort_order)
          VALUES (${eventId}, ${m.title}, ${m.desc}, ${m.date}, ${m.status}, ${m.sort})
        `;
      }
      console.log('✓ Roadmap milestones seeded');
    }
  }
}

async function seedContactSettings(sqlFn) {
  const existing = await sqlFn`SELECT id FROM contact_settings LIMIT 1`;
  if (existing.length === 0) {
    const settings = [
      { key: 'email', value: 'silververse.ng@gmail.com' },
      { key: 'phone1', value: '08132521005' },
      { key: 'phone2', value: '09071778724' },
      { key: 'whatsapp', value: '08132521005' },
      { key: 'address', value: 'Orlu, Imo State, Nigeria' },
      { key: 'social_instagram', value: '@silververse' },
      { key: 'social_twitter', value: '@silververse' },
      { key: 'social_facebook', value: 'SilverVerse' },
      { key: 'support_email', value: 'silververse.ng@gmail.com' },
    ];
    for (const s of settings) {
      await sqlFn`
        INSERT INTO contact_settings (key, value) VALUES (${s.key}, ${s.value})
      `;
    }
    console.log('✓ Contact settings seeded');
  }
}

async function seedAboutContent(sqlFn) {
  const existing = await sqlFn`SELECT id FROM about_content LIMIT 1`;
  if (existing.length === 0) {
    const sections = [
      {
        key: 'hero',
        title: 'About SilverVerse',
        content: 'SilverVerse is a premier talent discovery and entertainment platform dedicated to unearthing the next generation of African creative geniuses. Through the annual Voices & Visions Festival, we provide a world-class stage for performers, artists, and visionaries to showcase their craft, connect with industry leaders, and launch their careers.',
        image_url: ''
      },
      {
        key: 'mission',
        title: 'Our Mission',
        content: 'To discover, nurture, and amplify the voices of emerging talents across Africa — providing them with the platform, mentorship, and exposure needed to transform their passion into a sustainable profession. We believe every voice matters and every vision deserves a stage.',
        image_url: ''
      },
      {
        key: 'story',
        title: 'Our Story',
        content: 'SilverVerse was born from a simple observation: Africa is overflowing with raw, untapped talent, but lacks the structured platforms to showcase it. Founded by a team of passionate creatives and technology entrepreneurs, SilverVerse bridges this gap by combining the power of live events with digital innovation. What started as a small community gathering has grown into the Voices & Visions Festival — a nationally recognised celebration of talent, culture, and creativity. From humble beginnings, we have empowered hundreds of contestants, partnered with industry leaders, and built a community of thousands who share our vision of a thriving African creative economy.',
        image_url: ''
      },
      {
        key: 'team',
        title: 'Meet Our Team',
        content: 'Behind SilverVerse is a dedicated team of event professionals, tech innovators, media experts, and talent scouts who work tirelessly year-round to make the Voices & Visions Festival a world-class experience. From stage design to digital strategy, every detail is crafted with passion and precision. Our leadership brings decades of combined experience in entertainment, technology, and community building.',
        image_url: ''
      },
      {
        key: 'cta',
        title: 'Be Part of the Movement',
        content: 'Whether you are a performer ready to take the stage, a volunteer supporting the mission, a sponsor investing in the future, or a fan cheering from the audience — there is a place for you at SilverVerse. Join us as we discover, celebrate, and elevate the brightest talents Africa has to offer.',
        image_url: ''
      },
    ];
    for (const s of sections) {
      await sqlFn`
        INSERT INTO about_content (section_key, title, content, image_url)
        VALUES (${s.key}, ${s.title}, ${s.content}, ${s.image_url})
      `;
    }
    console.log('✓ About content seeded');
  }
}

async function setupDB(sqlFn) {
  if (!sqlFn) {
    console.log('⚠ Using in-memory store (data resets on restart)');
    seedInMemory();
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
    await seedRoadmap(sqlFn);
    await seedContactSettings(sqlFn);
    await seedAboutContent(sqlFn);
  } catch (err) {
    console.error('⚠ Database unavailable, falling back to in-memory:', err.message);
    setDBEnabled(false);
    seedInMemory();
  }
}

function seedInMemory() {
  const bcrypt = require('bcrypt');
  const adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10);
  const userHash = bcrypt.hashSync('test123', 10);

  if (memUsers.length === 0) {
    memUsers.push({ id: 1, username: 'admin', email: 'admin@silververse.com', phone: '08000000000', password_hash: adminHash, display_name: 'SilverVerse Admin', role: 'admin', profile_image: '', known_ip: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    memUsers.push({ id: 2, username: 'testuser', email: 'test@silververse.com', phone: '08000000000', password_hash: userHash, display_name: 'Test User', role: 'user', profile_image: '', known_ip: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    memUserCounter = 2;
    console.log('✓ In-memory: admin + test user seeded');
  }

  if (memEvents.length === 0) {
    memEvents.push({ id: 1, name: 'Voices & Visions Festival 2026', description: 'A grand celebration of talent, culture, and creativity.', event_date: '2026-08-01', event_time: '09:00:00', venue: 'Rochas Foundation, Ideato, Orlu, Imo State', status: 'upcoming', is_trending: true, is_main: true, created_at: new Date().toISOString() });
    memEventCounter = 1;
    console.log('✓ In-memory: default event seeded');
  }

  if (memRoadmapMilestones.length === 0) {
    const milestones = [
      { title: 'Registration Open', desc: 'Registration is now open. Secure your spot at the Voices & Visions Festival.', date: 'January 2026', status: 'completed', sort: 1 },
      { title: 'Training & Mentorship', desc: 'Contestants receive intensive training and mentorship from industry professionals.', date: 'March – July 2026', status: 'live', sort: 2 },
      { title: 'Auditions & Selection', desc: 'Auditions across multiple zones. Only the best advance to the grand stage.', date: 'August 2026', status: 'upcoming', sort: 3 },
      { title: 'Grand Finale LIVE', desc: 'The Voices & Visions Festival Grand Finale. The ultimate showcase of talent.', date: '15 August 2026', status: 'upcoming', sort: 4 },
    ];
    milestones.forEach((m, i) => {
      memRoadmapMilestones.push({ id: i + 1, event_id: 1, title: m.title, description: m.desc, milestone_date: m.date, status: m.status, sort_order: m.sort, created_at: new Date().toISOString() });
    });
    memRoadmapCounter = milestones.length;
    console.log('✓ In-memory: roadmap milestones seeded');
  }

  if (memContactSettings.length === 0) {
    const settings = [
      { key: 'email', value: 'silververse.ng@gmail.com' },
      { key: 'phone1', value: '08132521005' },
      { key: 'phone2', value: '09071778724' },
      { key: 'whatsapp', value: '08132521005' },
      { key: 'address', value: 'Orlu, Imo State, Nigeria' },
      { key: 'social_instagram', value: '@silververse' },
      { key: 'social_twitter', value: '@silververse' },
      { key: 'social_facebook', value: 'SilverVerse' },
      { key: 'support_email', value: 'silververse.ng@gmail.com' },
    ];
    settings.forEach((s, i) => {
      memContactSettings.push({ id: i + 1, key: s.key, value: s.value, updated_at: new Date().toISOString() });
    });
    memContactSettingCounter = settings.length;
    console.log('✓ In-memory: contact settings seeded');
  }

  if (memAboutContent.length === 0) {
    const sections = [
      { key: 'hero', title: 'About SilverVerse', content: 'SilverVerse is a premier talent discovery and entertainment platform dedicated to unearthing the next generation of African creative geniuses. Through the annual Voices & Visions Festival, we provide a world-class stage for performers, artists, and visionaries to showcase their craft, connect with industry leaders, and launch their careers.', image_url: '' },
      { key: 'mission', title: 'Our Mission', content: 'To discover, nurture, and amplify the voices of emerging talents across Africa — providing them with the platform, mentorship, and exposure needed to transform their passion into a sustainable profession. We believe every voice matters and every vision deserves a stage.', image_url: '' },
      { key: 'story', title: 'Our Story', content: 'SilverVerse was born from a simple observation: Africa is overflowing with raw, untapped talent, but lacks the structured platforms to showcase it. Founded by a team of passionate creatives and technology entrepreneurs, SilverVerse bridges this gap by combining the power of live events with digital innovation. What started as a small community gathering has grown into the Voices & Visions Festival — a nationally recognised celebration of talent, culture, and creativity.', image_url: '' },
      { key: 'team', title: 'Meet Our Team', content: 'Behind SilverVerse is a dedicated team of event professionals, tech innovators, media experts, and talent scouts who work tirelessly year-round to make the Voices & Visions Festival a world-class experience.', image_url: '' },
      { key: 'cta', title: 'Be Part of the Movement', content: 'Whether you are a performer ready to take the stage, a volunteer supporting the mission, a sponsor investing in the future, or a fan cheering from the audience — there is a place for you at SilverVerse.', image_url: '' },
    ];
    sections.forEach((s, i) => {
      memAboutContent.push({ id: i + 1, section_key: s.key, title: s.title, content: s.content, image_url: s.image_url, updated_at: new Date().toISOString() });
    });
    memAboutCounter = sections.length;
    console.log('✓ In-memory: about content seeded');
  }

  if (memVideos.length === 0) {
    const videos = [
      { title: 'Nigerian Idol — Best Auditions 2025', desc: 'Watch the most incredible auditions from Nigerian Idol 2025. Raw talent, powerful voices, and unforgettable moments.', url: 'https://www.youtube.com/watch?v=2Vv-BfVoq4g', cat: 'Music', dur: '12:34', sort: 1 },
      { title: "Africa's Got Talent — Incredible Performances", desc: 'Show-stopping performances from across Africa. Dance, music, and amazing acts that wowed the judges.', url: 'https://www.youtube.com/watch?v=5vPm1iE8FJk', cat: 'Dance', dur: '8:21', sort: 2 },
      { title: 'Nigeria Comedy Talent Hunt — Highlights', desc: 'The funniest comedians from Nigeria compete for the crown. Side-splitting comedy and hilarious stand-up routines.', url: 'https://www.youtube.com/watch?v=vFqFynv0oGo', cat: 'Comedy', dur: '15:07', sort: 3 },
      { title: 'Voices & Visions Festival — Grand Finale Teaser', desc: 'Powerful performances from the Voices & Visions Festival grand finale. Emotional and captivating moments from the stage.', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', cat: 'Drama', dur: '10:45', sort: 4 },
    ];
    videos.forEach((v, i) => {
      memVideos.push({ id: i + 1, event_id: 1, title: v.title, description: v.desc, video_type: 'youtube', video_url: v.url, thumbnail_url: '', category: v.cat, duration: v.dur, sort_order: v.sort, created_at: new Date().toISOString() });
    });
    console.log('✓ In-memory: 4 talent hunt videos seeded');
  }
}

module.exports = {
  setupDB, getSQL, setSQL, isDBEnabled, setDBEnabled,
  getMemUsers, getMemRegistrations, getMemEvents,
  getMemBlogPosts, getMemBlogComments, getMemBlogLikes,
  getMemRoadmapMilestones, getMemContactSettings, getMemAboutContent,
  getMemVideos,
  getNextUserId, getNextRegIdMem, getNextEventId, setMemCounters
};
