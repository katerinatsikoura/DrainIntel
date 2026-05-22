# DrainIntel Enterprise

## Τι είναι αυτό

Έξυπνο σύστημα παρακολούθησης της στάθμης νερού σε φρεάτια — πανεπιστημιακό
project. Full-stack εφαρμογή: Node.js backend (Express + WebSocket), στατικό
frontend (HTML + Tailwind), απλό login/register flow, και firmware για έναν
πραγματικό αισθητήρα.

**Single-sensor prototype:** υπάρχει **ένας** πραγματικός αισθητήρας, ο
`INFRA-092` (Waveshare ESP32-S3 + HC-SR04). Μέχρι να συνδεθεί το hardware, ο
αισθητήρας τρέχει σε **simulation** — το dashboard το δηλώνει καθαρά ("Simulated").
Μόλις το ESP32 στείλει την πρώτη πραγματική μέτρηση, κλειδώνει σε **live** δεδομένα
και η προσομοίωση σταματά.

---

## Tech stack

- **Backend:** Node.js (≥18), Express, `ws` (WebSocket)
- **Frontend:** στατικά HTML + Tailwind (CDN), vanilla JS (`drainintel-api.js`)
- **Auth:** in-memory χρήστες, password hashing με το built-in `crypto` (scrypt)
- **Hardware:** ESP32-S3 + HC-SR04 — `drainintel_sensor/drainintel_sensor.ino`
- **Δεν υπάρχει βάση δεδομένων** — όλα τα δεδομένα είναι in-memory.

---

## Εγκατάσταση & Εκτέλεση

1. Εγκατέστησε Node.js (LTS) από https://nodejs.org
2. Μέσα στον φάκελο του project:
   ```bash
   npm install
   npm start
   ```
3. Άνοιξε browser στο: **http://localhost:3000/**

---

## Ροή σελίδων

```
/  →  Splash  →  Login  →  Dashboard
                 │
                 └─ Register → Setup 1 → 2 → 3 → Success → Dashboard
```

- **Entry point:** `http://localhost:3000/` (σερβίρει το splash screen, χωρίς redirect)
- **Demo λογαριασμός:** `demo@drainintel.io` / `demo1234`
- **Dashboard:** `network_view_with_analytics_deep_link.html` — η μόνη σελίδα
  συνδεδεμένη με **live** δεδομένα (ο αισθητήρας INFRA-092)
- Sidebar dashboard: Map / Operations / Workforce / Analytics

> ⚠️ Μόνο το **network view** δείχνει live δεδομένα. Οι σελίδες operations /
> analytics / workforce είναι στατικά UI mockups (design από Google Stitch).

---

## API Endpoints

| Method | Endpoint | Περιγραφή |
|--------|----------|-----------|
| GET  | `/api/sensors` | Όλοι οι αισθητήρες (enriched) |
| GET  | `/api/sensors/:id` | Ένας αισθητήρας |
| GET  | `/api/historical/:id` | Ιστορικό αισθητήρα |
| POST | `/api/sensor-reading` | **Είσοδος πραγματικής μέτρησης από το ESP32** |
| GET  | `/api/network-stats` | Συνολικά στατιστικά |
| GET  | `/api/alerts` | Ενεργές ειδοποιήσεις |
| GET  | `/api/work-orders` | Εντολές εργασίας |
| POST | `/api/work-orders` | Δημιουργία εντολής |
| PUT  | `/api/work-orders/:id` | Ενημέρωση εντολής |
| GET  | `/api/rainfall-forecast` | Πρόγνωση βροχόπτωσης |
| GET  | `/api/cleaning-priorities` | AI-ranked λίστα καθαρισμών |
| GET  | `/api/logs` | Τελευταία log entries |
| POST | `/api/auth/register` | Εγγραφή χρήστη `{name,email,password}` |
| POST | `/api/auth/login` | Σύνδεση `{email,password}` |
| GET  | `/api/auth/me` | Τρέχων χρήστης (Bearer token) |

**WebSocket:** `ws://localhost:3000` (ή `wss://` στο cloud) — στέλνει μήνυμα
`SENSORS_UPDATE` κάθε 2 δευτερόλεπτα, και αμέσως μετά από κάθε πραγματική μέτρηση.

---

## Δομή δεδομένων αισθητήρα

```json
{
  "id": "INFRA-092",
  "sector": "U-01",
  "location": "University Test Rig",
  "lat": 37.968, "lng": 23.765,
  "maxDepthCm": 100,
  "distanceCm": 30,
  "fillPct": 70,
  "waterDepthCm": 70,
  "batteryPct": 100,
  "signalDbm": -50,
  "status": "warning",
  "cloggingRisk": "warning",
  "isAlert": false,
  "isReal": true,
  "lastPulse": 1779388925862
}
```

**Λογική στάθμης:**
- `distanceCm` = απόσταση αισθητήρα από την επιφάνεια του νερού (cm)
- `fillPct` = (1 − distanceCm / maxDepthCm) × 100
- `fillPct > 75%` → **FLOOD RISK** · `fillPct > 50%` → **WARNING**
- `isReal` = `true` όταν τα δεδομένα έρχονται από το πραγματικό ESP32 (αλλιώς simulation)

---

## Σύνδεση πραγματικού αισθητήρα (ESP32)

Firmware: **`drainintel_sensor/drainintel_sensor.ino`** — άνοιξέ το στο Arduino IDE
(Board: *ESP32S3 Dev Module*).

Στο config block στην αρχή του sketch:
- `WIFI_SSID` / `WIFI_PASSWORD` — δίκτυο **2.4 GHz** (hotspot κινητού — **όχι** eduroam)
- `SERVER_URL` — π.χ. `https://<app>.onrender.com/api/sensor-reading`
- `API_KEY` — μόνο αν έχεις ορίσει `INGEST_API_KEY` στον server

**Συνδεσμολογία HC-SR04 → ESP32-S3:**
- `VCC → 5V`, `GND → GND`
- `TRIG → GPIO 5`
- `ECHO → GPIO 4` **μέσω διαιρέτη τάσης 1 kΩ + 2 kΩ** — το ECHO βγάζει 5 V, ενώ
  τα GPIO του ESP32-S3 αντέχουν μόνο 3.3 V.

Το ESP32 στέλνει `{ "sensorId": "INFRA-092", "distanceCm": <τιμή> }` κάθε 5 δευτερόλεπτα.
Με την πρώτη μέτρηση, ο INFRA-092 γίνεται "Live" και η προσομοίωση σταματά γι' αυτόν.

---

## Deployment (Render)

1. Κάνε push το repo σε GitHub.
2. Render → **New → Web Service** → σύνδεσε το repo.
3. Build command: `npm install` — Start command: `node server.js`
   (η Render δίνει αυτόματα τη μεταβλητή `PORT`).
4. *(προαιρετικά)* Environment variable `INGEST_API_KEY` για προστασία του
   endpoint εισόδου μετρήσεων.
5. Πάρε το URL: `https://<app>.onrender.com`

**Σημειώσεις:**
- Το free tier της Render «κοιμάται» μετά από ~15 λεπτά χωρίς traffic — το πρώτο
  load μετά είναι αργό (~30–60s). Όσο το ESP32 στέλνει κάθε 5s, παραμένει ξύπνιο.
- Όλα τα δεδομένα είναι in-memory — **χάνονται σε κάθε restart/redeploy**. Ο demo
  λογαριασμός (`demo@drainintel.io`) υπάρχει πάντα γιατί δημιουργείται στο startup.

---

## Αρχεία

| Αρχείο | Περιγραφή |
|--------|-----------|
| `server.js` | Backend — Express + WebSocket, API, auth, προσομοίωση αισθητήρα |
| `drainintel-api.js` | Frontend client — WebSocket + ενημέρωση DOM |
| `package.json` | Dependencies (`express`, `ws`, `cors`) |
| `drainintel_sensor/drainintel_sensor.ino` | Firmware ESP32-S3 + HC-SR04 |
| `onboarding_splash_screen.html` | Splash / αρχική (`/`) |
| `onboarding_login.html` | Login |
| `onboarding_registration.html` | Register |
| `onboarding_municipality_select.html` | Select Municipality |
| `onboarding_success.html` | Ολοκλήρωση setup |
| `network_view_with_analytics_deep_link.html` | **Live dashboard** (συνδεδεμένο με τον αισθητήρα) |
| `operations_prioritized_maintenance_alert_feed.html` | Λίστα συντήρησης (στατικό mockup) |
| `historical_data_mitigation_analytics.html` | Analytics (στατικό mockup) |
| `workforce_athens_sector_control.html` | Workforce (στατικό mockup) |
---

## Troubleshooting

**"Cannot find module 'express'"** → τρέξε ξανά `npm install`.

**Οι σελίδες δεν φορτώνουν δεδομένα** → βεβαιώσου ότι ο server τρέχει, και άνοιξε
τις μέσω `http://localhost:3000/` (όχι απευθείας από το filesystem με `file://`).

**Το dashboard με στέλνει στο login** → χρειάζεται σύνδεση· χρησιμοποίησε τον demo
λογαριασμό `demo@drainintel.io` / `demo1234`.

**Το ESP32 δεν συνδέεται στο Wi-Fi** → το ESP32-S3 πιάνει μόνο 2.4 GHz· χρησιμοποίησε
hotspot κινητού, όχι eduroam.
