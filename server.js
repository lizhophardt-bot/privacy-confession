require('dotenv').config();
const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const app      = express();
const PORT     = process.env.PORT           || 3000;
const DB_FILE  = path.join(__dirname, 'confessions.json');
const ADMIN_PW = process.env.ADMIN_PASSWORD;

let adminToken = null;
let lastConfessionAt = 0;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { nextId: 1, rows: [] }; }
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getCookie(req, name) {
  const cookies = req.headers.cookie || '';
  const match = cookies.split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

function adminAuth(req, res, next) {
  if (adminToken && getCookie(req, 'admin_token') === adminToken) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Public routes
app.post('/api/email', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  const data = load();
  if (!data.emails) data.emails = [];
  if (!data.emails.some(e => e.email === email)) {
    data.emails.push({ email, submitted_at: Math.floor(Date.now() / 1000) });
    save(data);
  }
  res.json({ ok: true });
});

app.get('/api/whoami', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  res.json({ ip });
});

app.get('/wall', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'wall.html'));
});

app.post('/api/confession', (req, res) => {
  const now = Date.now();
  if (now - lastConfessionAt < 5000) {
    return res.status(429).json({ error: 'Too many confessions. Please wait a moment.' });
  }
  const text = (req.body.text || '').trim();
  if (!text || text.length > 1000) {
    return res.status(400).json({ error: 'Invalid confession' });
  }
  lastConfessionAt = now;
  const data = load();
  data.rows.push({ id: data.nextId++, text, submitted_at: Math.floor(now / 1000), approved: false });
  save(data);
  res.json({ ok: true });
});

app.get('/api/confessions', (req, res) => {
  const rows = load().rows
    .filter(r => r.approved)
    .sort((a, b) => b.submitted_at - a.submitted_at);
  res.json(rows);
});

// Admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Admin auth
app.post('/api/admin/login', (req, res) => {
  if ((req.body.password || '') === ADMIN_PW) {
    adminToken = crypto.randomBytes(32).toString('hex');
    res.setHeader('Set-Cookie', `admin_token=${adminToken}; HttpOnly; Path=/; SameSite=Strict`);
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  adminToken = null;
  res.setHeader('Set-Cookie', 'admin_token=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// Admin confession management
app.get('/api/admin/confessions', adminAuth, (req, res) => {
  res.json(load().rows.sort((a, b) => b.submitted_at - a.submitted_at));
});

app.post('/api/admin/approve/:id', adminAuth, (req, res) => {
  const data = load();
  const row  = data.rows.find(r => r.id === parseInt(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  row.approved = true;
  save(data);
  res.json({ ok: true });
});

app.post('/api/admin/unapprove/:id', adminAuth, (req, res) => {
  const data = load();
  const row  = data.rows.find(r => r.id === parseInt(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  row.approved = false;
  save(data);
  res.json({ ok: true });
});

app.delete('/api/admin/confession/:id', adminAuth, (req, res) => {
  const data = load();
  const idx  = data.rows.findIndex(r => r.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.rows.splice(idx, 1);
  save(data);
  res.json({ ok: true });
});

app.get('/api/admin/download', adminAuth, (req, res) => {
  res.download(DB_FILE, 'confessions.json');
});

app.get('/api/admin/emails', adminAuth, (req, res) => {
  const emails = (load().emails || []);
  const csv = ['email,submitted_at', ...emails.map(e => `${e.email},${e.submitted_at}`)].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="emails.csv"');
  res.send(csv);
});

if (!ADMIN_PW) {
  console.error('ERROR: ADMIN_PASSWORD env var is not set. Admin login will not work.');
}

app.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
