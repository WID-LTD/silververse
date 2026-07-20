const app = {
  DB_KEY: 'silververse_registrations',

  getAll() {
    return JSON.parse(localStorage.getItem(this.DB_KEY) || '[]');
  },

  getData(regId) {
    return this.getAll().find(r => r.regId === regId);
  },

  getLatest() {
    const all = this.getAll();
    return all.length ? all[all.length - 1] : null;
  },

  save(registration) {
    const all = this.getAll();
    const nextNum = all.length + 1;
    registration.regId = 'VV26-' + String(nextNum).padStart(4, '0');
    registration.createdAt = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    registration.checkedIn = false;
    all.push(registration);
    localStorage.setItem(this.DB_KEY, JSON.stringify(all));
    return registration;
  },

  toggleCheckIn(regId) {
    const all = this.getAll();
    const reg = all.find(r => r.regId === regId);
    if (reg) {
      reg.checkedIn = !reg.checkedIn;
      reg.checkedInTime = reg.checkedIn ? new Date().toLocaleTimeString() : null;
      localStorage.setItem(this.DB_KEY, JSON.stringify(all));
    }
    return reg;
  },

  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      checkedIn: all.filter(r => r.checkedIn).length,
      pending: all.filter(r => !r.checkedIn).length,
      contestants: all.filter(r => r.category === 'Contestant').length
    };
  },

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }
};

// Seed demo data if empty
if (app.getAll().length === 0) {
  const demoData = [
    { firstName: 'John', lastName: 'David', email: 'john@example.com', phone: '+2348012345678', category: 'VIP', ticketType: 'VIP', talent: '', perfTime: '', department: '', dietary: '' },
    { firstName: 'Sarah', lastName: 'James', email: 'sarah@example.com', phone: '+2348098765432', category: 'Contestant', ticketType: 'Regular', talent: 'Singing', perfTime: '11:45 AM', department: '', dietary: '' },
    { firstName: 'Emeka', lastName: 'Okafor', email: 'emeka@example.com', phone: '+2348076543210', category: 'Judge', ticketType: 'VIP', talent: '', perfTime: '', department: '', dietary: '' },
    { firstName: 'Fatima', lastName: 'Abdullahi', email: 'fatima@example.com', phone: '+2348054321098', category: 'Volunteer', ticketType: 'Regular', talent: '', perfTime: '', department: 'Media', dietary: '' },
    { firstName: 'Chidi', lastName: 'Nwosu', email: 'chidi@example.com', phone: '+2348032109876', category: 'Spectator', ticketType: 'Regular', talent: '', perfTime: '', department: '', dietary: '' },
    { firstName: 'Aisha', lastName: 'Bello', email: 'aisha@example.com', phone: '+2348023456789', category: 'Speaker', ticketType: 'VVIP', talent: '', perfTime: '', department: '', dietary: '' },
    { firstName: 'Tunde', lastName: 'Adeyemi', email: 'tunde@example.com', phone: '+2348065432109', category: 'Media', ticketType: 'Regular', talent: '', perfTime: '', department: '', dietary: '' },
    { firstName: 'Grace', lastName: 'Obi', email: 'grace@example.com', phone: '+2348045678901', category: 'Staff', ticketType: 'VIP', talent: '', perfTime: '', department: '', dietary: '' },
  ];
  demoData.forEach(d => app.save(d));
  // Check in some demo attendees
  app.toggleCheckIn('VV26-0001');
  app.toggleCheckIn('VV26-0005');
}
