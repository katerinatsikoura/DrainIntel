# DrainIntel Enterprise

<https://drainintel.onrender.com>

## Τι είναι αυτό

Έξυπνο σύστημα παρακολούθησης της στάθμης νερού σε φρεάτια — πανεπιστημιακό
project. Full-stack εφαρμογή: Node.js backend (Express + WebSocket), στατικό
frontend (HTML + Tailwind), login/register flow με βάση δεδομένων στο cloud, και
firmware για έναν πραγματικό αισθητήρα.

**Single-sensor prototype:** υπάρχει **ένας** πραγματικός αισθητήρας, ο
`INFRA-092` (Waveshare ESP32-S3 + HC-SR04). Μέχρι να συνδεθεί το hardware, ο
αισθητήρας τρέχει σε **simulation** — το dashboard το δηλώνει καθαρά ("Simulated").
Μόλις το ESP32 στείλει την πρώτη πραγματική μέτρηση, κλειδώνει σε **live** δεδομένα
και η προσομοίωση σταματά.

---

## Tech stack

- **Backend:** Node.js (≥18), Express, `ws` (WebSocket)
- **Frontend:** στατικά HTML + Tailwind (CDN), vanilla JS (`drainintel-api.js`)
- **Database:** MongoDB Atlas (cloud) μέσω του official `mongodb` driver
- **Auth:** εγγραφή/σύνδεση μέσω MongoDB (collection `users`), password hashing
  με το built-in `crypto` (PBKDF2-SHA512)
- **Hardware:** ESP32-S3 + HC-SR04 — `drainintel_sensor/drainintel_sensor.ino`

### Persistence — τι αποθηκεύεται πού

| Δεδομένα | Πού ζουν |
| ----------------------------------------- | ---------------------------------- |
| Χρήστες (`users`) | MongoDB Atlas (μόνιμα) |
| Ιστορικό τηλεμετρίας πραγματικού αισθητήρα (`telemetry`) | MongoDB Atlas (μόνιμα) |
| Κατάσταση αισθητήρων, work orders, πρόγνωση βροχής, logs | In-memory (χάνονται σε restart) |

> Ο **demo λογαριασμός** και το token session (`/api/auth/me`) είναι in-memory.
> Οι κανονικές εγγραφές/συνδέσεις (`/api/auth/register`, `/api/auth/login`)
> περνούν από τη MongoDB.

---

## Εγκατάσταση & Εκτέλεση

1. Εγκατέστησε Node.js (LTS) από <https://nodejs.org>
2. Όρισε το connection string της MongoDB ως env variable (απαραίτητο για το auth):

   ```
   export MONGO_URI="mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority"
   ```

   (Προαιρετικά: `PORT` για άλλη θύρα, `INGEST_API_KEY` για κλείδωμα του endpoint
   εισόδου μετρήσεων.)
3. Μέσα στον φάκελο του project:

   ```
   npm install
   npm start
   ```

4. Άνοιξε browser στο: **<http://localhost:4000/>**
   (ή στη θύρα που έχεις ορίσει στο `PORT`)

---

## Ροή σελίδων

```
/  →  Splash  →  Login  →  Dashboard
                 │
                 └─ Register → Municipality Select → Success → Dashboard
```

- **Entry point:** `http://localhost:4000/` (σερβίρει το splash screen, χωρίς redirect)
- **Demo λογαριασμός:** `demo@drainintel.io` / `demo1234`
- **Dashboard:** `network` — η μόνη σελίδα συνδεδεμένη με **live** δεδομένα
  (ο αισθητήρας INFRA-092)
- Sidebar dashboard: Map / Operations / Workforce / Analytics

> ⚠️ Μόνο το **network** δείχνει live δεδομένα. Οι σελίδες operations /
> analytics / workforce είναι στατικά UI mockups (design από Google Stitch).

---

## API Endpoints

| Method | Endpoint                   | Περιγραφή                                     |
| ------ | -------------------------- | --------------------------------------------- |
| GET    | `/api/sensors`             | Όλοι οι αισθητήρες (enriched)                 |
| GET    | `/api/sensors/:id`         | Ένας αισθητήρας                               |
| GET    | `/api/historical/:id`      | Ιστορικό αισθητήρα (από MongoDB αν είναι live) |
| POST   | `/api/sensor-reading`      | **Είσοδος πραγματικής μέτρησης από το ESP32** |
| GET    | `/api/network-stats`       | Συνολικά στατιστικά                           |
| GET    | `/api/alerts`              | Ενεργές ειδοποιήσεις                          |
| GET    | `/api/work-orders`         | Εντολές εργασίας                              |
| POST   | `/api/work-orders`         | Δημιουργία εντολής                            |
| PUT    | `/api/work-orders/:id`     | Ενημέρωση εντολής                            |
| GET    | `/api/rainfall-forecast`   | Πρόγνωση βροχόπτωσης                          |
| GET    | `/api/cleaning-priorities` | AI-ranked λίστα καθαρισμών                    |
| GET    | `/api/logs`                | Τελευταία log entries                         |
| POST   | `/api/auth/register`       | Εγγραφή χρήστη `{name,email,password}` (MongoDB) |
| POST   | `/api/auth/login`          | Σύνδεση `{email,password}` (MongoDB)          |
| GET    | `/api/auth/me`             | Τρέχων χρήστης (Bearer token)                 |

**WebSocket:** `ws://localhost:4000` (ή `wss://` στο cloud) — στέλνει μήνυμα
`SENSORS_UPDATE` κάθε 2 δευτερόλεπτα, και αμέσως μετά από κάθε πραγματική μέτρηση.

---

## Δομή δεδομένων αισθητήρα

```
{
  "id": "INFRA-092",
  "sector": "U-01",
  "location": "University Test Rig",
  "lat": 37.968, "lng": 23.765,
  "maxDepthCm": 18,
  "distanceCm": 12,
  "fillPct": 33.3,
  "waterDepthCm": 6,
  "batteryPct": 100,
  "signalDbm": -50,
  "status": "normal",
  "cloggingRisk": "normal",
  "isAlert": false,
  "isReal": true,
  "lastPulse": 1779388925862
}
```

**Λογική στάθμης:**

- `distanceCm` = απόσταση αισθητήρα από την επιφάνεια του νερού (cm)
- `maxDepthCm` = συνολικό βάθος του φρεατίου — **βαθμονόμησέ το στο δικό σου rig**
- `fillPct` = (1 − distanceCm / maxDepthCm) × 100
- `fillPct > 75%` → **FLOOD RISK** · `fillPct > 50%` → **WARNING**
- `isReal` = `true` όταν τα δεδομένα έρχονται από το πραγματικό ESP32 (αλλιώς simulation)

---

## Σύνδεση πραγματικού αισθητήρα (ESP32)

Firmware: **`drainintel_sensor/drainintel_sensor.ino`** — άνοιξέ το στο Arduino IDE
(Board: *ESP32S3 Dev Module*, USB CDC On Boot: *Enabled*).

**Ρυθμίσεις Wi-Fi / API key:** δεν βρίσκονται μέσα στο sketch. Ζουν στο αρχείο
`secrets.h`, που είναι git-ignored ώστε ο κωδικός να μη φτάνει ποτέ στο GitHub.
Αντίγραψε το `secrets.h.example` σε `secrets.h` και συμπλήρωσε:

- `WIFI_SSID` / `WIFI_PASSWORD` — δίκτυο **2.4 GHz** (hotspot κινητού — **όχι** eduroam)
- `API_KEY` — μόνο αν έχεις ορίσει `INGEST_API_KEY` στον server

Το endpoint του cloud (`SERVER_URL`) δεν είναι μυστικό και ορίζεται μέσα στο sketch,
π.χ. `https://drainintel.onrender.com/api/sensor-reading`.

**Συνδεσμολογία HC-SR04 → ESP32-S3:**

- `VCC → 5V`, `GND → GND`
- `TRIG → GPIO 4`
- `ECHO → GPIO 5` **μέσω διαιρέτη τάσης 1 kΩ + 2 kΩ** — το ECHO βγάζει 5 V, ενώ
  τα GPIO του ESP32-S3 αντέχουν μόνο 3.3 V.

Το ESP32 στέλνει `{ "sensorId": "INFRA-092", "distanceCm": <τιμή> }` κάθε 5 δευτερόλεπτα.
Με την πρώτη μέτρηση, ο INFRA-092 γίνεται "Live" και η προσομοίωση σταματά γι' αυτόν.

---

## Αρχεία

| Αρχείο                                               | Περιγραφή                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `server.js`                                          | Backend — Express + WebSocket, API, auth (MongoDB), προσομοίωση αισθητήρα |
| `drainintel-api.js`                                  | Frontend client — WebSocket + ενημέρωση DOM                     |
| `package.json`                                       | Dependencies (`express`, `ws`, `cors`, `mongodb`)               |
| `design.md`                                          | UI design system ("Mission Control") — χρώματα, τυπογραφία, layout |
| `drainintel_sensor/drainintel_sensor.ino`            | Firmware ESP32-S3 + HC-SR04                                     |
| `onboarding_splash_screen.html`                      | Splash / αρχική (`/`)                                           |
| `onboarding_login.html`                              | Login                                                           |
| `onboarding_registration.html`                       | Register                                                        |
| `onboarding_municipality_select.html`                | Select Municipality                                             |
| `onboarding_success.html`                            | Ολοκλήρωση setup                                                |
| `network_view_with_analytics_deep_link.html`         | **Live dashboard** (συνδεδεμένο με τον αισθητήρα)               |
| `operations_prioritized_maintenance_alert_feed.html` | Λίστα συντήρησης (στατικό mockup)                              |
| `historical_data_mitigation_analytics.html`          | Analytics (στατικό mockup)                                      |
| `workforce_athens_sector_control.html`               | Workforce (στατικό mockup)                                      |

---

## Troubleshooting

**"Cannot find module 'express'"** → τρέξε ξανά `npm install`.

**Το auth δεν δουλεύει / σφάλμα στο register-login** → βεβαιώσου ότι έχεις ορίσει
σωστά το `MONGO_URI` και ότι ο server συνδέθηκε στη MongoDB (μήνυμα
"Connected to MongoDB Atlas" στο console).

**Οι σελίδες δεν φορτώνουν δεδομένα** → βεβαιώσου ότι ο server τρέχει, και άνοιξε
τις μέσω `http://localhost:4000/` (όχι απευθείας από το filesystem με `file://`).

**Το dashboard με στέλνει στο login** → χρειάζεται σύνδεση· χρησιμοποίησε τον demo
λογαριασμό `demo@drainintel.io` / `demo1234`.

**Το ESP32 δεν συνδέεται στο Wi-Fi** → το ESP32-S3 πιάνει μόνο 2.4 GHz· χρησιμοποίησε
hotspot κινητού, όχι eduroam.

**Δεν φτάνουν μετρήσεις στο dashboard** → έλεγξε τη συνδεσμολογία (TRIG → GPIO 4,
ECHO → GPIO 5 μέσω διαιρέτη τάσης) και ότι το `SERVER_URL` στο sketch δείχνει στο
σωστό `/api/sensor-reading`.
