<!--
  DetailPanel.vue – Right sidebar
  ================================
  Shows detailed information for the selected vehicle, split into two tabs:

    • TRIPS  – trip list with a Chart.js bar chart (max / avg speed per trip).
               Clicking a trip row emits `tripClick` so the map can show pins.
    • ECO    – eco-driving event list with a doughnut chart grouped by type.

  Both tabs share a date-range picker; pressing GO emits `reload` so the
  parent can re-fetch data for the new range.

  Props:
    vehicle      – selected vehicle object, or null when nothing is selected.
    tab          – active tab ('trips' | 'eco').
    trips        – trip records for the current date range.
    ecoEvents    – eco-driving event records for the current date range.
    loadingTrips – true while trip data is being fetched.
    loadingEco   – true while eco data is being fetched.
    fromDate     – start of the date range (YYYY-MM-DD), supports v-model.
    toDate       – end of the date range (YYYY-MM-DD), supports v-model.

  Emits:
    tab               – user switched tabs; payload is the new tab string.
    update:fromDate   – user changed the start date (v-model:fromDate).
    update:toDate     – user changed the end date (v-model:toDate).
    reload            – user clicked the GO button.
    tripClick         – user clicked a trip row; payload is the trip object.
-->
<template>
  <aside class="sidebar-right">

    <!-- Empty state when no vehicle is selected -->
    <div v-if="!vehicle" class="state-msg" style="margin-top:40px">
      Select a vehicle<br/>to view details
    </div>

    <template v-else>

      <!-- ── Vehicle header ────────────────────────────────────────────── -->
      <div class="detail-header">
        <div>
          <div class="detail-name">{{ vehicle.Name }}</div>
          <div class="detail-sub">{{ vehicle.SPZ || 'No plate' }} · {{ vehicle.Code }}</div>
        </div>
        <button class="expand-btn" @click="$emit('toggleExpand')" :title="expanded ? 'Collapse panel' : 'Expand panel'">
          {{ expanded ? '→' : '←' }}
        </button>
      </div>

      <!-- ── Key metrics grid ──────────────────────────────────────────── -->
      <div class="stat-grid">
        <div class="stat-cell">
          <div class="stat-label">Speed</div>
          <div class="stat-value amber">{{ vehicle.Speed }} <span class="unit">km/h</span></div>
        </div>

        <div class="stat-cell">
          <div class="stat-label">Odometer</div>
          <div class="stat-value blue">{{ formatOdometer(vehicle.Odometer) }}</div>
        </div>

        <div class="stat-cell">
          <div class="stat-label">Battery</div>
          <div class="stat-value" :class="vehicle.BatteryPercentage > 20 ? 'green' : 'red'">
            {{ vehicle.BatteryPercentage > 0 ? vehicle.BatteryPercentage + '%' : 'N/A' }}
          </div>
        </div>

        <div class="stat-cell">
          <div class="stat-label">Last seen</div>
          <div class="stat-value" style="font-size:13px;color:var(--text)">
            {{ formatRelative(vehicle.LastPositionTimestamp) }}
          </div>
        </div>
      </div>

      <!-- ── Environment context strip (weather + address) ───────────── -->
      <div v-if="loadingWeather || weather || currentAddress" class="env-strip">
        <div v-if="loadingWeather" class="env-loading">⟳ loading weather…</div>
        <div v-else-if="weather" class="env-weather">
          {{ weather.icon }} {{ weather.label }} · {{ weather.temp }}°C · {{ weather.wind }} km/h wind
        </div>
        <div v-if="currentAddress" class="env-address">📍 {{ currentAddress }}</div>
      </div>

      <!-- ── Tab switcher ──────────────────────────────────────────────── -->
      <div class="tabs">
        <div class="tab" :class="{ active: tab === 'trips' }" @click="$emit('tab', 'trips')">TRIPS</div>
        <div class="tab" :class="{ active: tab === 'eco' }"   @click="$emit('tab', 'eco')">ECO</div>
      </div>

      <!-- ── Date range picker ─────────────────────────────────────────── -->
      <div class="date-row">
        <input
          type="date"
          :value="fromDate"
          @change="$emit('update:fromDate', $event.target.value)"
        />
        <input
          type="date"
          :value="toDate"
          @change="$emit('update:toDate', $event.target.value)"
        />
        <button @click="$emit('reload')">GO</button>
      </div>

      <!-- ── Tab content ───────────────────────────────────────────────── -->
      <div class="tab-content">

        <!-- TRIPS tab -->
        <template v-if="tab === 'trips'">
          <div v-if="loadingTrips" class="state-msg"><span class="spinner" />Loading…</div>
          <div v-else-if="!trips.length" class="state-msg">No trips in this period</div>

          <template v-else>
            <!-- Speed chart – canvas id referenced by App.vue's drawSpeedChart() -->
            <div class="chart-wrap">
              <div class="section-label" style="padding-bottom:6px">Max speed per trip (km/h)</div>
              <canvas id="speedChart" height="100" />
            </div>

            <!-- Trip rows (clicking shows start/end pins on the map) -->
            <div
              v-for="(trip, i) in trips"
              :key="i"
              class="trip-item"
              @click="$emit('tripClick', trip)"
            >
              <div class="trip-row">
                <div class="trip-time">{{ formatDate(trip.StartTime) }}</div>
                <div class="trip-dist">{{ trip.TotalDistance?.toFixed(1) }} km</div>
              </div>
              <div class="trip-addr">{{ trip.StartAddress || 'Start' }} → {{ trip.FinishAddress || 'End' }}</div>
              <div class="trip-speeds">
                <span class="speed-tag avg">avg {{ trip.AverageSpeed }} km/h</span>
                <span class="speed-tag max">max {{ trip.MaxSpeed }} km/h</span>
                <span class="speed-tag muted">{{ trip.TripLength }}</span>
              </div>
            </div>
          </template>
        </template>

        <!-- ECO tab -->
        <template v-if="tab === 'eco'">
          <div v-if="loadingEco" class="state-msg"><span class="spinner" />Loading…</div>
          <div v-else-if="!ecoEvents.length" class="state-msg">No eco events in this period</div>

          <template v-else>
            <!-- Event type doughnut – canvas id referenced by App.vue's drawEcoChart() -->
            <div class="chart-wrap">
              <div class="section-label" style="padding-bottom:6px">Events by type</div>
              <canvas id="ecoChart" height="120" />
            </div>

            <!-- Eco event rows -->
            <div v-for="(ev, i) in ecoEvents" :key="i" class="eco-item" :title="ECO_DESCRIPTIONS[ev.EventType] ?? 'Unknown event type.'">
              <div class="eco-icon" :class="'sev' + ev.EventSeverity">{{ ecoIcon(ev.EventType) }}</div>
              <div class="eco-info">
                <div class="eco-type">{{ ecoTypeName(ev.EventType) }}</div>
                <div class="eco-time">{{ formatDate(ev.Timestamp) }} · {{ ev.Speed > -2147483648 ? ev.Speed + ' km/h' : 'N/A' }}</div>
              </div>
              <span class="sev-badge" :class="'sev' + ev.EventSeverity">{{ sevName(ev.EventSeverity) }}</span>
            </div>
          </template>
        </template>

      </div>
    </template>
  </aside>
</template>

<script setup>
// ---------------------------------------------------------------------------
// Props & emits
// ---------------------------------------------------------------------------

const props = defineProps({
  expanded:       Boolean,
  vehicle:        Object,
  tab:            String,
  trips:          Array,
  ecoEvents:      Array,
  loadingTrips:   Boolean,
  loadingEco:     Boolean,
  fromDate:       String,
  toDate:         String,
  weather:        Object,
  loadingWeather: Boolean,
  currentAddress: String,
})

defineEmits(['tab', 'update:fromDate', 'update:toDate', 'reload', 'tripClick', 'toggleExpand'])

// ---------------------------------------------------------------------------
// Lookup tables for eco-driving event metadata
// ---------------------------------------------------------------------------

/** Tooltip description for each EventType integer. */
const ECO_DESCRIPTIONS = {
  0: 'Unknown event type.',
  1: 'Cornering Left – vehicle turned left too sharply, causing lateral stress on tyres.',
  2: 'Cornering Right – vehicle turned right too sharply, causing lateral stress on tyres.',
  3: 'Cornering – sharp cornering detected, direction unspecified.',
  4: 'Hard Acceleration – driver pressed the accelerator aggressively, increasing fuel consumption.',
  5: 'Hard Braking – driver braked sharply, causing excessive tyre and brake wear.',
  6: 'Bump – vehicle hit a pothole or speed bump at excessive speed.',
  7: 'Long Clutch – clutch pedal held down for too long, causing unnecessary wear.',
  8: 'Neutral Drive – vehicle was driven in neutral, wasting fuel and reducing engine braking.',
  9: 'Freewheeling – engine switched off while moving, reducing control and safety.',
}

/** Human-readable name for each EventType integer. */
const ECO_NAMES = {
  0: 'Unknown',
  1: 'Cornering L',
  2: 'Cornering R',
  3: 'Cornering',
  4: 'Hard Accel',
  5: 'Hard Brake',
  6: 'Bump',
  7: 'Long Clutch',
  8: 'Neutral Drive',
  9: 'Freewheeling',
}

/** Icon character for each EventType integer. */
const ECO_ICONS = {
  0: '?',
  1: '↙',
  2: '↘',
  3: '↕',
  4: '⚡',
  5: '⛔',
  6: '💥',
  7: '⚙',
  8: 'N',
  9: '〜',
}

/** Severity label for each EventSeverity integer (0–3). */
const SEV_NAMES = { 0: 'none', 1: 'low', 2: 'med', 3: 'high' }

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const ecoTypeName = (t) => ECO_NAMES[t] ?? 'Unknown'
const ecoIcon     = (t) => ECO_ICONS[t] ?? '?'
const sevName     = (s) => SEV_NAMES[s] ?? '?'

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Formats an ISO datetime string as a short localised date+time.
 * Uses Czech locale to match the rest of the UI.
 *
 * @param {string | null | undefined} str
 * @returns {string}
 */
const formatDate = (str) =>
  str
    ? new Date(str).toLocaleString('cs-CZ', {
        month:  '2-digit',
        day:    '2-digit',
        hour:   '2-digit',
        minute: '2-digit',
      })
    : '—'

/**
 * Formats an ISO datetime string as a human-readable relative time
 * (e.g. "just now", "5m ago", "2h ago", "3d ago").
 *
 * @param {string | null | undefined} str
 * @returns {string}
 */
const formatRelative = (str) => {
  if (!str) return '—'
  const mins = Math.floor((Date.now() - new Date(str)) / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

/**
 * Converts a raw odometer value (metres) to a rounded kilometre string.
 *
 * @param {number | null | undefined} val - Odometer in metres.
 * @returns {string}
 */
const formatOdometer = (val) => (val ? `${(val / 1000).toFixed(0)} km` : '—')
</script>
