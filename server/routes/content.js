const express = require('express');
const router = express.Router();
const { getSQL, isDBEnabled, getMemContactSettings, getMemAboutContent, getMemRoadmapMilestones } = require('../db');

// GET /contact — Public contact settings
router.get('/contact', async (req, res) => {
  try {
    const result = {};
    if (isDBEnabled()) {
      const sql = getSQL();
      const rows = await sql`SELECT key, value FROM contact_settings`;
      for (const r of rows) result[r.key] = r.value;
    } else {
      const settings = getMemContactSettings();
      for (const s of settings) result[s.key] = s.value;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /about — Public about content
router.get('/about', async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const rows = await sql`SELECT section_key, title, content, image_url, updated_at FROM about_content ORDER BY id ASC`;
      return res.json({ success: true, data: rows });
    }
    const sections = getMemAboutContent();
    res.json({ success: true, data: sections.map(s => ({
      sectionKey: s.section_key,
      title: s.title,
      content: s.content,
      imageUrl: s.image_url,
      updatedAt: s.updated_at
    })) });
  } catch (err) {
    console.error('About error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /roadmap/:eventId — Public roadmap milestones
router.get('/roadmap/:eventId', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    if (isDBEnabled()) {
      const sql = getSQL();
      const rows = await sql`
        SELECT id, title, description, milestone_date, status, sort_order
        FROM roadmap_milestones WHERE event_id = ${eventId}
        ORDER BY sort_order ASC
      `;
      return res.json({ success: true, data: rows.map(r => ({
        id: r.id, title: r.title, description: r.description,
        milestoneDate: r.milestone_date, status: r.status, sortOrder: r.sort_order
      })) });
    }
    const milestones = getMemRoadmapMilestones().filter(m => m.event_id === eventId);
    milestones.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    res.json({ success: true, data: milestones.map(m => ({
      id: m.id, title: m.title, description: m.description,
      milestoneDate: m.milestone_date, status: m.status, sortOrder: m.sort_order
    })) });
  } catch (err) {
    console.error('Roadmap error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /blog — Public blog posts (published only)
router.get('/blog', async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const rows = await sql`
        SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image, bp.published_at,
               u.display_name as author_name, u.profile_image as author_image
        FROM blog_posts bp
        LEFT JOIN users u ON bp.author_id = u.id
        WHERE bp.published = true
        ORDER BY bp.published_at DESC
      `;
      return res.json({ success: true, data: rows });
    }
    res.json({ success: true, data: [] });
  } catch (err) {
    console.error('Blog list error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /blog/:slug — Single blog post
router.get('/blog/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (isDBEnabled()) {
      const sql = getSQL();
      const rows = await sql`
        SELECT bp.*, u.display_name as author_name, u.profile_image as author_image
        FROM blog_posts bp
        LEFT JOIN users u ON bp.author_id = u.id
        WHERE bp.slug = ${slug} AND bp.published = true
        LIMIT 1
      `;
      if (rows.length === 0) return res.status(404).json({ success: false, message: 'Post not found' });
      const post = rows[0];

      const comments = await sql`
        SELECT bc.id, bc.content, bc.created_at, u.display_name, u.profile_image
        FROM blog_comments bc
        LEFT JOIN users u ON bc.user_id = u.id
        WHERE bc.post_id = ${post.id}
        ORDER BY bc.created_at ASC
      `;

      const likes = await sql`SELECT COUNT(*)::int as count FROM blog_likes WHERE post_id = ${post.id}`;

      res.json({ success: true, data: { ...post, comments, likeCount: likes[0]?.count || 0 } });
    } else {
      res.status(404).json({ success: false, message: 'Post not found' });
    }
  } catch (err) {
    console.error('Blog post error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
