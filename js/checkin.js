let currentFilter = 'all';

function renderTable() {
  const all = app.getAll();
  const tbody = document.getElementById('checkinBody');
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = all;
  if (currentFilter !== 'all') {
    filtered = filtered.filter(r => r.category === currentFilter);
  }
  if (search) {
    filtered = filtered.filter(r =>
      r.regId.toLowerCase().includes(search) ||
      (r.firstName + ' ' + r.lastName).toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
    document.querySelector('.checkin-table').style.display = 'none';
  } else {
    document.getElementById('emptyState').style.display = 'none';
    document.querySelector('.checkin-table').style.display = 'table';

    tbody.innerHTML = filtered.map(r => {
      const catClass = 'badge-' + r.category.toLowerCase();
      const statusDot = r.checkedIn ? 'checked' : 'unchecked';
      const statusText = r.checkedIn ? 'Checked In' : 'Pending';
      const btnText = r.checkedIn ? 'Undo' : 'Check In';
      const btnClass = r.checkedIn ? 'checkin-btn checked' : 'checkin-btn';
      const rowClass = r.checkedIn ? 'checked-in' : '';

      return `<tr class="${rowClass}">
        <td><strong>${r.regId}</strong></td>
        <td>${r.firstName} ${r.lastName}</td>
        <td><span class="checkin-badge ${catClass}">${r.category}</span></td>
        <td>${r.ticketType}</td>
        <td><span class="checkin-status"><span class="status-dot checked"></span> Verified</span></td>
        <td><span class="checkin-status"><span class="status-dot ${statusDot}"></span> ${statusText}</span></td>
        <td>
          <button class="${btnClass}" onclick="toggleCheckin('${r.regId}')">${btnText}</button>
        </td>
      </tr>`;
    }).join('');
  }

  updateStats();
}

function updateStats() {
  const stats = app.getStats();
  document.getElementById('statTotal').textContent = stats.total;
  document.getElementById('statChecked').textContent = stats.checkedIn;
  document.getElementById('statPending').textContent = stats.pending;
  document.getElementById('statContestants').textContent = stats.contestants;
}

function toggleCheckin(regId) {
  const reg = app.toggleCheckIn(regId);
  if (reg) {
    const action = reg.checkedIn ? 'checked in' : 'check-in removed';
    app.showToast(reg.firstName + ' ' + reg.lastName + ' ' + action);
  }
  renderTable();
}

function filterTable() {
  renderTable();
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTable();
}

function manualCheckin() {
  const input = document.getElementById('manualId');
  const id = input.value.trim().toUpperCase();

  if (!id) {
    app.showToast('Please enter a Registration ID', 'error');
    return;
  }

  const all = app.getAll();
  const reg = all.find(r => r.regId === id);

  if (!reg) {
    app.showToast('Registration ID not found: ' + id, 'error');
    return;
  }

  if (!reg.checkedIn) {
    app.toggleCheckIn(id);
    app.showToast(reg.firstName + ' ' + reg.lastName + ' checked in successfully!');
  } else {
    app.showToast(reg.firstName + ' ' + reg.lastName + ' is already checked in.', 'error');
  }

  input.value = '';
  renderTable();
}

renderTable();
