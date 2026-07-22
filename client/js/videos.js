/* ═══════════════════════════════════════
   SilverVerse — Video Gallery
   ═══════════════════════════════════════ */

(function () {
  'use strict';

  var allVideos = [];
  var activeFilter = 'All';

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    fetchVideos();
    createModal();
  }

  /* ── Fetch ── */
  function fetchVideos() {
    showLoading();
    fetch('/api/videos', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load videos');
        return res.json();
      })
      .then(function (data) {
        allVideos = Array.isArray(data) ? data : (data.videos || []);
        renderFilters();
        renderGrid();
      })
      .catch(function () {
        showEmpty('Could not load videos. Please try again later.');
      });
  }

  /* ── Filters ── */
  function renderFilters() {
    var container = document.querySelector('.videos-filters');
    if (!container) return;

    var cats = ['All'];
    allVideos.forEach(function (v) {
      var cat = v.category || 'General';
      if (cats.indexOf(cat) === -1) cats.push(cat);
    });

    container.innerHTML = cats.map(function (cat) {
      var cls = cat === activeFilter ? 'filter-tab active' : 'filter-tab';
      return '<button class="' + cls + '" data-cat="' + escapeAttr(cat) + '">' + escapeHtml(cat) + '</button>';
    }).join('');

    container.querySelectorAll('.filter-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = this.getAttribute('data-cat');
        container.querySelectorAll('.filter-tab').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        renderGrid();
      });
    });
  }

  /* ── Grid ── */
  function renderGrid() {
    var grid = document.querySelector('.videos-grid');
    if (!grid) return;

    var filtered = activeFilter === 'All'
      ? allVideos
      : allVideos.filter(function (v) { return (v.category || 'General') === activeFilter; });

    if (filtered.length === 0) {
      grid.innerHTML = '<div class="videos-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg><h3>No videos found</h3><p>No videos match this filter.</p></div>';
      return;
    }

    grid.innerHTML = filtered.map(function (v, i) {
      var thumb = getThumbnail(v);
      var duration = v.duration ? formatDuration(v.duration) : '';
      var category = v.category || 'General';
      return '<div class="video-card" data-index="' + i + '">' +
        '<div class="thumb">' +
          '<img src="' + escapeAttr(thumb) + '" alt="' + escapeAttr(v.title || 'Video thumbnail') + '" loading="lazy">' +
          '<div class="play-icon"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>' +
        '</div>' +
        '<div class="info">' +
          '<h3>' + escapeHtml(v.title || 'Untitled') + '</h3>' +
          '<div class="meta">' +
            '<span class="category-badge">' + escapeHtml(category) + '</span>' +
            (duration ? '<span class="video-duration">' + duration + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.video-card').forEach(function (card, idx) {
      card.addEventListener('click', function () {
        openModal(filtered[idx]);
      });
    });
  }

  /* ── Thumbnail ── */
  function getThumbnail(video) {
    if (video.thumbnail) return video.thumbnail;
    if (video.videoType === 'youtube' && video.url) {
      var id = extractYouTubeId(video.url);
      if (id) return 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
    }
    return 'assets/images/stage.jpg';
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    var match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?#]+)/);
    return match ? match[1] : null;
  }

  /* ── Duration ── */
  function formatDuration(seconds) {
    if (typeof seconds !== 'number') return '';
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ── Modal ── */
  function createModal() {
    if (document.getElementById('videoModal')) return;
    var modal = document.createElement('div');
    modal.id = 'videoModal';
    modal.className = 'video-modal';
    modal.innerHTML =
      '<button class="close-btn" aria-label="Close video">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<div class="player-container"></div>';
    document.body.appendChild(modal);

    modal.querySelector('.close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function openModal(video) {
    var modal = document.getElementById('videoModal');
    var container = modal.querySelector('.player-container');
    container.innerHTML = '';

    if (video.videoType === 'youtube' && video.url) {
      var id = extractYouTubeId(video.url);
      if (id) {
        container.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen title="' + escapeAttr(video.title || 'Video') + '"></iframe>';
      }
    } else if (video.src || video.url) {
      var src = video.src || video.url;
      container.innerHTML = '<video controls autoplay src="' + escapeAttr(src) + '"></video>';
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var modal = document.getElementById('videoModal');
    modal.classList.remove('open');
    modal.querySelector('.player-container').innerHTML = '';
    document.body.style.overflow = '';
  }

  /* ── States ── */
  function showLoading() {
    var grid = document.querySelector('.videos-grid');
    if (grid) grid.innerHTML = '<div class="videos-loading"><div class="spinner"></div><p>Loading videos...</p></div>';
  }

  function showEmpty(msg) {
    var grid = document.querySelector('.videos-grid');
    if (grid) grid.innerHTML = '<div class="videos-empty"><h3>' + escapeHtml(msg) + '</h3></div>';
  }

  /* ── Util ── */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
