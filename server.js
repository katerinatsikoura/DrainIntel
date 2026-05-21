/**
 * DrainIntel Enterprise — Backend Server
 * Node.js + Express + WebSocket
 *
 * HOW TO RUN:
 *   1. npm install
 *   2. npm start            (or: npm run dev)
 *   3. Open http://localhost:3000/onboarding_splash_screen.html in browser
 *
 * REAL SENSOR INTEGRATION:
 *   Real ESP32 devices POST live readings to  POST /api/sensor-reading.
 *   The moment a sensor reports real data, its simulation is frozen so the
 *   live value is never overwritten. See simulateSensors() + the endpoint.
 *
 * CLOUD DEPLOYMENT:
 *   Listens on process.env.PORT (set by Render/Railway) and falls back to 3000.
 */

const express  = require('express');
const http     = require('http');
const WebSocket= require('ws');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const { MongoClient } = require('mongodb');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serves HTML files

// Landing page — serve the splash screen at "/" directly (no redirect, URL stays "/")
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'onboarding_splash_screen.html'));
});

// ════════════════════════════════════════════════════════════
// MONGODB ATLAS USER DB
// ════════════════════════════════════════════════════════════
const MONGO_URI = process.env.MONGO_URI || "ΒΑΛΕ_ΕΔΩ_ΤΟ_CONNECTION_STRING_SOU"; 
let dbClient, mongoDb;

async function connectDB() {
  try {
    dbClient = new MongoClient(MONGO_URI);
    await dbClient.connect();
    mongoDb = dbClient.db('drainintel');
    console.log("📁 Connected to MongoDB Atlas successfully!");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}
connectDB();

// ════════════════════════════════════════════════════════════
// IN-MEMORY DATABASE
// Sensors represent ESP32 units inside manholes (φρεάτια).
// "distanceCm" = cm from ultrasonic sensor to water surface.
// When distanceCm is LOW → water is HIGH (close to sensor).
// maxDepthCm = total depth of the manhole.
// fillPct = (1 - distanceCm/maxDepthCm) * 100
// ════════════════════════════════════════════════════════════

const ALERT_THRESHOLD  = 75;  // % fill → FLOOD RISK
const WARNING_THRESHOLD= 50;  // % fill → WARNING

const db = {
  // Single-sensor prototype: INFRA-092 is the ONLY sensor. It is the real
  // Waveshare ESP32-S3 + HC-SR04 unit. (No simulated fleet — there is one
  // physical sensor.) It drifts gently until the device first POSTs, then
  // locks to live hardware data.
  sensors: [
    {
      // ── REAL SENSOR ─────────────────────────────────────────
      // INFRA-092 is the physical Waveshare ESP32-S3 + HC-SR04 unit.
      // It starts "empty" and switches to live data the first time the
      // device POSTs to /api/sensor-reading (after which it is no longer
      // simulated). CALIBRATE maxDepthCm to YOUR rig: it is the distance
      // in cm from the HC-SR04 face down to the bottom of the manhole/tank.
      id: 'INFRA-092', sector: 'U-01', location: 'University Test Rig',
      lat: 37.9680, lng: 23.7650,
      maxDepthCm: 100, distanceCm: 100,   // distanceCm = maxDepthCm → 0% fill (empty)
      batteryPct: 100, signalDbm: -50, lastPulse: Date.now(),
      status: 'normal', history: []
    }
  ],

  workOrders: [
    {
      id: 'WO-2847', sector: 'A-12', location: 'Syntagma Square',
      type: 'Emergency Response', team: 'Team Beta',
      status: 'dispatched', progress: 40, createdAt: Date.now() - 720000,
      etaMinutes: 8, sensorId: 'ESP-A127'
    },
    {
      id: 'WO-2848', sector: 'B-04', location: 'Monastiraki Area',
      type: 'Cleaning Unit', team: 'Team Alpha',
      status: 'in_progress', progress: 70, createdAt: Date.now() - 2700000,
      etaMinutes: 20, sensorId: 'ESP-B304'
    },
    {
      id: 'WO-2849', sector: 'C-07', location: 'Plaka District',
      type: 'Battery Replacement', team: 'Team Charlie',
      status: 'pending', progress: 0, createdAt: Date.now() - 300000,
      etaMinutes: 45, sensorId: 'ESP-C019'
    }
  ],

  rainfallForecast: [
    { day: 'Mon', predicted: 8,  capacity: 100 },
    { day: 'Tue', predicted: 12, capacity: 100 },
    { day: 'Wed', predicted: 18, capacity: 100 },
    { day: 'Thu', predicted: 110, capacity: 100 },
    { day: 'Fri', predicted: 135, capacity: 100 },
    { day: 'Sat', predicted: 145, capacity: 100 },
    { day: 'Sun', predicted: 20, capacity: 100 }
  ],

  // Log ring buffer (last 200 entries)
  logs: []
};

// isReal flips to true once a sensor reports real data via POST /api/sensor-reading.
db.sensors.forEach(s => { s.isReal = false; });

// ════════════════════════════════════════════════════════════
// AUTH — simple in-memory users (demo-grade, no database).
// Registered users are lost on server restart; the seeded demo
// account below always works. Passwords are hashed with Node's
// built-in crypto (scrypt) — no external dependency.
// ════════════════════════════════════════════════════════════

const users    = [];          // { name, email, passHash }
const sessions = new Map();   // token -> email

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 32).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function issueToken(email) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, email);
  return token;
}

function userByToken(req) {
  const auth  = req.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const email = sessions.get(token);
  return email ? users.find(u => u.email === email) : null;
}

// Seeded demo account — guarantees login works even after a cloud redeploy.
users.push({
  name: 'Demo Operator',
  email: 'demo@drainintel.io',
  passHash: hashPassword('demo1234')
});

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function fillPct(sensor) {
  const water = sensor.maxDepthCm - sensor.distanceCm;
  return Math.max(0, Math.min(100, (water / sensor.maxDepthCm) * 100));
}

function waterDepthCm(sensor) {
  return Math.max(0, sensor.maxDepthCm - sensor.distanceCm);
}

function enrichSensor(s) {
  const pct = fillPct(s);
  return {
    ...s,
    fillPct:      Math.round(pct * 10) / 10,
    waterDepthCm: Math.round(waterDepthCm(s) * 10) / 10,
    cloggingRisk: pct > ALERT_THRESHOLD ? 'critical'
                : pct > WARNING_THRESHOLD ? 'warning' : 'normal',
    isAlert:      pct > ALERT_THRESHOLD || s.batteryPct < 20
  };
}

function addLog(msg, level = 'normal') {
  const entry = {
    t:     new Date().toISOString().slice(11, 19),
    msg,
    level  // 'normal' | 'warning' | 'critical' | 'success'
  };
  db.logs.unshift(entry);
  if (db.logs.length > 200) db.logs.pop();
  return entry;
}

function networkStats() {
  const enriched = db.sensors.map(enrichSensor);
  const critical    = enriched.filter(s => s.fillPct > ALERT_THRESHOLD || s.batteryPct < 20).length;
  const maintenance = enriched.filter(s => s.fillPct > WARNING_THRESHOLD && s.fillPct <= ALERT_THRESHOLD).length;
  const operational = db.sensors.length - critical - maintenance;
  const avgHealth   = 100 - (critical * 15 + maintenance * 5);
  return { total: db.sensors.length, critical, maintenance, operational, avgHealth };
}

// recompute a sensor's status from its current values
function recomputeStatus(sensor) {
  const pct = fillPct(sensor);
  if      (pct > ALERT_THRESHOLD || sensor.batteryPct < 20) sensor.status = 'critical';
  else if (pct > WARNING_THRESHOLD)                          sensor.status = 'warning';
  else if (sensor.batteryPct < 30)                           sensor.status = 'maintenance';
  else                                                        sensor.status = 'normal';
}

// Build the SENSORS_UPDATE payload sent to dashboards over WebSocket.
function snapshot() {
  return {
    type:    'SENSORS_UPDATE',
    sensors: db.sensors.map(enrichSensor),
    stats:   networkStats(),
    alerts:  db.sensors.filter(s => fillPct(s) > ALERT_THRESHOLD || s.batteryPct < 20).map(enrichSensor),
    logs:    db.logs.slice(0, 20),
    ts:      Date.now()
  };
}

// Push the latest snapshot to every connected dashboard immediately.
function broadcast() {
  const payload = JSON.stringify(snapshot());
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

// ════════════════════════════════════════════════════════════
// SENSOR SIMULATOR
// Runs every 2 seconds, updates distanceCm with realistic
// drift and random spikes (like rainfall or blockage events).
// Sensors flagged isReal are SKIPPED — they are driven by the
// real ESP32 hardware via POST /api/sensor-reading.
// ════════════════════════════════════════════════════════════

let tick = 0;

function simulateSensors() {
  tick++;
  db.sensors.forEach(sensor => {
    // Real sensors are never simulated — their value comes from the device.
    if (sensor.isReal) return;

    // Gentle drift so the dashboard isn't dead before the hardware connects.
    const noise = (Math.random() - 0.5) * 1.5;
    sensor.distanceCm = Math.max(2, Math.min(
      sensor.maxDepthCm - 2,
      sensor.distanceCm + 0.2 + noise
    ));

    // Slow battery drain
    if (tick % 150 === 0 && sensor.batteryPct > 5) {
      sensor.batteryPct = Math.max(5, sensor.batteryPct - 1);
    }

    sensor.lastPulse = Date.now();

    // Update status
    recomputeStatus(sensor);

    // Store history point every 10 ticks (~20s)
    if (tick % 10 === 0) {
      sensor.history.push({
        ts:          Date.now(),
        distanceCm:  Math.round(sensor.distanceCm * 10) / 10,
        fillPct:     Math.round(fillPct(sensor) * 10) / 10
      });
      if (sensor.history.length > 288) sensor.history.shift(); // keep 24h
    }
  });

  // Log notable events
  const critical = db.sensors.filter(s => fillPct(s) > ALERT_THRESHOLD);
  if (critical.length > 0 && tick % 15 === 0) {
    critical.forEach(s => {
      addLog(`ALERT: ${s.id} (${s.sector}) fill at ${Math.round(fillPct(s))}% — overflow risk`, 'critical');
    });
  }
  if (tick % 20 === 0) {
    const r = db.sensors[Math.floor(Math.random() * db.sensors.length)];
    addLog(`Telemetry sync: ${r.id} — ${Math.round(fillPct(r))}% fill, ${r.batteryPct}% battery`, 'normal');
  }

  // Broadcast via WebSocket
  broadcast();
}

setInterval(simulateSensors, 2000);
simulateSensors(); // initial run

// ════════════════════════════════════════════════════════════
// REST API
// ════════════════════════════════════════════════════════════

// GET /api/sensors — all sensors enriched
app.get('/api/sensors', (req, res) => {
  res.json(db.sensors.map(enrichSensor));
});

// GET /api/sensors/:id — single sensor
app.get('/api/sensors/:id', (req, res) => {
  const s = db.sensors.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(enrichSensor(s));
});

// GET /api/historical/:id — last 24h history
app.get('/api/historical/:id', (req, res) => {
  const s = db.sensors.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({ sensorId: s.id, sector: s.sector, history: s.history });
});

// ════════════════════════════════════════════════════════════
// REAL SENSOR INGEST
// ESP32 hardware POSTs live readings here. Body: { sensorId, distanceCm }.
// The reporting sensor is flagged isReal → its simulation stops, so the
// real value is never overwritten. Other sensors keep simulating.
// ════════════════════════════════════════════════════════════

// Optional shared secret. Leave INGEST_API_KEY unset to keep the endpoint
// open (fine for a short demo). Set it in the cloud env to require the
// ESP32 to send a matching X-API-Key header.
const INGEST_API_KEY = process.env.INGEST_API_KEY || '';

// POST /api/sensor-reading — live reading from a real ESP32 device
app.post('/api/sensor-reading', (req, res) => {
  if (INGEST_API_KEY && req.get('X-API-Key') !== INGEST_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing X-API-Key' });
  }

  const { sensorId, distanceCm } = req.body || {};
  if (typeof sensorId !== 'string' || !Number.isFinite(distanceCm)) {
    return res.status(400).json({ error: 'Body must be { sensorId: string, distanceCm: number }' });
  }

  const sensor = db.sensors.find(s => s.id === sensorId);
  if (!sensor) return res.status(404).json({ error: `Unknown sensor: ${sensorId}` });

  // Apply the real reading (clamped to the sensor's physical range) and
  // freeze this sensor's simulation.
  sensor.distanceCm = Math.max(2, Math.min(sensor.maxDepthCm - 2, distanceCm));
  sensor.lastPulse  = Date.now();
  sensor.isReal     = true;
  recomputeStatus(sensor);

  const pct = fillPct(sensor);
  sensor.history.push({
    ts:         Date.now(),
    distanceCm: Math.round(sensor.distanceCm * 10) / 10,
    fillPct:    Math.round(pct * 10) / 10
  });
  if (sensor.history.length > 288) sensor.history.shift();

  addLog(`Live reading: ${sensor.id} → ${Math.round(sensor.distanceCm)}cm (${Math.round(pct)}% fill)`,
         pct > ALERT_THRESHOLD ? 'critical' : 'success');

  // Push the update to every dashboard immediately (no refresh needed).
  broadcast();

  res.json(enrichSensor(sensor));
});

// GET /api/network-stats
app.get('/api/network-stats', (req, res) => {
  res.json(networkStats());
});

// GET /api/alerts
app.get('/api/alerts', (req, res) => {
  const alerts = db.sensors
    .map(enrichSensor)
    .filter(s => s.fillPct > ALERT_THRESHOLD || s.batteryPct < 20)
    .map(s => ({
      id:       s.id,
      sector:   s.sector,
      location: s.location,
      fillPct:  s.fillPct,
      type:     s.batteryPct < 20 ? 'LOW_BATTERY'
              : s.fillPct > ALERT_THRESHOLD ? 'FLOOD_RISK' : 'WARNING',
      severity: s.fillPct > ALERT_THRESHOLD ? 'critical' : 'maintenance'
    }));
  res.json(alerts);
});

// GET /api/work-orders
app.get('/api/work-orders', (req, res) => {
  res.json(db.workOrders);
});

// POST /api/work-orders — create new
app.post('/api/work-orders', (req, res) => {
  const wo = {
    id:         `WO-${Date.now()}`,
    ...req.body,
    status:     'pending',
    progress:   0,
    createdAt:  Date.now()
  };
  db.workOrders.unshift(wo);
  addLog(`Work order ${wo.id} created for ${wo.sector}`, 'success');
  res.status(201).json(wo);
});

// PUT /api/work-orders/:id — update status
app.put('/api/work-orders/:id', (req, res) => {
  const wo = db.workOrders.find(x => x.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Not found' });
  Object.assign(wo, req.body);
  addLog(`Work order ${wo.id} updated → ${wo.status}`, 'normal');
  res.json(wo);
});

// GET /api/rainfall-forecast
app.get('/api/rainfall-forecast', (req, res) => {
  res.json(db.rainfallForecast);
});

// GET /api/cleaning-priorities — AI-ranked list
app.get('/api/cleaning-priorities', (req, res) => {
  const ranked = db.sensors
    .map(enrichSensor)
    .sort((a, b) => b.fillPct - a.fillPct)
    .map((s, i) => ({
      rank:       i + 1,
      sensorId:   s.id,
      sector:     s.sector,
      location:   s.location,
      fillPct:    s.fillPct,
      cloggingEst: Math.min(100, Math.round(s.fillPct * 0.9)),
      priority:   s.fillPct > ALERT_THRESHOLD ? 'URGENT'
                : s.fillPct > WARNING_THRESHOLD ? 'HIGH' : 'MEDIUM'
    }));
  res.json(ranked);
});

// GET /api/logs
app.get('/api/logs', (req, res) => {
  res.json(db.logs.slice(0, 50));
});

// ════════════════════════════════════════════════════════════
// AUTH API — simple register / login / me
// ════════════════════════════════════════════════════════════

// AUTHENTICATION ENDPOINTS WITH MONGODB
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const usersCollection = mongoDb.collection('users');
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

    const newUser = {
      id: crypto.randomUUID(),
      name,
      email,
      password: `${salt}:${hashedPassword}`,
      createdAt: new Date()
    };

    await usersCollection.insertOne(newUser);
    
    // Προσθήκη στο log του server (κρατάμε τη λειτουργικότητα που ήδη είχες)
    addLog(`New user registered: ${email}`, 'success');
    
    res.status(201).json({ success: true, user: { id: newUser.id, name, email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const usersCollection = mongoDb.collection('users');
    const user = await usersCollection.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const [salt, storedHash] = user.password.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

    if (hash !== storedHash) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    addLog(`User logged in: ${email}`, 'success');
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me — return the current operator for a Bearer token
app.get('/api/auth/me', (req, res) => {
  const user = userByToken(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: { name: user.name, email: user.email } });
});

// ════════════════════════════════════════════════════════════
// WEBSOCKET — clients connect and receive live updates
// ════════════════════════════════════════════════════════════
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');
  addLog('New dashboard client connected', 'success');
  // Send initial snapshot immediately
  ws.send(JSON.stringify(snapshot()));
  ws.on('close', () => console.log('Client disconnected'));
});

// ════════════════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 DrainIntel Backend running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  GET  /api/sensors`);
  console.log(`  GET  /api/sensors/:id`);
  console.log(`  GET  /api/historical/:id`);
  console.log(`  POST /api/sensor-reading   ← real ESP32 ingest`);
  console.log(`  GET  /api/network-stats`);
  console.log(`  GET  /api/alerts`);
  console.log(`  GET  /api/work-orders`);
  console.log(`  POST /api/work-orders`);
  console.log(`  PUT  /api/work-orders/:id`);
  console.log(`  GET  /api/rainfall-forecast`);
  console.log(`  GET  /api/cleaning-priorities`);
  console.log(`  GET  /api/logs`);
  console.log(`  POST /api/auth/register`);
  console.log(`  POST /api/auth/login`);
  console.log(`  GET  /api/auth/me`);
  console.log(`\n🔑 Demo login: demo@drainintel.io / demo1234`);
  console.log(`📂 HTML files served at http://localhost:${PORT}/<filename>.html\n`);
});
