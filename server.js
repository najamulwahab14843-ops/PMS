
const crypto = require('crypto');

const MANAGER_USERS = [
  // Default starter account — username: manager / password: changeme123
  // Change this (see instructions above) before sharing this app with anyone.
  { username: 'Najam', salt: '922bf3ddc515a56c88cfb119d523022e', hash: '2e24ac5cef7ca37411c09a6f20fd7906cfdddb82bfff96c7d1ea06cd787f4c5ae21babcca949576dd7812f0658d04388405bc51c26275b2975cce435e9e3d0ae'  },
{ username: 'Sasha', salt: '10abba7ac98a6b5e7235abd656cf006d', hash: '0043bcec77752a070b5854f249f3e8ef4bc503fadea0f5f4f5623342e880fc506547bbc1f2bb0c977a197823c3d9705d40fc26848dd575e51fd3f38ab67b4077'  },
{  username: 'Viktorija', salt: '95c95adf522ac6b620e42fbc795cf7b0', hash: 'ab29dcf2e25d5a4211fdb9d4588f42a02bbf4fb80b8f40a42c2e2dbc74e481effe15424bbc9f040967bea6221af91c5ca026616817e32a8e031195e5d665d1a3'  }
];

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = Buffer.from(hashPassword(password, salt), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------------------------------------------------------- */
/* Manager auth — in-memory login sessions                           */
/* ---------------------------------------------------------------- */
const sessions = new Map(); // token -> username

function requireManagerAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (token && sessions.has(token)) {
    req.managerUser = sessions.get(token);
    return next();
  }
  res.status(401).json({ error: 'Unauthorized — please sign in as a manager.' });
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const match = MANAGER_USERS.find(u => u.username === username);
  if (!match || !verifyPassword(password || '', match.salt, match.hash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, username);
  res.json({ ok: true, token, username });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- */
/* Storage: a single JSON file acting as the "central sheet".        */
/* No preset locations — a location appears the moment a promoter    */
/* checks in there or adds it.                                       */
/* ---------------------------------------------------------------- */
const DEFAULT_LOCATIONS = [];

function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const fresh = { locations: DEFAULT_LOCATIONS, data: {}, postcodes: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
  }
}
function readDb() {
  ensureDb();
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!db.postcodes) db.postcodes = {};
  return db;
}
function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function ensureLocation(db, loc, postcode) {
  if (!db.locations.includes(loc)) db.locations.push(loc);
  if (!db.data[loc]) {
    db.data[loc] = { checkin: null, attendance: [], hourlyUpdates: [], inventoryReports: [], eod: null };
  }
  if (!db.data[loc].attendance) db.data[loc].attendance = []; // migrate older entries
  if (postcode && postcode.trim()) db.postcodes[loc] = postcode.trim();
  return db.data[loc];
}
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------------------------------------------------------------- */
/* API                                                                */
/* ---------------------------------------------------------------- */

// Full dashboard state — manager dashboard only
app.get('/api/state', requireManagerAuth, (req, res) => {
  res.json(readDb());
});

// Lightweight single-location state for the promoter portal — no login needed
app.get('/api/promoter-state', (req, res) => {
  const { location } = req.query;
  if (!location) return res.status(400).json({ error: 'location is required.' });
  const db = readDb();
  const d = db.data[location] || { checkin: null, attendance: [], hourlyUpdates: [], inventoryReports: [], eod: null };
  res.json({ data: d });
});

// Locations
app.get('/api/locations', (req, res) => {
  res.json(readDb().locations);
});
app.post('/api/locations', (req, res) => {
  const { name, postcode } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Location name is required.' });
  const db = readDb();
  ensureLocation(db, name.trim(), postcode);
  writeDb(db);
  res.json({ ok: true, locations: db.locations });
});

// Check-in (also logs an attendance record)
app.post('/api/checkin', (req, res) => {
  const { location, name, postcode } = req.body;
  if (!location || !name) return res.status(400).json({ error: 'location and name are required.' });
  const db = readDb();
  const loc = ensureLocation(db, location, postcode);
  const now = Date.now();
  const date = todayStr();
  loc.checkin = { name, ts: now, date, checkedOutTs: null };
  loc.attendance.push({ name, checkinTs: now, checkoutTs: null, date });
  writeDb(db);
  res.json({ ok: true });
});

// Check-out — closes the most recent open attendance record for this person today
app.post('/api/checkout', (req, res) => {
  const { location, name } = req.body;
  if (!location || !name) return res.status(400).json({ error: 'location and name are required.' });
  const db = readDb();
  const loc = ensureLocation(db, location);
  const today = todayStr();
  const now = Date.now();
  for (let i = loc.attendance.length - 1; i >= 0; i--) {
    const a = loc.attendance[i];
    if (a.name === name && a.date === today && !a.checkoutTs) {
      a.checkoutTs = now;
      break;
    }
  }
  if (loc.checkin && loc.checkin.name === name && loc.checkin.date === today) {
    loc.checkin.checkedOutTs = now;
  }
  writeDb(db);
  res.json({ ok: true });
});

// Hourly update (now also accepts itemsSold: [{item, qty}])
app.post('/api/hourly', (req, res) => {
  const { location, promoter, footfall, activity, lowStock, issues, comments, itemsSold } = req.body;
  if (!location || !promoter) return res.status(400).json({ error: 'location and promoter are required.' });
  const db = readDb();
  const loc = ensureLocation(db, location);
  loc.hourlyUpdates.push({
    ts: Date.now(), promoter,
    footfall: footfall || 0,
    activity: activity || '', lowStock: !!lowStock,
    issues: issues || '', comments: comments || '',
    itemsSold: Array.isArray(itemsSold) ? itemsSold : []
  });
  writeDb(db);
  res.json({ ok: true });
});

// Inventory report
app.post('/api/inventory', (req, res) => {
  const { location, promoter, stock, missing, oos, lowStockAlert } = req.body;
  if (!location || !promoter) return res.status(400).json({ error: 'location and promoter are required.' });
  const db = readDb();
  const loc = ensureLocation(db, location);
  loc.inventoryReports.push({
    ts: Date.now(), promoter,
    stock: Array.isArray(stock) ? stock : [],
    missing: missing || '', oos: oos || '',
    lowStockAlert: !!lowStockAlert
  });
  writeDb(db);
  res.json({ ok: true });
});

// End of day report (one per promoter per location per day — overwrites)
app.post('/api/eod', (req, res) => {
  const { location, promoter, sales, samples, inventory, flavours, summary, feedback } = req.body;
  if (!location || !promoter) return res.status(400).json({ error: 'location and promoter are required.' });
  const db = readDb();
  const loc = ensureLocation(db, location);
  loc.eod = {
    ts: Date.now(), date: todayStr(), promoter,
    sales: sales || 0, samples: samples || 0,
    inventory: inventory || '', flavours: flavours || '',
    summary: summary || '', feedback: feedback || ''
  };
  writeDb(db);
  res.json({ ok: true });
});

// Reset demo data (manager only)
app.post('/api/reset', requireManagerAuth, (req, res) => {
  writeDb({ locations: DEFAULT_LOCATIONS, data: {}, postcodes: {} });
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// Fallback to index.html for any non-API route (simple SPA-style serving)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDb();
app.listen(PORT, () => {
  console.log(`PromoTrack server running at http://localhost:${PORT}`);
  console.log(`Manager login username(s): ${MANAGER_USERS.map(u => u.username).join(', ')}`);
});