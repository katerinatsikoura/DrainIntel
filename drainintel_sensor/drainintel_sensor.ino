/* ============================================================================
 * DrainIntel Enterprise — Real Sensor Firmware
 * Board : Waveshare ESP32-S3
 * Sensor: HC-SR04 ultrasonic distance sensor
 *
 * WHAT IT DOES
 *   Every 5 seconds it measures the distance from the sensor down to the
 *   water surface and POSTs it to the DrainIntel cloud backend as JSON:
 *       { "sensorId": "INFRA-092", "distanceCm": 37.4 }
 *   The backend converts distance -> water fill % and pushes it live to the
 *   dashboard (network_view.html).
 *
 * ----------------------------------------------------------------------------
 * 1) ARDUINO IDE SETUP
 *    - Install the "esp32" board package by Espressif (Boards Manager).
 *    - Tools -> Board -> "ESP32S3 Dev Module".
 *    - Tools -> USB CDC On Boot -> "Enabled"  (so Serial Monitor works).
 *    - Serial Monitor baud: 115200.
 *
 * 2) WIRING  (HC-SR04  ->  ESP32-S3)
 *    HC-SR04 VCC   ->  ESP32-S3 5V  (USB 5V / VBUS pin) — HC-SR04 needs 5V.
 *    HC-SR04 GND   ->  ESP32-S3 GND
 *    HC-SR04 TRIG  ->  GPIO 4       (3.3V output is fine for TRIG)
 *    HC-SR04 ECHO  ->  GPIO 5  ***THROUGH A VOLTAGE DIVIDER***
 *
 *    >>> IMPORTANT: HC-SR04 ECHO outputs 5V. ESP32-S3 GPIO pins are 3.3V
 *        ONLY — feeding 5V in can damage the pin. Drop it with a divider:
 *
 *            ECHO ---[ R1 = 1k ]---+--- GPIO 5
 *                                  |
 *                                [ R2 = 2k ]
 *                                  |
 *                                 GND
 *        (1k + 2k gives 5V * 2k/(1k+2k) = 3.3V. Any 1:2 ratio works.)
 *
 *    Quick desk-demo shortcut (less reliable): power the HC-SR04 from the
 *    3.3V pin instead of 5V. Then ECHO is ~3.3V and no divider is needed,
 *    but range/accuracy suffer. The 5V + divider wiring above is correct.
 *
 * 3) WI-FI
 *    The ESP32-S3 only joins 2.4 GHz Wi-Fi (not 5 GHz). University Wi-Fi
 *    (eduroam) is WPA2-Enterprise and will NOT work with the simple
 *    WiFi.begin() below — for the presentation use a PHONE HOTSPOT set to
 *    2.4 GHz, and put its name/password in the config block below.
 * ==========================================================================*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "secrets.h"   // WIFI_SSID, WIFI_PASSWORD, API_KEY — copy secrets.h.example -> secrets.h

/* ===================== CONFIG ============================================ */
//
// Wi-Fi credentials + API key are NOT in this file — they live in secrets.h,
// which is git-ignored so the password never reaches GitHub.
// SETUP: copy "secrets.h.example" to "secrets.h" and fill in your values.

// --- Cloud backend endpoint (not secret — safe to keep in the sketch) ---
const char* SERVER_URL = "https://drainintel.onrender.com/api/sensor-reading";

// --- Identity & timing ----------------------------------------------------
const char*        SENSOR_ID       = "INFRA-092";  // must match a sensor id in server.js
const unsigned int POST_INTERVAL_MS = 5000;        // send a reading every 5 s

// --- HC-SR04 pins — match the collaborator's existing board wiring --------
const int TRIG_PIN = 4;
const int ECHO_PIN = 5;

/* ======================================================================== */

// Measure distance once. Returns cm, or -1 if no echo (out of range).
float readDistanceOnce() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // pulseIn returns the echo pulse width in microseconds.
  // 30000 us timeout ≈ 5 m max range.
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (duration == 0) return -1.0f;             // no echo

  return (duration * 0.0343f) / 2.0f;          // speed of sound 343 m/s
}

// Average several samples for a steadier reading (HC-SR04 is noisy).
float readDistanceCm() {
  const int SAMPLES = 5;
  float sum = 0;
  int   valid = 0;
  for (int i = 0; i < SAMPLES; i++) {
    float d = readDistanceOnce();
    if (d > 0) { sum += d; valid++; }
    delay(60);                                 // HC-SR04 needs ~60ms between pings
  }
  return valid > 0 ? (sum / valid) : -1.0f;
}

void connectWiFi() {
  Serial.printf("Connecting to Wi-Fi \"%s\" ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000UL) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConnected. IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWi-Fi connection failed — will retry on next loop.");
  }
}

void postReading(float distanceCm) {
  // HTTPS client. setInsecure() skips TLS certificate validation — acceptable
  // for a student demo; the data is non-sensitive sensor telemetry.
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, SERVER_URL)) {
    Serial.println("http.begin() failed — check SERVER_URL.");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  if (strlen(API_KEY) > 0) http.addHeader("X-API-Key", API_KEY);

  // Build JSON by hand — no external library needed.
  String body = String("{\"sensorId\":\"") + SENSOR_ID +
                "\",\"distanceCm\":" + String(distanceCm, 1) + "}";

  int code = http.POST(body);
  Serial.printf("POST %s  ->  HTTP %d\n", body.c_str(), code);
  if (code > 0) {
    Serial.println("  response: " + http.getString());
  } else {
    Serial.printf("  request failed: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== DrainIntel Sensor — INFRA-092 ===");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  float distance = readDistanceCm();
  if (distance > 0) {
    Serial.printf("Distance: %.1f cm\n", distance);
    if (WiFi.status() == WL_CONNECTED) {
      postReading(distance);
    }
  } else {
    Serial.println("No echo — check wiring and that an object is in range (2–400 cm).");
  }

  delay(POST_INTERVAL_MS);
}
