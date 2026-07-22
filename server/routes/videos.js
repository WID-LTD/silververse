const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSQL, isDBEnabled, getMemVideos } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

let memVideoCounter = 0;

const R2_ENABLED = !!process.env.R2_ENDPOINT;
const r2Client = R2_ENABLED ? new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
}) : null;
const R2_BUCKET = process.env.R2_BUCKET || 'silververse-uploads';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
    cb(null, allowed.includes(file.mimetype));
  }
});

function camelRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id || row.eventId,
    title: row.title,
    description: row.description,
    videoType: row.video_type || row.videoType,
    videoUrl: row.video_url || row.videoUrl,
    thumbnailUrl: row.thumbnail_url || row.thumbnailUrl,
    category: row.category,
    duration: row.duration,
    sortOrder: row.sort_order || row.sortOrder || 0,
    createdAt: row.created_at || row.createdAt,
  };
}

// GET / - List all videos (public), supports ?category=
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;

    if (isDBEnabled()) {
      const sql = getSQL();
      let result;
      if (category) {
        result = await sql`SELECT * FROM videos WHERE category = ${category} ORDER BY sort_order ASC, id DESC`;
      } else {
        result = await sql`SELECT * FROM videos ORDER BY sort_order ASC, id DESC`;
      }
      res.json({ success: true, data: result.map(camelRow) });
    } else {
      let filtered = [...getMemVideos()];
      if (category) {
        filtered = filtered.filter(v => v.category === category);
      }
      filtered.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || b.id - a.id);
      res.json({ success: true, data: filtered.map(camelRow) });
    }
  } catch (err) {
    console.error('List videos error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id - Single video (public)
router.get('/:id', async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`SELECT * FROM videos WHERE id = ${parseInt(req.params.id)}`;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Video not found' });
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const video = getMemVideos().find(v => v.id === parseInt(req.params.id));
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });
      res.json({ success: true, data: camelRow(video) });
    }
  } catch (err) {
    console.error('Get video error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST / - Create video (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { eventId, title, description, videoType, videoUrl, thumbnailUrl, category, duration, sortOrder } = req.body;
    if (!title || !videoType || !videoUrl) {
      return res.status(400).json({ success: false, message: 'title, videoType, and videoUrl are required' });
    }

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        INSERT INTO videos (event_id, title, description, video_type, video_url, thumbnail_url, category, duration, sort_order)
        VALUES (${eventId || null}, ${title}, ${description || ''}, ${videoType}, ${videoUrl}, ${thumbnailUrl || ''}, ${category || ''}, ${duration || ''}, ${sortOrder || 0})
        RETURNING *
      `;
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const video = {
        id: ++memVideoCounter,
        event_id: eventId || null,
        title,
        description: description || '',
        video_type: videoType,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl || '',
        category: category || '',
        duration: duration || '',
        sort_order: sortOrder || 0,
        created_at: new Date().toISOString(),
      };
      getMemVideos().push(video);
      res.json({ success: true, data: camelRow(video) });
    }
  } catch (err) {
    console.error('Create video error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id - Update video (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { eventId, title, description, videoType, videoUrl, thumbnailUrl, category, duration, sortOrder } = req.body;

    if (isDBEnabled()) {
      const sql = getSQL();
      const existing = await sql`SELECT * FROM videos WHERE id = ${parseInt(req.params.id)}`;
      if (existing.length === 0) return res.status(404).json({ success: false, message: 'Video not found' });

      const v = existing[0];
      const result = await sql`
        UPDATE videos SET
          event_id = ${eventId !== undefined ? eventId : v.event_id},
          title = ${title || v.title},
          description = ${description !== undefined ? description : v.description},
          video_type = ${videoType || v.video_type},
          video_url = ${videoUrl || v.video_url},
          thumbnail_url = ${thumbnailUrl !== undefined ? thumbnailUrl : v.thumbnail_url},
          category = ${category !== undefined ? category : v.category},
          duration = ${duration !== undefined ? duration : v.duration},
          sort_order = ${sortOrder !== undefined ? sortOrder : v.sort_order}
        WHERE id = ${parseInt(req.params.id)}
        RETURNING *
      `;
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const video = getMemVideos().find(v => v.id === parseInt(req.params.id));
      if (!video) return res.status(404).json({ success: false, message: 'Video not found' });

      if (eventId !== undefined) video.event_id = eventId;
      if (title) video.title = title;
      if (description !== undefined) video.description = description;
      if (videoType) video.video_type = videoType;
      if (videoUrl) video.video_url = videoUrl;
      if (thumbnailUrl !== undefined) video.thumbnail_url = thumbnailUrl;
      if (category !== undefined) video.category = category;
      if (duration !== undefined) video.duration = duration;
      if (sortOrder !== undefined) video.sort_order = sortOrder;

      res.json({ success: true, data: camelRow(video) });
    }
  } catch (err) {
    console.error('Update video error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id - Delete video (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`DELETE FROM videos WHERE id = ${parseInt(req.params.id)} RETURNING id, title`;
      if (result.length === 0) return res.status(404).json({ success: false, message: 'Video not found' });
      res.json({ success: true, message: `Video "${result[0].title}" deleted` });
    } else {
      const idx = getMemVideos().findIndex(v => v.id === parseInt(req.params.id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Video not found' });
      const deleted = getMemVideos().splice(idx, 1)[0];
      res.json({ success: true, message: `Video "${deleted.title}" deleted` });
    }
  } catch (err) {
    console.error('Delete video error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /upload - Upload video file to R2 (admin only)
router.post('/upload', requireAdmin, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No video file provided' });

    if (!R2_ENABLED || !r2Client) {
      return res.status(503).json({ success: false, message: 'R2 storage not configured' });
    }

    const ext = req.file.mimetype.split('/')[1] === 'quicktime' ? 'mov' : req.file.mimetype.split('/')[1];
    const key = `videos/${crypto.randomBytes(12).toString('hex')}.${ext}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const url = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;

    const { title, description, eventId, category, duration, sortOrder, thumbnailUrl } = req.body;

    if (isDBEnabled()) {
      const sql = getSQL();
      const result = await sql`
        INSERT INTO videos (event_id, title, description, video_type, video_url, thumbnail_url, category, duration, sort_order)
        VALUES (${eventId || null}, ${title || 'Untitled Video'}, ${description || ''}, 'upload', ${url}, ${thumbnailUrl || ''}, ${category || ''}, ${duration || ''}, ${sortOrder || 0})
        RETURNING *
      `;
      res.json({ success: true, data: camelRow(result[0]) });
    } else {
      const video = {
        id: ++memVideoCounter,
        event_id: eventId || null,
        title: title || 'Untitled Video',
        description: description || '',
        video_type: 'upload',
        video_url: url,
        thumbnail_url: thumbnailUrl || '',
        category: category || '',
        duration: duration || '',
        sort_order: sortOrder || 0,
        created_at: new Date().toISOString(),
      };
      getMemVideos().push(video);
      res.json({ success: true, data: camelRow(video) });
    }
  } catch (err) {
    console.error('Video upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
