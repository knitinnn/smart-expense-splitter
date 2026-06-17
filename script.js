/* ============================================================
   Smart Bill Splitter – Application Logic
   Modules: Auth · Dashboard · Events · Members · Expenses
            Settlements · Analytics · Search · Export · UI
   ============================================================ */

'use strict';

/* ============================================================
   1. UTILITY HELPERS
   ============================================================ */

/** Generate a UUID v4 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** LocalStorage helpers with JSON support */
const Store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};

/** Storage keys */
const KEYS = {
  USERS: 'sbs_users',
  LOGGED_IN: 'sbs_loggedInUser',
  EVENTS: 'sbs_events',
  MEMBERS: 'sbs_members',
  EXPENSES: 'sbs_expenses',
  ACTIVITIES: 'sbs_activities',
  DARK_MODE: 'sbs_darkMode'
};

/** Format currency */
function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Format date nicely */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format relative time */
function timeAgo(dateStr) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

/** Escape HTML */
function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Get initials */
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Category icons map */
const CAT_ICONS = {
  Travel: '✈️', Food: '🍕', Hotel: '🏨',
  Drinks: '🍺', Shopping: '🛒', Miscellaneous: '📦'
};

/** Category CSS class map */
const CAT_CLASS = {
  Travel: 'cat-travel', Food: 'cat-food', Hotel: 'cat-hotel',
  Drinks: 'cat-drinks', Shopping: 'cat-shopping', Miscellaneous: 'cat-misc'
};

/* ============================================================
   2. CURRENT STATE
   ============================================================ */
let currentUser = null;
let currentEventId = null;

/* ============================================================
   3. INITIALISATION
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  checkAuth();
});

function checkAuth() {
  const userId = Store.get(KEYS.LOGGED_IN);
  if (userId) {
    const users = Store.get(KEYS.USERS) || [];
    currentUser = users.find(u => u.id === userId);
    if (currentUser) {
      enterApp();
      return;
    }
  }
  showView('login');
}

function enterApp() {
  // Hide top-level auth views to prevent overlapping layouts
  document.getElementById('view-login').classList.remove('active');
  document.getElementById('view-signup').classList.remove('active');
  document.getElementById('app-layout').style.display = 'flex';
  updateSidebarUser();
  navigate('dashboard');
}

/* ============================================================
   4. VIEW MANAGEMENT
   ============================================================ */
function showView(name) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');

  // If auth views, hide app layout
  if (name === 'login' || name === 'signup') {
    document.getElementById('app-layout').style.display = 'none';
  }
}

function navigate(page) {
  // Close mobile sidebar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('show');

  // Update active nav
  document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === page || btn.dataset.nav === page.replace('analytics-overview', 'analytics'));
  });

  // Hide all views inside main-content
  document.querySelectorAll('#main-content > .view').forEach(v => v.classList.remove('active'));

  const viewEl = document.getElementById('view-' + page);
  if (viewEl) viewEl.classList.add('active');

  // Render relevant page
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'events': renderEvents(); break;
    case 'event-detail': renderEventDetail(); break;
    case 'analytics-overview': renderGlobalAnalytics(); break;
    case 'profile': renderProfile(); break;
  }
}

/* ============================================================
   5. SIDEBAR & THEME
   ============================================================ */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}

function updateSidebarUser() {
  if (!currentUser) return;
  document.getElementById('sidebar-avatar').textContent = initials(currentUser.fullName);
  document.getElementById('sidebar-username').textContent = currentUser.fullName;
}

function initTheme() {
  const dark = Store.get(KEYS.DARK_MODE);
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    const sw = document.getElementById('theme-switch');
    if (sw) sw.classList.add('active');
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    Store.set(KEYS.DARK_MODE, false);
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    Store.set(KEYS.DARK_MODE, true);
  }
  const sw = document.getElementById('theme-switch');
  if (sw) sw.classList.toggle('active', !isDark);
}

/* ============================================================
   6. TOAST NOTIFICATIONS
   ============================================================ */
function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${esc(title)}</div>
      ${message ? `<div class="toast-message">${esc(message)}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ============================================================
   7. MODAL SYSTEM
   ============================================================ */
function openModal(title, bodyHTML, footerHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML || '';
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

/** Confirm dialog (returns promise) */
function confirmDialog(title, message) {
  return new Promise(resolve => {
    const body = `
      <div class="confirm-body">
        <div class="confirm-icon">⚠️</div>
        <h4>${esc(title)}</h4>
        <p>${esc(message)}</p>
      </div>`;
    const footer = `
      <button class="btn btn-secondary" onclick="closeModal(); window._confirmResolve(false)">Cancel</button>
      <button class="btn btn-danger" onclick="closeModal(); window._confirmResolve(true)">Confirm</button>`;
    window._confirmResolve = resolve;
    openModal('Confirm', body, footer);
  });
}

/* ============================================================
   8. AUTHENTICATION – SIGNUP
   ============================================================ */
document.getElementById('signup-form').addEventListener('submit', function (e) {
  e.preventDefault();
  clearFormErrors('signup');

  const fullName = document.getElementById('signup-name').value.trim();
  const phone = document.getElementById('signup-phone').value.trim();
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;

  let valid = true;

  if (!fullName) { showFieldError('signup-name', 'Full name is required'); valid = false; }
  if (!phone) { showFieldError('signup-phone', 'Phone number is required'); valid = false; }
  if (!username) { showFieldError('signup-username', 'Username is required'); valid = false; }
  if (password.length < 8) { showFieldError('signup-password', 'Password must be at least 8 characters'); valid = false; }
  if (password !== confirm) { showFieldError('signup-confirm', 'Passwords do not match'); valid = false; }

  if (!valid) return;

  const users = Store.get(KEYS.USERS) || [];
  if (users.some(u => u.phone === phone)) {
    showFieldError('signup-phone', 'Phone number already registered');
    return;
  }
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    showFieldError('signup-username', 'Username already taken');
    return;
  }

  const newUser = {
    id: uuid(),
    fullName,
    phone,
    username,
    password: btoa(password), // simple encoding (not production-grade hashing)
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  Store.set(KEYS.USERS, users);

  showToast('success', 'Account Created', 'You can now sign in with your credentials');
  document.getElementById('signup-form').reset();
  showView('login');
});

/* ============================================================
   9. AUTHENTICATION – LOGIN
   ============================================================ */
document.getElementById('login-form').addEventListener('submit', function (e) {
  e.preventDefault();
  clearFormErrors('login');

  const userInput = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-password').value;

  let valid = true;
  if (!userInput) { showFieldError('login-user', 'Please enter username or phone'); valid = false; }
  if (!password) { showFieldError('login-password', 'Please enter your password'); valid = false; }
  if (!valid) return;

  const users = Store.get(KEYS.USERS) || [];
  const user = users.find(u =>
    (u.username.toLowerCase() === userInput.toLowerCase() || u.phone === userInput) &&
    atob(u.password) === password
  );

  if (!user) {
    showFieldError('login-user', 'Invalid credentials');
    showFieldError('login-password', 'Invalid username/phone or password');
    return;
  }

  Store.set(KEYS.LOGGED_IN, user.id);
  currentUser = user;
  document.getElementById('login-form').reset();
  showToast('success', 'Welcome Back!', `Signed in as ${user.fullName}`);
  enterApp();
});

function handleLogout() {
  Store.remove(KEYS.LOGGED_IN);
  currentUser = null;
  currentEventId = null;
  document.getElementById('app-layout').style.display = 'none';
  showView('login');
  showToast('info', 'Signed Out', 'You have been logged out');
}

/* ============================================================
   10. FORM VALIDATION HELPERS
   ============================================================ */
function showFieldError(fieldId, msg) {
  const input = document.getElementById(fieldId);
  const error = document.getElementById(fieldId + '-error');
  if (input) input.classList.add('error');
  if (error) { error.textContent = msg; error.classList.add('show'); }
}

function clearFormErrors(prefix) {
  document.querySelectorAll(`[id^="${prefix}-"]`).forEach(el => {
    el.classList.remove('error');
  });
  document.querySelectorAll(`[id^="${prefix}-"][id$="-error"]`).forEach(el => {
    el.classList.remove('show');
    el.textContent = '';
  });
}

/* ============================================================
   11. DASHBOARD
   ============================================================ */
function renderDashboard() {
  // Greeting
  const hour = new Date().getHours();
  let greeting = 'Good Evening';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 17) greeting = 'Good Afternoon';

  document.getElementById('greeting-text').textContent = `${greeting}, ${currentUser.fullName}`;

  // Stats
  const events = getUserEvents();
  const allExpenses = getAllUserExpenses();
  const totalExpenseAmount = allExpenses.reduce((s, e) => s + e.amount, 0);
  const totalSettlements = events.reduce((s, ev) => {
    const settlements = computeSettlements(ev.id);
    return s + settlements.length;
  }, 0);

  document.getElementById('dashboard-stats').innerHTML = `
    <div class="stat-card animate-slide-up">
      <div class="stat-icon primary">📋</div>
      <div class="stat-info">
        <div class="stat-value">${events.length}</div>
        <div class="stat-label">Total Events</div>
      </div>
    </div>
    <div class="stat-card animate-slide-up" style="animation-delay:0.05s">
      <div class="stat-icon success">💰</div>
      <div class="stat-info">
        <div class="stat-value">${formatCurrency(totalExpenseAmount)}</div>
        <div class="stat-label">Total Expenses</div>
      </div>
    </div>
    <div class="stat-card animate-slide-up" style="animation-delay:0.1s">
      <div class="stat-icon info">🤝</div>
      <div class="stat-info">
        <div class="stat-value">${totalSettlements}</div>
        <div class="stat-label">Total Settlements</div>
      </div>
    </div>
    <div class="stat-card animate-slide-up" style="animation-delay:0.15s">
      <div class="stat-icon warning">📊</div>
      <div class="stat-info">
        <div class="stat-value">${allExpenses.length}</div>
        <div class="stat-label">Expense Entries</div>
      </div>
    </div>
  `;

  // Recent events
  const recentEventsEl = document.getElementById('dashboard-recent-events');
  if (events.length === 0) {
    recentEventsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No Events Yet</h3>
        <p>Create your first event to start splitting expenses</p>
        <button class="btn btn-primary" onclick="openCreateEventModal()">➕ Create Event</button>
      </div>`;
  } else {
    const recent = events.slice(-3).reverse();
    recentEventsEl.innerHTML = recent.map(ev => {
      const members = getEventMembers(ev.id);
      const expenses = getEventExpenses(ev.id);
      const total = expenses.reduce((s, e) => s + e.amount, 0);
      return `
        <div class="expense-item" style="cursor:pointer" onclick="openEventDetail('${ev.id}')">
          <div class="expense-cat-icon cat-travel">📋</div>
          <div class="expense-info">
            <div class="expense-name">${esc(ev.name)}</div>
            <div class="expense-meta">
              <span>📅 ${formatDate(ev.date)}</span>
              <span>👥 ${members.length} members</span>
              <span>💸 ${expenses.length} expenses</span>
            </div>
          </div>
          <div class="expense-amount">${formatCurrency(total)}</div>
        </div>`;
    }).join('');
  }

  // Recent activity
  renderTimeline();
}

function renderTimeline() {
  const activities = (Store.get(KEYS.ACTIVITIES) || [])
    .filter(a => a.userId === currentUser.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  const el = document.getElementById('dashboard-timeline');
  if (activities.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📝</div><h3>No Recent Activity</h3><p>Your activity will show up here</p></div>`;
    return;
  }
  el.innerHTML = `<div class="timeline">${activities.map(a => `
    <div class="timeline-item">
      <div class="timeline-item-time">${timeAgo(a.timestamp)}</div>
      <div class="timeline-item-content">${a.message}</div>
    </div>`).join('')}</div>`;
}

function addActivity(eventId, message) {
  const activities = Store.get(KEYS.ACTIVITIES) || [];
  activities.push({
    id: uuid(),
    userId: currentUser.id,
    eventId,
    message,
    timestamp: new Date().toISOString()
  });
  Store.set(KEYS.ACTIVITIES, activities);
}

/* ============================================================
   12. EVENT MANAGEMENT
   ============================================================ */
function getUserEvents() {
  return (Store.get(KEYS.EVENTS) || []).filter(e => e.userId === currentUser.id);
}

function getEventById(id) {
  return (Store.get(KEYS.EVENTS) || []).find(e => e.id === id);
}

function openCreateEventModal() {
  const today = new Date().toISOString().split('T')[0];
  const body = `
    <div class="form-group">
      <label class="form-label">Event Name</label>
      <input class="form-input" type="text" id="new-event-name" placeholder="e.g. Goa Trip" />
    </div>
    <div class="form-group">
      <label class="form-label">Event Date</label>
      <input class="form-input" type="date" id="new-event-date" value="${today}" />
    </div>
    <div class="form-group">
      <label class="form-label">Description (Optional)</label>
      <textarea class="form-input form-textarea" id="new-event-desc" placeholder="Brief description..."></textarea>
    </div>`;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="handleCreateEvent()">Create Event</button>`;
  openModal('Create Event', body, footer);
}

function handleCreateEvent() {
  const name = document.getElementById('new-event-name').value.trim();
  const date = document.getElementById('new-event-date').value;
  const desc = document.getElementById('new-event-desc').value.trim();

  if (!name) { showToast('error', 'Error', 'Event name is required'); return; }
  if (!date) { showToast('error', 'Error', 'Event date is required'); return; }

  const events = Store.get(KEYS.EVENTS) || [];
  const newEvent = {
    id: uuid(),
    userId: currentUser.id,
    name,
    date,
    description: desc,
    createdAt: new Date().toISOString()
  };
  events.push(newEvent);
  Store.set(KEYS.EVENTS, events);

  addActivity(newEvent.id, `Created event <strong>${esc(name)}</strong>`);
  closeModal();
  showToast('success', 'Event Created', name);
  openEventDetail(newEvent.id);
}

function renderEvents() {
  const search = (document.getElementById('event-search')?.value || '').toLowerCase();
  let events = getUserEvents();
  if (search) {
    events = events.filter(e => e.name.toLowerCase().includes(search));
  }

  const container = document.getElementById('events-list');
  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <div class="empty-state-icon">📋</div>
        <h3>${search ? 'No Matching Events' : 'No Events Yet'}</h3>
        <p>${search ? 'Try a different search term' : 'Create your first event to get started'}</p>
        ${!search ? '<button class="btn btn-primary" onclick="openCreateEventModal()">➕ Create Event</button>' : ''}
      </div>`;
    return;
  }

  container.innerHTML = events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(ev => {
    const members = getEventMembers(ev.id);
    const expenses = getEventExpenses(ev.id);
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    return `
      <div class="event-card" onclick="openEventDetail('${ev.id}')">
        <div class="event-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-icon btn-sm" title="Duplicate" onclick="duplicateEvent('${ev.id}')">📋</button>
          <button class="btn btn-ghost btn-icon btn-sm" title="Delete" onclick="deleteEvent('${ev.id}')">🗑️</button>
        </div>
        <div class="event-card-title">${esc(ev.name)}</div>
        <div class="event-card-date">📅 ${formatDate(ev.date)}</div>
        ${ev.description ? `<div class="event-card-desc">${esc(ev.description)}</div>` : ''}
        <div class="event-card-stats">
          <div class="event-card-stat">
            <div class="event-card-stat-value">${members.length}</div>
            <div class="event-card-stat-label">Members</div>
          </div>
          <div class="event-card-stat">
            <div class="event-card-stat-value">${expenses.length}</div>
            <div class="event-card-stat-label">Expenses</div>
          </div>
          <div class="event-card-stat">
            <div class="event-card-stat-value">${formatCurrency(total)}</div>
            <div class="event-card-stat-label">Total</div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function openEventDetail(eventId) {
  currentEventId = eventId;
  navigate('event-detail');
}

function renderEventDetail() {
  const ev = getEventById(currentEventId);
  if (!ev) { navigate('events'); return; }

  document.getElementById('event-detail-name').textContent = ev.name;
  document.getElementById('event-detail-date').textContent = `📅 ${formatDate(ev.date)}${ev.description ? ' · ' + ev.description : ''}`;

  renderMembers();
  renderExpenses();
  calculateSettlements();
  renderEventAnalytics();
  renderReport();

  // Reset to first tab
  const firstTab = document.querySelector('#event-tabs .tab-btn');
  if (firstTab) switchTab(firstTab, 'tab-members');
}

function duplicateEvent(eventId) {
  const ev = getEventById(eventId);
  if (!ev) return;
  const events = Store.get(KEYS.EVENTS) || [];
  const newId = uuid();
  events.push({ ...ev, id: newId, name: ev.name + ' (Copy)', createdAt: new Date().toISOString() });
  Store.set(KEYS.EVENTS, events);

  // Duplicate members
  const members = getEventMembers(eventId);
  const allMembers = Store.get(KEYS.MEMBERS) || [];
  const memberMap = {};
  members.forEach(m => {
    const newMemberId = uuid();
    memberMap[m.id] = newMemberId;
    allMembers.push({ ...m, id: newMemberId, eventId: newId });
  });
  Store.set(KEYS.MEMBERS, allMembers);

  // Duplicate expenses
  const expenses = getEventExpenses(eventId);
  const allExpenses = Store.get(KEYS.EXPENSES) || [];
  expenses.forEach(exp => {
    const newPayers = exp.payers.map(p => ({ memberId: memberMap[p.memberId] || p.memberId, amount: p.amount }));
    const newParticipants = exp.participants.map(pid => memberMap[pid] || pid);
    allExpenses.push({ ...exp, id: uuid(), eventId: newId, payers: newPayers, participants: newParticipants, createdAt: new Date().toISOString() });
  });
  Store.set(KEYS.EXPENSES, allExpenses);

  addActivity(newId, `Duplicated event <strong>${esc(ev.name)}</strong>`);
  showToast('success', 'Event Duplicated', ev.name + ' (Copy)');
  renderEvents();
}

function duplicateCurrentEvent() {
  duplicateEvent(currentEventId);
}

async function deleteEvent(eventId) {
  const ev = getEventById(eventId);
  if (!ev) return;
  const ok = await confirmDialog('Delete Event', `Are you sure you want to delete "${ev.name}"? This action cannot be undone.`);
  if (!ok) return;

  let events = Store.get(KEYS.EVENTS) || [];
  events = events.filter(e => e.id !== eventId);
  Store.set(KEYS.EVENTS, events);

  // Remove members & expenses
  let members = Store.get(KEYS.MEMBERS) || [];
  members = members.filter(m => m.eventId !== eventId);
  Store.set(KEYS.MEMBERS, members);

  let expenses = Store.get(KEYS.EXPENSES) || [];
  expenses = expenses.filter(e => e.eventId !== eventId);
  Store.set(KEYS.EXPENSES, expenses);

  addActivity(eventId, `Deleted event <strong>${esc(ev.name)}</strong>`);
  showToast('info', 'Event Deleted', ev.name);

  if (currentEventId === eventId) {
    currentEventId = null;
    navigate('events');
  } else {
    renderEvents();
  }
}

function deleteCurrentEvent() {
  deleteEvent(currentEventId);
}

async function clearCurrentEvent() {
  const ok = await confirmDialog('Clear Event', 'Remove all expenses and members from this event?');
  if (!ok) return;

  let members = Store.get(KEYS.MEMBERS) || [];
  members = members.filter(m => m.eventId !== currentEventId);
  Store.set(KEYS.MEMBERS, members);

  let expenses = Store.get(KEYS.EXPENSES) || [];
  expenses = expenses.filter(e => e.eventId !== currentEventId);
  Store.set(KEYS.EXPENSES, expenses);

  addActivity(currentEventId, `Cleared all data from event`);
  showToast('info', 'Event Cleared');
  renderEventDetail();
}

/* ============================================================
   13. MEMBER MANAGEMENT
   ============================================================ */
function getEventMembers(eventId) {
  return (Store.get(KEYS.MEMBERS) || []).filter(m => m.eventId === eventId);
}

function addMember() {
  const input = document.getElementById('member-name-input');
  const name = input.value.trim();
  if (!name) { showToast('error', 'Error', 'Enter a member name'); return; }

  const members = Store.get(KEYS.MEMBERS) || [];
  const eventMembers = members.filter(m => m.eventId === currentEventId);
  if (eventMembers.some(m => m.name.toLowerCase() === name.toLowerCase())) {
    showToast('error', 'Duplicate', 'A member with this name already exists');
    return;
  }

  members.push({ id: uuid(), eventId: currentEventId, name });
  Store.set(KEYS.MEMBERS, members);
  input.value = '';
  addActivity(currentEventId, `Added member <strong>${esc(name)}</strong>`);
  showToast('success', 'Member Added', name);
  renderMembers();
}

function renderMembers() {
  const members = getEventMembers(currentEventId);
  const container = document.getElementById('members-list');
  if (members.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><h3>No Members</h3><p>Add members to split expenses</p></div>`;
    return;
  }
  container.innerHTML = members.map(m => `
    <div class="member-card">
      <div class="member-avatar">${initials(m.name)}</div>
      <div class="member-name">${esc(m.name)}</div>
      <div class="member-actions">
        <button title="Edit" onclick="editMember('${m.id}')">✏️</button>
        <button title="Delete" class="danger" onclick="deleteMember('${m.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

function editMember(memberId) {
  const members = Store.get(KEYS.MEMBERS) || [];
  const member = members.find(m => m.id === memberId);
  if (!member) return;

  const body = `
    <div class="form-group">
      <label class="form-label">Member Name</label>
      <input class="form-input" type="text" id="edit-member-name" value="${esc(member.name)}" />
    </div>`;
  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveMemberEdit('${memberId}')">Save</button>`;
  openModal('Edit Member', body, footer);
}

function saveMemberEdit(memberId) {
  const newName = document.getElementById('edit-member-name').value.trim();
  if (!newName) { showToast('error', 'Error', 'Name cannot be empty'); return; }

  const members = Store.get(KEYS.MEMBERS) || [];
  const eventMembers = members.filter(m => m.eventId === currentEventId && m.id !== memberId);
  if (eventMembers.some(m => m.name.toLowerCase() === newName.toLowerCase())) {
    showToast('error', 'Duplicate', 'A member with this name already exists');
    return;
  }

  const idx = members.findIndex(m => m.id === memberId);
  if (idx !== -1) members[idx].name = newName;
  Store.set(KEYS.MEMBERS, members);
  closeModal();
  showToast('success', 'Member Updated', newName);
  renderMembers();
  renderExpenses();
}

async function deleteMember(memberId) {
  const members = Store.get(KEYS.MEMBERS) || [];
  const member = members.find(m => m.id === memberId);
  if (!member) return;

  // Check if member is used in expenses
  const expenses = getEventExpenses(currentEventId);
  const used = expenses.some(e =>
    e.payers.some(p => p.memberId === memberId) ||
    e.participants.includes(memberId)
  );

  if (used) {
    const ok = await confirmDialog('Delete Member', `${member.name} is linked to expenses. Deleting will remove them from those expenses. Continue?`);
    if (!ok) return;

    // Remove member from expenses
    const allExpenses = Store.get(KEYS.EXPENSES) || [];
    allExpenses.forEach(exp => {
      if (exp.eventId === currentEventId) {
        exp.payers = exp.payers.filter(p => p.memberId !== memberId);
        exp.participants = exp.participants.filter(pid => pid !== memberId);
      }
    });
    Store.set(KEYS.EXPENSES, allExpenses);
  }

  const updated = members.filter(m => m.id !== memberId);
  Store.set(KEYS.MEMBERS, updated);
  addActivity(currentEventId, `Removed member <strong>${esc(member.name)}</strong>`);
  showToast('info', 'Member Removed', member.name);
  renderMembers();
  renderExpenses();
}

/* ============================================================
   14. EXPENSE MANAGEMENT
   ============================================================ */
function getEventExpenses(eventId) {
  return (Store.get(KEYS.EXPENSES) || []).filter(e => e.eventId === eventId);
}

function getAllUserExpenses() {
  const eventIds = getUserEvents().map(e => e.id);
  return (Store.get(KEYS.EXPENSES) || []).filter(e => eventIds.includes(e.eventId));
}

let editingExpenseId = null;

function openExpenseModal(expenseId) {
  const members = getEventMembers(currentEventId);
  if (members.length < 2) {
    showToast('warning', 'Add Members', 'You need at least 2 members to add an expense');
    return;
  }

  editingExpenseId = expenseId || null;
  let expense = null;
  if (editingExpenseId) {
    expense = (Store.get(KEYS.EXPENSES) || []).find(e => e.id === editingExpenseId);
  }

  const today = new Date().toISOString().split('T')[0];
  const memberOptions = members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');

  const body = `
    <div class="form-group">
      <label class="form-label">Expense Name</label>
      <input class="form-input" type="text" id="expense-name" placeholder="e.g. Petrol, Lunch, Hotel" value="${expense ? esc(expense.name) : ''}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Amount (₹)</label>
        <input class="form-input" type="number" id="expense-amount" placeholder="0" min="0" step="0.01" value="${expense ? expense.amount : ''}" oninput="updateContributorTotal()" />
      </div>
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input form-select" id="expense-category">
          <option value="Travel" ${expense && expense.category === 'Travel' ? 'selected' : ''}>✈️ Travel</option>
          <option value="Food" ${expense && expense.category === 'Food' ? 'selected' : ''}>🍕 Food</option>
          <option value="Hotel" ${expense && expense.category === 'Hotel' ? 'selected' : ''}>🏨 Hotel</option>
          <option value="Drinks" ${expense && expense.category === 'Drinks' ? 'selected' : ''}>🍺 Drinks</option>
          <option value="Shopping" ${expense && expense.category === 'Shopping' ? 'selected' : ''}>🛒 Shopping</option>
          <option value="Miscellaneous" ${!expense || expense.category === 'Miscellaneous' ? 'selected' : ''}>📦 Miscellaneous</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Expense Date</label>
      <input class="form-input" type="date" id="expense-date" value="${expense ? expense.date : today}" />
    </div>

    <div class="section-divider"></div>

    <div class="form-group">
      <label class="form-label">💳 Paid By (Contributors)</label>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Who paid for this expense? One expense can be paid by multiple people.</p>
      <div id="contributor-rows" class="contributor-rows"></div>
      <button class="btn btn-outline btn-sm mt-8" type="button" onclick="addContributorRow()">➕ Add Contributor</button>
      <div id="contributor-total" class="contributor-total mt-8"></div>
    </div>

    <div class="section-divider"></div>

    <div class="form-group">
      <label class="form-label">👥 Participants (Who shares this expense)</label>
      <div class="select-all-row">
        <button class="btn btn-ghost btn-sm" type="button" onclick="selectAllParticipants(true)">Select All</button>
        <button class="btn btn-ghost btn-sm" type="button" onclick="selectAllParticipants(false)">Deselect All</button>
      </div>
      <div id="participant-checkboxes" class="participant-grid"></div>
    </div>
  `;

  const footer = `
    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="saveExpense()">${expense ? 'Update Expense' : 'Add Expense'}</button>`;

  openModal(expense ? 'Edit Expense' : 'Add Expense', body, footer);

  // Populate participants
  const participantContainer = document.getElementById('participant-checkboxes');
  participantContainer.innerHTML = members.map(m => {
    const checked = expense ? expense.participants.includes(m.id) : true;
    return `
      <label class="participant-check ${checked ? 'checked' : ''}" onclick="this.classList.toggle('checked')">
        <input type="checkbox" value="${m.id}" ${checked ? 'checked' : ''} /> ${esc(m.name)}
      </label>`;
  }).join('');

  // Populate contributor rows
  const contributorContainer = document.getElementById('contributor-rows');
  if (expense && expense.payers.length > 0) {
    expense.payers.forEach(p => addContributorRowWith(p.memberId, p.amount, memberOptions));
  } else {
    addContributorRow();
  }
  updateContributorTotal();
}

function addContributorRow() {
  const members = getEventMembers(currentEventId);
  const options = members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  addContributorRowWith('', '', options);
}

function addContributorRowWith(memberId, amount, options) {
  const container = document.getElementById('contributor-rows');
  const row = document.createElement('div');
  row.className = 'contributor-row';
  row.innerHTML = `
    <select class="form-input form-select contributor-member">${options}</select>
    <input class="form-input contributor-amount" type="number" placeholder="Amount" min="0" step="0.01" value="${amount}" oninput="updateContributorTotal()" />
    <button class="btn btn-ghost btn-icon btn-sm" type="button" onclick="this.parentElement.remove(); updateContributorTotal()">❌</button>
  `;
  container.appendChild(row);

  // Set selected member
  if (memberId) {
    const sel = row.querySelector('.contributor-member');
    sel.value = memberId;
  }
}

function updateContributorTotal() {
  const total = parseFloat(document.getElementById('expense-amount')?.value) || 0;
  const rows = document.querySelectorAll('.contributor-row');
  let sum = 0;
  rows.forEach(row => {
    sum += parseFloat(row.querySelector('.contributor-amount').value) || 0;
  });

  const el = document.getElementById('contributor-total');
  if (!el) return;
  const valid = Math.abs(sum - total) < 0.01 && total > 0;
  el.className = `contributor-total ${valid ? 'valid' : 'invalid'}`;
  el.innerHTML = `<span>Contributor Total: ${formatCurrency(sum)}</span><span>Expense Total: ${formatCurrency(total)}</span>`;
}

function selectAllParticipants(selectAll) {
  document.querySelectorAll('#participant-checkboxes .participant-check').forEach(label => {
    const cb = label.querySelector('input[type="checkbox"]');
    cb.checked = selectAll;
    label.classList.toggle('checked', selectAll);
  });
}

function saveExpense() {
  const name = document.getElementById('expense-name').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const category = document.getElementById('expense-category').value;
  const date = document.getElementById('expense-date').value;

  if (!name) { showToast('error', 'Error', 'Expense name is required'); return; }
  if (!amount || amount <= 0) { showToast('error', 'Error', 'Enter a valid amount'); return; }
  if (!date) { showToast('error', 'Error', 'Select a date'); return; }

  // Gather contributors
  const rows = document.querySelectorAll('.contributor-row');
  const payers = [];
  rows.forEach(row => {
    const memberId = row.querySelector('.contributor-member').value;
    const amt = parseFloat(row.querySelector('.contributor-amount').value) || 0;
    if (memberId && amt > 0) {
      payers.push({ memberId, amount: amt });
    }
  });

  if (payers.length === 0) { showToast('error', 'Error', 'Add at least one contributor'); return; }

  const payerTotal = payers.reduce((s, p) => s + p.amount, 0);
  if (Math.abs(payerTotal - amount) > 0.01) {
    showToast('error', 'Mismatch', `Contributors total (${formatCurrency(payerTotal)}) must equal expense amount (${formatCurrency(amount)})`);
    return;
  }

  // Gather participants
  const participants = [];
  document.querySelectorAll('#participant-checkboxes input[type="checkbox"]:checked').forEach(cb => {
    participants.push(cb.value);
  });

  if (participants.length === 0) { showToast('error', 'Error', 'Select at least one participant'); return; }

  const allExpenses = Store.get(KEYS.EXPENSES) || [];

  if (editingExpenseId) {
    const idx = allExpenses.findIndex(e => e.id === editingExpenseId);
    if (idx !== -1) {
      allExpenses[idx] = { ...allExpenses[idx], name, amount, category, date, payers, participants };
    }
    addActivity(currentEventId, `Updated expense <strong>${esc(name)}</strong> (${formatCurrency(amount)})`);
    showToast('success', 'Expense Updated', name);
  } else {
    allExpenses.push({
      id: uuid(),
      eventId: currentEventId,
      name, amount, category, date,
      payers, participants,
      createdAt: new Date().toISOString()
    });
    addActivity(currentEventId, `Added expense <strong>${esc(name)}</strong> (${formatCurrency(amount)})`);
    showToast('success', 'Expense Added', `${name} – ${formatCurrency(amount)}`);
  }

  Store.set(KEYS.EXPENSES, allExpenses);
  editingExpenseId = null;
  closeModal();
  renderExpenses();
  calculateSettlements();
  renderEventAnalytics();
  renderReport();
}

function renderExpenses() {
  const members = getEventMembers(currentEventId);
  const memberMap = {};
  members.forEach(m => { memberMap[m.id] = m.name; });

  let expenses = getEventExpenses(currentEventId);

  // Search filter
  const search = (document.getElementById('expense-search')?.value || '').toLowerCase();
  if (search) {
    expenses = expenses.filter(e =>
      e.name.toLowerCase().includes(search) ||
      e.category.toLowerCase().includes(search) ||
      e.payers.some(p => (memberMap[p.memberId] || '').toLowerCase().includes(search))
    );
  }

  // Category filter
  const catFilter = document.getElementById('expense-filter-category')?.value;
  if (catFilter) expenses = expenses.filter(e => e.category === catFilter);

  // Date filter
  const dateFilter = document.getElementById('expense-filter-date')?.value;
  if (dateFilter) expenses = expenses.filter(e => e.date === dateFilter);

  const container = document.getElementById('expense-list');
  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💸</div>
        <h3>${search || catFilter || dateFilter ? 'No Matching Expenses' : 'No Expenses Yet'}</h3>
        <p>${search || catFilter || dateFilter ? 'Try different filters' : 'Add your first expense to start tracking'}</p>
      </div>`;
    return;
  }

  container.innerHTML = expenses
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(exp => {
      const payerChips = exp.payers.map(p =>
        `<span class="expense-payer-chip">${esc(memberMap[p.memberId] || '?')} ${formatCurrency(p.amount)}</span>`
      ).join('');
      const partChips = exp.participants.map(pid =>
        `<span class="expense-participant-chip">${esc(memberMap[pid] || '?')}</span>`
      ).join('');
      return `
        <div class="expense-item">
          <div class="expense-cat-icon ${CAT_CLASS[exp.category] || 'cat-misc'}">${CAT_ICONS[exp.category] || '📦'}</div>
          <div class="expense-info">
            <div class="expense-name">${esc(exp.name)}</div>
            <div class="expense-meta">
              <span class="badge badge-neutral">${exp.category}</span>
              <span>📅 ${formatDate(exp.date)}</span>
            </div>
            <div class="expense-meta mt-8">
              <span>Paid: </span>${payerChips}
            </div>
            <div class="expense-meta mt-8">
              <span>Split: </span>${partChips}
            </div>
          </div>
          <div class="expense-amount">${formatCurrency(exp.amount)}</div>
          <div class="expense-actions">
            <button class="btn btn-ghost btn-icon btn-sm" title="Edit" onclick="openExpenseModal('${exp.id}')">✏️</button>
            <button class="btn btn-ghost btn-icon btn-sm" title="Delete" onclick="deleteExpense('${exp.id}')">🗑️</button>
          </div>
        </div>`;
    }).join('');
}

async function deleteExpense(expenseId) {
  const ok = await confirmDialog('Delete Expense', 'Are you sure you want to delete this expense?');
  if (!ok) return;

  let expenses = Store.get(KEYS.EXPENSES) || [];
  const exp = expenses.find(e => e.id === expenseId);
  expenses = expenses.filter(e => e.id !== expenseId);
  Store.set(KEYS.EXPENSES, expenses);

  if (exp) addActivity(currentEventId, `Deleted expense <strong>${esc(exp.name)}</strong>`);
  showToast('info', 'Expense Deleted');
  renderExpenses();
  calculateSettlements();
  renderEventAnalytics();
  renderReport();
}

/* ============================================================
   15. TABS
   ============================================================ */
function switchTab(btn, tabId) {
  // Update buttons
  btn.closest('.tabs').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Update tab contents
  const parent = btn.closest('.view') || document;
  parent.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  // Render on switch
  if (tabId === 'tab-settlements') calculateSettlements();
  if (tabId === 'tab-analytics-event') renderEventAnalytics();
  if (tabId === 'tab-report') renderReport();
}

/* ============================================================
   16. CALCULATION ENGINE
   ============================================================ */
function calculateSettlements() {
  const members = getEventMembers(currentEventId);
  const expenses = getEventExpenses(currentEventId);
  const memberMap = {};
  members.forEach(m => { memberMap[m.id] = m.name; });

  if (members.length === 0 || expenses.length === 0) {
    document.getElementById('grand-total').innerHTML = '';
    document.getElementById('balance-list').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🤝</div><h3>No Data</h3><p>Add members and expenses first</p></div>`;
    document.getElementById('settlement-list').innerHTML = '';
    document.getElementById('settlement-summary').innerHTML = '';
    document.getElementById('settlement-txn-count').textContent = '';
    return;
  }

  // Grand total
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

  document.getElementById('grand-total').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon success">💰</div>
      <div class="stat-info">
        <div class="stat-value">${formatCurrency(grandTotal)}</div>
        <div class="stat-label">Grand Total Expense</div>
      </div>
    </div>`;

  // Calculate balances
  const balances = {}; // memberId -> { paid: 0, share: 0 }
  members.forEach(m => { balances[m.id] = { paid: 0, share: 0 }; });

  expenses.forEach(exp => {
    // Add paid amounts
    exp.payers.forEach(p => {
      if (balances[p.memberId]) {
        balances[p.memberId].paid += p.amount;
      }
    });

    // Calculate share per participant
    const participantCount = exp.participants.filter(pid => balances[pid]).length;
    if (participantCount > 0) {
      const sharePerPerson = exp.amount / participantCount;
      exp.participants.forEach(pid => {
        if (balances[pid]) {
          balances[pid].share += sharePerPerson;
        }
      });
    }
  });

  // Render balance cards
  const balanceList = document.getElementById('balance-list');
  balanceList.innerHTML = members.map(m => {
    const b = balances[m.id];
    const net = b.paid - b.share;
    let statusClass, statusText, amountClass;
    if (Math.abs(net) < 0.01) {
      statusClass = 'settled'; statusText = 'Settled'; amountClass = 'settled';
    } else if (net > 0) {
      statusClass = 'positive'; statusText = 'Receives'; amountClass = 'positive';
    } else {
      statusClass = 'negative'; statusText = 'Pays'; amountClass = 'negative';
    }

    return `
      <div class="balance-card ${statusClass}">
        <div class="member-avatar">${initials(m.name)}</div>
        <div style="flex:1">
          <div style="font-weight:600; margin-bottom:4px">${esc(m.name)}</div>
          <div style="font-size:12px; color:var(--text-muted)">
            Paid: ${formatCurrency(b.paid)} · Share: ${formatCurrency(b.share)}
          </div>
        </div>
        <div style="text-align:right">
          <div class="balance-amount ${amountClass}">${net >= 0 ? '+' : ''}${formatCurrency(Math.abs(net))}</div>
          <span class="balance-status ${statusClass === 'positive' ? 'receive' : statusClass === 'negative' ? 'pay' : 'settled'}">${statusText}</span>
        </div>
      </div>`;
  }).join('');

  // Settlement algorithm: minimise transactions
  const settlements = computeSettlements(currentEventId);
  renderSettlementTransactions(settlements);
}

function computeSettlements(eventId) {
  const members = getEventMembers(eventId);
  const expenses = getEventExpenses(eventId);
  if (members.length === 0 || expenses.length === 0) return [];

  const memberMap = {};
  members.forEach(m => { memberMap[m.id] = m.name; });

  // Calculate net balance for each member
  const netBalance = {};
  members.forEach(m => { netBalance[m.id] = 0; });

  expenses.forEach(exp => {
    exp.payers.forEach(p => {
      if (netBalance[p.memberId] !== undefined) netBalance[p.memberId] += p.amount;
    });
    const participantCount = exp.participants.filter(pid => netBalance[pid] !== undefined).length;
    if (participantCount > 0) {
      const share = exp.amount / participantCount;
      exp.participants.forEach(pid => {
        if (netBalance[pid] !== undefined) netBalance[pid] -= share;
      });
    }
  });

  // Separate creditors and debtors
  const creditors = []; // positive balance (should receive)
  const debtors = [];   // negative balance (should pay)

  Object.entries(netBalance).forEach(([id, balance]) => {
    if (balance > 0.01) creditors.push({ id, amount: balance });
    else if (balance < -0.01) debtors.push({ id, amount: -balance }); // store as positive
  });

  // Sort descending
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Greedy matching
  const transactions = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const settleAmount = Math.min(creditors[ci].amount, debtors[di].amount);
    if (settleAmount > 0.01) {
      transactions.push({
        from: debtors[di].id,
        fromName: memberMap[debtors[di].id] || '?',
        to: creditors[ci].id,
        toName: memberMap[creditors[ci].id] || '?',
        amount: Math.round(settleAmount * 100) / 100
      });
    }
    creditors[ci].amount -= settleAmount;
    debtors[di].amount -= settleAmount;
    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }

  return transactions;
}

function renderSettlementTransactions(settlements) {
  const listEl = document.getElementById('settlement-list');
  const summaryEl = document.getElementById('settlement-summary');
  const txnCountEl = document.getElementById('settlement-txn-count');

  if (settlements.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><h3>All Settled!</h3><p>No transactions needed</p></div>`;
    summaryEl.innerHTML = '';
    txnCountEl.textContent = 'All Settled';
    return;
  }

  txnCountEl.textContent = `${settlements.length} transaction${settlements.length > 1 ? 's' : ''}`;

  const totalAmount = settlements.reduce((s, t) => s + t.amount, 0);
  summaryEl.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon info">🔄</div>
      <div class="stat-info">
        <div class="stat-value">${settlements.length}</div>
        <div class="stat-label">Transactions Required</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon primary">💸</div>
      <div class="stat-info">
        <div class="stat-value">${formatCurrency(totalAmount)}</div>
        <div class="stat-label">Total Settlement Amount</div>
      </div>
    </div>`;

  listEl.innerHTML = settlements.map(t => `
    <div class="settlement-item">
      <div class="member-avatar" style="width:36px;height:36px;font-size:13px">${initials(t.fromName)}</div>
      <div class="settlement-from">${esc(t.fromName)}</div>
      <div class="settlement-arrow">→</div>
      <div class="member-avatar" style="width:36px;height:36px;font-size:13px;background:linear-gradient(135deg,var(--success),#66BB6A)">${initials(t.toName)}</div>
      <div class="settlement-to">${esc(t.toName)}</div>
      <div class="settlement-amount">${formatCurrency(t.amount)}</div>
    </div>`).join('');
}

/* ============================================================
   17. EVENT ANALYTICS
   ============================================================ */
function renderEventAnalytics() {
  const members = getEventMembers(currentEventId);
  const expenses = getEventExpenses(currentEventId);
  const memberMap = {};
  members.forEach(m => { memberMap[m.id] = m.name; });

  if (expenses.length === 0) {
    document.getElementById('event-analytics-stats').innerHTML = '';
    document.getElementById('event-charts').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📊</div><h3>No Analytics Yet</h3><p>Add expenses to see analytics</p></div>`;
    return;
  }

  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const avgExpense = grandTotal / expenses.length;

  // Highest payer
  const payerTotals = {};
  expenses.forEach(exp => {
    exp.payers.forEach(p => {
      payerTotals[p.memberId] = (payerTotals[p.memberId] || 0) + p.amount;
    });
  });
  const highestPayerId = Object.entries(payerTotals).sort((a, b) => b[1] - a[1])[0];
  const highestPayerName = highestPayerId ? memberMap[highestPayerId[0]] : '–';
  const highestPayerAmount = highestPayerId ? highestPayerId[1] : 0;

  // Highest single expense
  const highestExpense = expenses.reduce((max, e) => e.amount > max.amount ? e : max, expenses[0]);

  // Most expensive category
  const catTotals = {};
  expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('event-analytics-stats').innerHTML = `
    <div class="stat-card animate-slide-up"><div class="stat-icon success">💰</div><div class="stat-info"><div class="stat-value">${formatCurrency(grandTotal)}</div><div class="stat-label">Total Expenses</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon primary">👥</div><div class="stat-info"><div class="stat-value">${members.length}</div><div class="stat-label">Total Members</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon info">🏆</div><div class="stat-info"><div class="stat-value">${esc(highestPayerName)}</div><div class="stat-label">Highest Payer (${formatCurrency(highestPayerAmount)})</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon warning">📈</div><div class="stat-info"><div class="stat-value">${formatCurrency(highestExpense.amount)}</div><div class="stat-label">Highest Expense (${esc(highestExpense.name)})</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon danger">📊</div><div class="stat-info"><div class="stat-value">${formatCurrency(avgExpense)}</div><div class="stat-label">Average Expense</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon primary">🏷️</div><div class="stat-info"><div class="stat-value">${topCat ? topCat[0] : '–'}</div><div class="stat-label">Most Expensive Category</div></div></div>
  `;

  // Charts
  const chartsEl = document.getElementById('event-charts');
  chartsEl.innerHTML = `
    <div class="chart-card">
      <div class="card-title mb-16">Expenses by Category</div>
      <canvas id="chart-category" height="280"></canvas>
    </div>
    <div class="chart-card">
      <div class="card-title mb-16">Member Contributions</div>
      <canvas id="chart-members" height="280"></canvas>
    </div>
  `;

  // Draw category pie chart
  drawPieChart('chart-category', catTotals);

  // Draw member bar chart
  drawBarChart('chart-members', payerTotals, memberMap);
}

/* ============================================================
   18. CANVAS CHARTS (no libraries)
   ============================================================ */
const CHART_COLORS = ['#D2B48C', '#A67C52', '#8B6914', '#C49A6C', '#DEB887', '#CD853F', '#DAA520', '#B8860B', '#F4A460', '#D2691E'];

function drawPieChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) return; // Skip drawing if canvas is hidden/not ready

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const entries = Object.entries(data);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return;

  const cx = width / 2;
  const cy = height / 2 - 20;
  const radius = Math.min(cx, cy) - 20;
  if (radius <= 0) return; // Skip if radius calculation yields 0 or negative

  let startAngle = -Math.PI / 2;
  entries.forEach(([label, value], i) => {
    const sliceAngle = (value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    startAngle += sliceAngle;
  });

  // Legend
  const legendY = height - 30;
  let legendX = 10;
  ctx.font = '12px Inter, sans-serif';
  entries.forEach(([label, value], i) => {
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
    const pct = ((value / total) * 100).toFixed(0);
    const text = `${label} (${pct}%)`;
    ctx.fillText(text, legendX + 16, legendY + 10);
    legendX += ctx.measureText(text).width + 30;
    if (legendX > width - 50) { legendX = 10; }
  });
}

function drawBarChart(canvasId, data, nameMap) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  const width = rect.width;
  const height = rect.height;
  if (width <= 0 || height <= 0) return; // Skip drawing if canvas is hidden/not ready

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const entries = Object.entries(data);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  const padding = { top: 20, right: 20, bottom: 60, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  if (chartW <= 0 || chartH <= 0) return; // Skip if draw area is zero or negative
  const barWidth = Math.min(40, (chartW / entries.length) * 0.6);
  const gap = (chartW - barWidth * entries.length) / (entries.length + 1);

  // Axes
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#ccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // Grid lines & Y labels
  ctx.font = '11px Inter, sans-serif';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#777';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = height - padding.bottom - (chartH * i / 4);
    const val = (maxVal * i / 4);
    ctx.fillText(formatCurrency(val), padding.left - 8, y + 4);
    if (i > 0) {
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-light').trim() || '#eee';
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
  }

  // Bars
  entries.forEach(([id, value], i) => {
    const x = padding.left + gap + i * (barWidth + gap);
    const barH = (value / maxVal) * chartH;
    const y = height - padding.bottom - barH;

    const gradient = ctx.createLinearGradient(x, y, x, height - padding.bottom);
    gradient.addColorStop(0, CHART_COLORS[i % CHART_COLORS.length]);
    gradient.addColorStop(1, CHART_COLORS[(i + 2) % CHART_COLORS.length]);
    ctx.fillStyle = gradient;

    // Rounded top
    const r = Math.min(6, barWidth / 2);
    ctx.beginPath();
    ctx.moveTo(x, height - padding.bottom);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + barWidth - r, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
    ctx.lineTo(x + barWidth, height - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const name = nameMap ? (nameMap[id] || id) : id;
    ctx.save();
    ctx.translate(x + barWidth / 2, height - padding.bottom + 14);
    if (name.length > 8) {
      ctx.rotate(-0.4);
    }
    ctx.fillText(name.length > 10 ? name.slice(0, 9) + '…' : name, 0, 0);
    ctx.restore();
  });
}

/* ============================================================
   19. GLOBAL ANALYTICS
   ============================================================ */
function renderGlobalAnalytics() {
  const events = getUserEvents();
  const allExpenses = getAllUserExpenses();

  if (allExpenses.length === 0) {
    document.getElementById('global-analytics-stats').innerHTML = '';
    document.getElementById('global-charts').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📊</div><h3>No Analytics Data</h3><p>Create events and add expenses to see global analytics</p></div>`;
    return;
  }

  const grandTotal = allExpenses.reduce((s, e) => s + e.amount, 0);
  const totalMembers = new Set();
  events.forEach(ev => {
    getEventMembers(ev.id).forEach(m => totalMembers.add(m.name));
  });

  const avgExpense = grandTotal / allExpenses.length;

  // Category totals
  const catTotals = {};
  allExpenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  // Highest single expense
  const highestExpense = allExpenses.reduce((max, e) => e.amount > max.amount ? e : max, allExpenses[0]);

  document.getElementById('global-analytics-stats').innerHTML = `
    <div class="stat-card animate-slide-up"><div class="stat-icon success">💰</div><div class="stat-info"><div class="stat-value">${formatCurrency(grandTotal)}</div><div class="stat-label">Total Expenses</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon primary">📋</div><div class="stat-info"><div class="stat-value">${events.length}</div><div class="stat-label">Total Events</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon info">👥</div><div class="stat-info"><div class="stat-value">${totalMembers.size}</div><div class="stat-label">Unique Members</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon warning">📈</div><div class="stat-info"><div class="stat-value">${formatCurrency(highestExpense.amount)}</div><div class="stat-label">Highest Expense</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon danger">📊</div><div class="stat-info"><div class="stat-value">${formatCurrency(avgExpense)}</div><div class="stat-label">Average Expense</div></div></div>
    <div class="stat-card animate-slide-up"><div class="stat-icon primary">🏷️</div><div class="stat-info"><div class="stat-value">${topCat ? topCat[0] : '–'}</div><div class="stat-label">Top Category</div></div></div>
  `;

  // Charts
  const chartsEl = document.getElementById('global-charts');
  chartsEl.innerHTML = `
    <div class="chart-card">
      <div class="card-title mb-16">Spending by Category</div>
      <canvas id="global-chart-category" height="280"></canvas>
    </div>
    <div class="chart-card">
      <div class="card-title mb-16">Monthly Expenses</div>
      <canvas id="global-chart-monthly" height="280"></canvas>
    </div>
  `;

  drawPieChart('global-chart-category', catTotals);

  // Monthly data
  const monthlyData = {};
  allExpenses.forEach(e => {
    const key = e.date.substring(0, 7); // YYYY-MM
    monthlyData[key] = (monthlyData[key] || 0) + e.amount;
  });

  const sorted = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0]));
  const monthlyObj = {};
  sorted.forEach(([k, v]) => { monthlyObj[k] = v; });
  drawBarChart('global-chart-monthly', monthlyObj, null);
}

/* ============================================================
   20. EVENT REPORT
   ============================================================ */
function renderReport() {
  const ev = getEventById(currentEventId);
  if (!ev) return;

  const members = getEventMembers(currentEventId);
  const expenses = getEventExpenses(currentEventId);
  const memberMap = {};
  members.forEach(m => { memberMap[m.id] = m.name; });
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const settlements = computeSettlements(currentEventId);

  // Balances
  const balances = {};
  members.forEach(m => { balances[m.id] = { paid: 0, share: 0 }; });
  expenses.forEach(exp => {
    exp.payers.forEach(p => {
      if (balances[p.memberId]) balances[p.memberId].paid += p.amount;
    });
    const count = exp.participants.filter(pid => balances[pid]).length;
    if (count > 0) {
      const share = exp.amount / count;
      exp.participants.forEach(pid => {
        if (balances[pid]) balances[pid].share += share;
      });
    }
  });

  const reportEl = document.getElementById('report-content');
  reportEl.innerHTML = `
    <div class="report-section">
      <h3>📋 Event Summary</h3>
      <div class="profile-details">
        <div class="profile-row"><span class="profile-row-label">Event Name</span><span class="profile-row-value">${esc(ev.name)}</span></div>
        <div class="profile-row"><span class="profile-row-label">Date</span><span class="profile-row-value">${formatDate(ev.date)}</span></div>
        <div class="profile-row"><span class="profile-row-label">Members</span><span class="profile-row-value">${members.map(m => m.name).join(', ')}</span></div>
        <div class="profile-row"><span class="profile-row-label">Total Expenses</span><span class="profile-row-value">${expenses.length}</span></div>
        <div class="profile-row"><span class="profile-row-label">Grand Total</span><span class="profile-row-value">${formatCurrency(grandTotal)}</span></div>
      </div>
    </div>

    <div class="report-section">
      <h3>💸 All Expenses</h3>
      ${expenses.length === 0 ? '<p class="text-muted">No expenses</p>' : expenses.map(exp => `
        <div class="expense-item">
          <div class="expense-cat-icon ${CAT_CLASS[exp.category] || 'cat-misc'}">${CAT_ICONS[exp.category] || '📦'}</div>
          <div class="expense-info">
            <div class="expense-name">${esc(exp.name)}</div>
            <div class="expense-meta">
              <span class="badge badge-neutral">${exp.category}</span>
              <span>📅 ${formatDate(exp.date)}</span>
              <span>Paid by: ${exp.payers.map(p => `${memberMap[p.memberId] || '?'} (${formatCurrency(p.amount)})`).join(', ')}</span>
            </div>
            <div class="expense-meta mt-8">
              <span>Split among: ${exp.participants.map(pid => memberMap[pid] || '?').join(', ')}</span>
            </div>
          </div>
          <div class="expense-amount">${formatCurrency(exp.amount)}</div>
        </div>`).join('')}
    </div>

    <div class="report-section">
      <h3>📊 Member Contributions & Shares</h3>
      <div class="balance-grid">
        ${members.map(m => {
          const b = balances[m.id];
          const net = b.paid - b.share;
          const cls = Math.abs(net) < 0.01 ? 'settled' : net > 0 ? 'positive' : 'negative';
          return `
            <div class="balance-card ${cls}">
              <div class="member-avatar">${initials(m.name)}</div>
              <div style="flex:1">
                <div style="font-weight:600">${esc(m.name)}</div>
                <div style="font-size:12px;color:var(--text-muted)">Paid: ${formatCurrency(b.paid)} · Share: ${formatCurrency(b.share)}</div>
              </div>
              <div class="balance-amount ${cls}">${net >= 0 ? '+' : ''}${formatCurrency(Math.abs(net))}</div>
            </div>`;
        }).join('')}
      </div>
    </div>

    <div class="report-section">
      <h3>🤝 Settlement Transactions</h3>
      ${settlements.length === 0 ? '<p class="text-muted">All settled – no transactions needed!</p>' :
        settlements.map(t => `
          <div class="settlement-item">
            <div class="settlement-from">${esc(t.fromName)}</div>
            <div class="settlement-arrow">→</div>
            <div class="settlement-to">${esc(t.toName)}</div>
            <div class="settlement-amount">${formatCurrency(t.amount)}</div>
          </div>`).join('')}
    </div>
  `;
}

/* ============================================================
   21. EXPORT FEATURES
   ============================================================ */
function exportJSON() {
  const ev = getEventById(currentEventId);
  if (!ev) return;

  const data = {
    event: ev,
    members: getEventMembers(currentEventId),
    expenses: getEventExpenses(currentEventId),
    settlements: computeSettlements(currentEventId),
    exportedAt: new Date().toISOString()
  };

  downloadFile(
    JSON.stringify(data, null, 2),
    `${ev.name.replace(/\s+/g, '_')}_export.json`,
    'application/json'
  );
  showToast('success', 'Exported', 'JSON file downloaded');
}

function exportCSV() {
  const ev = getEventById(currentEventId);
  if (!ev) return;
  const members = getEventMembers(currentEventId);
  const expenses = getEventExpenses(currentEventId);
  const memberMap = {};
  members.forEach(m => { memberMap[m.id] = m.name; });

  let csv = 'Expense Name,Category,Amount,Date,Paid By,Participants\n';
  expenses.forEach(exp => {
    const paidBy = exp.payers.map(p => `${memberMap[p.memberId] || '?'}(${p.amount})`).join('; ');
    const parts = exp.participants.map(pid => memberMap[pid] || '?').join('; ');
    csv += `"${exp.name}","${exp.category}",${exp.amount},"${exp.date}","${paidBy}","${parts}"\n`;
  });

  // Add settlements
  const settlements = computeSettlements(currentEventId);
  csv += '\nSettlement From,Settlement To,Amount\n';
  settlements.forEach(t => {
    csv += `"${t.fromName}","${t.toName}",${t.amount}\n`;
  });

  downloadFile(csv, `${ev.name.replace(/\s+/g, '_')}_export.csv`, 'text/csv');
  showToast('success', 'Exported', 'CSV file downloaded');
}

function exportPDF() {
  // Open print dialog on report tab
  switchTab(document.querySelector('[data-tab="tab-report"]'), 'tab-report');
  setTimeout(() => window.print(), 300);
}

function printReport() {
  window.print();
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================
   22. USER PROFILE
   ============================================================ */
function renderProfile() {
  if (!currentUser) return;
  const events = getUserEvents();
  const totalExpenses = getAllUserExpenses().reduce((s, e) => s + e.amount, 0);

  const el = document.getElementById('profile-card');
  el.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${initials(currentUser.fullName)}</div>
      <div class="profile-info">
        <h2>${esc(currentUser.fullName)}</h2>
        <p>@${esc(currentUser.username)}</p>
      </div>
    </div>
    <div class="profile-details">
      <div class="profile-row"><span class="profile-row-label">Full Name</span><span class="profile-row-value">${esc(currentUser.fullName)}</span></div>
      <div class="profile-row"><span class="profile-row-label">Username</span><span class="profile-row-value">${esc(currentUser.username)}</span></div>
      <div class="profile-row"><span class="profile-row-label">Phone</span><span class="profile-row-value">${esc(currentUser.phone)}</span></div>
      <div class="profile-row"><span class="profile-row-label">Member Since</span><span class="profile-row-value">${formatDate(currentUser.createdAt)}</span></div>
      <div class="profile-row"><span class="profile-row-label">Events Created</span><span class="profile-row-value">${events.length}</span></div>
      <div class="profile-row"><span class="profile-row-label">Total Expenses</span><span class="profile-row-value">${formatCurrency(totalExpenses)}</span></div>
    </div>
    <div class="mt-24">
      <button class="btn btn-danger btn-block" onclick="handleLogout()">🚪 Logout</button>
    </div>
  `;
}

/* ============================================================
   23. KEYBOARD & MISC
   ============================================================ */
// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
