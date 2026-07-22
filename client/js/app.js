/* ═══════════════════════════════════════
   SilverVerse — Legacy localStorage layer
   DEPRECATED: All data now comes from the API.
   This file is kept for backward compatibility only.
   ═══════════════════════════════════════ */

const app = {
  DB_KEY: 'silververse_registrations',

  getAll() { return []; },
  getData() { return null; },
  getLatest() { return null; },
  save() { return null; },
  toggleCheckIn() { return null; },
  getStats() { return { total: 0, checkedIn: 0, pending: 0, contestants: 0 }; },

  showToast(message, type) {
    type = type || 'success';
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
};
