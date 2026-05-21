/**
 * DrainIntel Enterprise — Frontend API Client
 * Include this script in every HTML page:
 *   <script src="drainintel-api.js"></script>
 *
 * It connects to the backend via WebSocket for live updates
 * and exposes helper functions to update each page's DOM.
 */

const DRAININTEL = (() => {
  // ── Endpoint config ─────────────────────────────────────────
  // Auto-derived from the page URL — works on localhost AND on the
  // cloud (https → wss) with ZERO edits, because Express serves these
  // HTML pages from the same origin as the API + WebSocket.
  const API_BASE = window.location.origin + '/api';
  const WS_URL   = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  // MANUAL OVERRIDE — only if you open the HTML file directly (file://)
  // instead of through the server. Uncomment and paste your cloud URL:
  //   const API_BASE = 'https://your-app.onrender.com/api';
  //   const WS_URL   = 'wss://your-app.onrender.com';

  // ── State ──────────────────────────────────────────────────
  let state = {
    sensors:   [],
    stats:     {},
    alerts:    [],
    logs:      [],
    connected: false
  };

  const listeners = [];
  let ws = null;

  // ── WebSocket connection ───────────────────────────────────
  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      state.connected = true;
      updateConnectionBadge(true);
      console.log('[DrainIntel] WebSocket connected');
    };

    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'SENSORS_UPDATE') {
          state.sensors = msg.sensors;
          state.stats   = msg.stats;
          state.alerts  = msg.alerts;
          state.logs    = msg.logs;
          listeners.forEach(fn => fn(state));
          dispatchPageUpdate(state);
        }
      } catch(e) { console.error('[DrainIntel]', e); }
    };

    ws.onclose = () => {
      state.connected = false;
      updateConnectionBadge(false);
      console.log('[DrainIntel] WebSocket disconnected — retrying in 3s');
      setTimeout(connect, 3000);
    };

    ws.onerror = (e) => console.error('[DrainIntel] WS error:', e);
  }

  // ── REST helpers ───────────────────────────────────────────
  async function get(path) {
    const r = await fetch(API_BASE + path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function post(path, body) {
    const r = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  }

  async function put(path, body) {
    const r = await fetch(API_BASE + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  }

  // ── DOM helpers ────────────────────────────────────────────
  function setText(id, val)  { const el = document.getElementById(id); if(el) el.textContent = val; }
  function setHTML(id, val)  { const el = document.getElementById(id); if(el) el.innerHTML  = val;  }
  function setWidth(id, pct) { const el = document.getElementById(id); if(el) el.style.width = pct + '%'; }

  function statusColor(status) {
    return { critical:'#b4002b', warning:'#fd9000', maintenance:'#ffb778', normal:'#00daf3' }[status] || '#00daf3';
  }

  function severityBadge(status) {
    const map = {
      critical:    'bg-[#93000a] text-error border border-error/30',
      warning:     'bg-secondary-container/20 text-secondary border border-secondary/30',
      maintenance: 'bg-secondary/20 text-secondary border border-secondary/30',
      normal:      'bg-primary-fixed-dim/10 text-primary-fixed-dim border border-primary-fixed-dim/20'
    };
    const label = { critical:'FLOOD RISK', warning:'WARNING', maintenance:'MAINTENANCE', normal:'NORMAL' };
    return `<span class="px-2 py-0.5 rounded-full font-label-md text-label-md ${map[status]||map.normal}">${label[status]||'NORMAL'}</span>`;
  }

  function updateConnectionBadge(connected) {
    const el = document.getElementById('di-connection-badge');
    if (!el) return;
    el.innerHTML = connected
      ? `<div class="w-2 h-2 rounded-full bg-primary-fixed-dim animate-pulse"></div>
         <span class="font-label-md text-label-md text-primary-fixed-dim">LIVE</span>`
      : `<div class="w-2 h-2 rounded-full bg-error animate-pulse"></div>
         <span class="font-label-md text-label-md text-error">RECONNECTING</span>`;
  }

  // ══════════════════════════════════════════════════════════
  // PAGE-SPECIFIC UPDATERS
  // ══════════════════════════════════════════════════════════

  function dispatchPageUpdate(state) {
    const page = document.body.dataset.page || '';
    if (page === 'dashboard')    updateDashboard(state);
    if (page === 'network')      updateNetwork(state);
    if (page === 'live-network') updateLiveNetwork(state);
    if (page === 'hazard')       updateHazard(state);
    if (page === 'analytics')    updateAnalytics(state);
    if (page === 'maintenance')  updateMaintenance(state);
    if (page === 'workforce')    updateWorkforce(state);
    if (page === 'scheduler')    updateScheduler(state);
    // always update shared elements
    updateSharedStats(state);
    updateLogs(state);
  }

  // ── SHARED: top stats bar ──────────────────────────────────
  function updateSharedStats({ stats, alerts }) {
    setText('di-stat-total',      stats.total      || '–');
    setText('di-stat-critical',   stats.critical    || 0);
    setText('di-stat-maintenance',stats.maintenance || 0);
    setText('di-stat-operational',stats.operational || '–');
    setText('di-alert-count',     alerts.length     || 0);
    // colour the critical count
    const el = document.getElementById('di-stat-critical');
    if (el) el.style.color = stats.critical > 0 ? '#b4002b' : '#00daf3';
  }

  // ── DASHBOARD (drainintel_enterprise_dashboard.html) ───────
  function updateDashboard({ sensors, stats, alerts, logs }) {
    setText('di-stat-critical',   stats.critical);
    setText('di-stat-operational',stats.operational);
    setText('di-stat-total',      stats.total);

    // Sensor table rows
    const tbody = document.getElementById('di-sensor-tbody');
    if (tbody) {
      tbody.innerHTML = sensors.map(s => `
        <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
          <td class="px-6 py-4 font-mono-data text-primary-fixed-dim font-bold">${s.id}</td>
          <td class="px-6 py-4">
            <div class="font-body-md font-bold text-on-surface">${s.sector}</div>
            <div class="font-label-md text-on-surface-variant">${s.location}</div>
          </td>
          <td class="px-6 py-4">
            <div class="flex items-center gap-3">
              <div class="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden min-w-[100px]">
                <div class="h-full rounded-full transition-all duration-500"
                     style="width:${s.fillPct}%; background:${statusColor(s.cloggingRisk)};
                            box-shadow:0 0 8px ${statusColor(s.cloggingRisk)}"></div>
              </div>
              <span class="font-mono-data font-bold" style="color:${statusColor(s.cloggingRisk)}">${s.fillPct}%</span>
            </div>
          </td>
          <td class="px-6 py-4">
            <span class="font-mono-data text-on-surface">${s.waterDepthCm} cm</span>
          </td>
          <td class="px-6 py-4">
            <div class="flex items-center gap-2">
              <div class="h-1.5 w-16 bg-surface-container-highest rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width:${s.batteryPct}%;
                  background:${s.batteryPct < 20 ? '#b4002b' : s.batteryPct < 40 ? '#ffb778' : '#00daf3'}"></div>
              </div>
              <span class="font-mono-data text-xs ${s.batteryPct < 20 ? 'text-error' : 'text-on-surface-variant'}">${s.batteryPct}%</span>
            </div>
          </td>
          <td class="px-6 py-4">${severityBadge(s.cloggingRisk)}</td>
        </tr>`).join('');
    }

    // Notification bubble
    if (alerts.length > 0) {
      const top = alerts[0];
      setText('di-notif-sector', top.sector);
      setText('di-notif-pct', `${top.fillPct}%`);
      setText('di-notif-location', top.location);
    }
  }

  // ── NETWORK / HAZARD VIEW ──────────────────────────────────
  function updateNetwork({ sensors }) {
    // Update marker fill values on map pins
    sensors.forEach(s => {
      const el = document.querySelector(`[data-sensor-id="${s.id}"]`);
      if (!el) return;
      el.dataset.fill = s.fillPct;
      const dot = el.querySelector('.sensor-dot');
      if (dot) dot.style.background = statusColor(s.cloggingRisk);
      const pct = el.querySelector('.sensor-pct');
      if (pct) pct.textContent = `${s.fillPct}%`;
    });
  }

  function updateHazard({ sensors }) {
    sensors.forEach(s => {
      const bar = document.querySelector(`[data-fill-bar="${s.id}"]`);
      if (bar) { bar.style.width = s.fillPct + '%'; bar.style.background = statusColor(s.cloggingRisk); }
      const txt = document.querySelector(`[data-fill-text="${s.id}"]`);
      if (txt) txt.textContent = s.fillPct + '%';
      const badge = document.querySelector(`[data-status-badge="${s.id}"]`);
      if (badge) badge.innerHTML = severityBadge(s.cloggingRisk);
    });
  }

  // ── LIVE NETWORK (network_view.html — one page bound to one real sensor) ──
  // Binds the MH-772 modal hero readout to a single sensor's live data.
  // Which sensor is set via <body data-sensor-id="..."> (defaults to INFRA-092).
  function updateLiveNetwork({ sensors }) {
    const targetId = document.body.dataset.sensorId || 'INFRA-092';
    const s = sensors.find(x => x.id === targetId);
    if (!s) return;

    const color = statusColor(s.status);

    // Water Level — the hero number + its progress bar
    const level = document.getElementById('di-water-level');
    if (level) { level.textContent = `${s.fillPct}%`; level.style.color = color; }

    const bar = document.getElementById('di-water-bar');
    if (bar) { bar.style.width = s.fillPct + '%'; bar.style.background = color; }

    // Real readings derived from the sensor (no fake flow/prediction)
    setText('di-water-depth', `${s.waterDepthCm} cm`);
    setText('di-battery',     `${s.batteryPct}%`);
    setText('di-signal',      `${s.signalDbm} dBm`);

    // Status pill
    const pill = document.getElementById('di-status-pill');
    if (pill) {
      const label = { critical:'Overflow', warning:'Warning', maintenance:'Maintenance', normal:'Normal' };
      pill.textContent      = label[s.status] || 'Normal';
      pill.style.color       = color;
      pill.style.background  = color + '1a';   // ~10% alpha
      pill.style.borderColor = color + '4d';   // ~30% alpha
    }

    // Map marker colour
    const marker = document.getElementById('di-marker');
    if (marker) marker.style.background = color;

    // Last-updated stamp — honest about simulated vs real hardware
    setText('di-updated', (s.isReal ? 'Live · ' : 'Simulated · ')
      + 'updated ' + new Date(s.lastPulse).toLocaleTimeString());
  }

  // ── ANALYTICS (historical_data_mitigation_analytics.html) ──
  function updateAnalytics({ stats, sensors }) {
    setText('di-health-pct', Math.round(stats.avgHealth) + '%');
    setText('di-operational', stats.operational);
    setText('di-critical-count', stats.critical);

    // Update inline chart bars
    const chartEl = document.getElementById('di-live-chart');
    if (chartEl) {
      const sorted = [...sensors].sort((a,b) => b.fillPct - a.fillPct);
      chartEl.innerHTML = sorted.map(s => `
        <div class="flex items-center gap-3 mb-2">
          <div class="w-24 font-mono-data text-xs text-on-surface-variant">${s.id}</div>
          <div class="flex-1 h-3 bg-surface-container-highest rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700"
                 style="width:${s.fillPct}%; background:${statusColor(s.cloggingRisk)};
                        box-shadow: 0 0 6px ${statusColor(s.cloggingRisk)}60">
            </div>
          </div>
          <span class="w-12 text-right font-mono-data text-xs" style="color:${statusColor(s.cloggingRisk)}">${s.fillPct}%</span>
        </div>`).join('');
    }
  }

  // ── MAINTENANCE / CLEANING SCHEDULER ──────────────────────
  function updateMaintenance({ sensors }) {
    const el = document.getElementById('di-priority-list');
    if (!el) return;
    const ranked = [...sensors].sort((a,b) => b.fillPct - a.fillPct);
    el.innerHTML = ranked.map((s, i) => {
      const priority = s.fillPct > 75 ? 'URGENT' : s.fillPct > 50 ? 'HIGH' : 'MEDIUM';
      const borderColor = s.fillPct > 75 ? '#b4002b' : s.fillPct > 50 ? '#fd9000' : '#00daf3';
      return `
        <div class="p-4 rounded-lg bg-surface-container-high border-l-4 mb-3 transition-all"
             style="border-left-color:${borderColor}">
          <div class="flex justify-between items-start mb-2">
            <div>
              <span class="font-mono-data text-xs text-on-surface-variant">#${i+1} — ${s.id}</span>
              <h3 class="font-headline-sm text-headline-sm text-on-surface">${s.sector} — ${s.location}</h3>
            </div>
            <span class="px-2 py-1 rounded-full text-xs font-bold"
                  style="background:${borderColor}22; color:${borderColor}; border:1px solid ${borderColor}44">
              ${priority}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                   style="width:${s.fillPct}%; background:${borderColor}; box-shadow:0 0 6px ${borderColor}60"></div>
            </div>
            <span class="font-mono-data text-xs font-bold" style="color:${borderColor}">${s.fillPct}% fill</span>
          </div>
          <div class="flex justify-between mt-2 text-xs text-on-surface-variant">
            <span>💧 Water: ${s.waterDepthCm}cm</span>
            <span>🔋 Battery: ${s.batteryPct}%</span>
            <span>📡 Signal: ${s.signalDbm}dBm</span>
          </div>
          <button onclick="DRAININTEL.dispatchTeam('${s.id}','${s.sector}')"
                  class="mt-3 w-full py-2 rounded text-xs font-bold transition-all hover:brightness-110"
                  style="background:${borderColor}; color:#000">
            Assign Team →
          </button>
        </div>`;
    }).join('');
  }

  // ── WORKFORCE / WORK ORDERS ────────────────────────────────
  function updateWorkforce({ sensors }) {
    // Just updates sensor readings shown next to each work order
    sensors.forEach(s => {
      const el = document.querySelector(`[data-wo-sensor="${s.id}"]`);
      if (el) el.textContent = `${s.fillPct}% fill`;
    });
  }

  // ── SCHEDULER ─────────────────────────────────────────────
  function updateScheduler({ sensors }) {
    updateMaintenance({ sensors }); // same logic
  }

  // ── LOGS ──────────────────────────────────────────────────
  function updateLogs({ logs }) {
    const el = document.getElementById('di-logs') || document.getElementById('logs-container');
    if (!el) return;
    const colorMap = { critical:'text-error', warning:'text-secondary', success:'text-success', normal:'text-on-surface-variant' };
    el.innerHTML = logs.map(l =>
      `<div class="${colorMap[l.level]||'text-on-surface-variant'} mb-1">
         <span class="text-on-surface-variant mr-2">[${l.t}]</span>${l.msg}
       </div>`
    ).join('');
    el.scrollTop = 0;
  }

  // ══════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════

  async function dispatchTeam(sensorId, sector) {
    const wo = await post('/work-orders', {
      sensorId, sector,
      type: 'Emergency Dispatch',
      team: 'Team Alpha',
      location: sector,
      etaMinutes: 10
    });
    alert(`✅ Work order ${wo.id} created — Team dispatched to ${sector}`);
  }

  function onUpdate(fn) { listeners.push(fn); }

  async function getHistorical(sensorId) { return get(`/historical/${sensorId}`); }

  function getState() { return state; }

  // ── Init ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    connect();
    // Inject connection badge if placeholder exists
    const badge = document.getElementById('di-connection-badge');
    if (!badge) {
      // Try to inject into the header system status area
      const statusArea = document.querySelector('[data-di-status]');
      if (statusArea) {
        statusArea.insertAdjacentHTML('beforeend',
          `<div id="di-connection-badge" class="flex items-center gap-xs px-3 py-1 bg-surface-container-high rounded-full border border-white/5">
             <div class="w-2 h-2 rounded-full bg-on-surface-variant animate-pulse"></div>
             <span class="font-label-md text-label-md text-on-surface-variant">CONNECTING...</span>
           </div>`
        );
      }
    }
  });

  return { onUpdate, dispatchTeam, getHistorical, getState, connect };
})();
