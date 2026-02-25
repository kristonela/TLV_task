<!--
  App.vue – Root component
  ========================
  Owns the top-level layout (header + three-column grid) and coordinates
  state between the three child components:

    • VehicleList   – left sidebar, fleet overview & vehicle selection
    • MapView       – centre panel, Leaflet map
    • DetailPanel   – right sidebar, per-vehicle trips / eco-driving data

  All domain state lives in the three composables imported below; this
  component is responsible only for wiring them together and handling
  cross-composable side-effects (e.g. panning the map when a vehicle is
  selected, or re-drawing charts after data loads).
-->
<template>
  <!-- ── Header bar ──────────────────────────────────────────────────────── -->
  <header>
    <div class="logo">
      <div class="logo-dot" />
      GPS DOZOR · FLEET OPS
    </div>

    <div class="header-right">
      <div class="badge">GROUP: <span>{{ groupCode || '—' }}</span></div>
      <div class="badge">VEHICLES: <span>{{ vehicles.length }}</span></div>
      <div v-if="lastRefresh" class="badge">SYNC: <span>{{ lastRefresh }}</span></div>
    </div>
  </header>

  <!-- ── Three-column grid ───────────────────────────────────────────────── -->
  <div class="app-grid" :class="{ 'panel-expanded': panelExpanded }">
    <!-- Left sidebar: vehicle list + fleet stats -->
    <VehicleList
      :vehicles="vehicles"
      :selected="selectedVehicle"
      :loading="loadingVehicles"
      :movingCount="movingCount"
      :idleCount="idleCount"
      :avgSpeed="avgSpeed"
      @select="onSelectVehicle"
    />

    <!-- Centre: Leaflet map -->
    <MapView
      :mode="mapMode"
      :hasVehicle="!!selectedVehicle"
      @mode="onMapMode"
      @fitAll="fitAll(vehicles)"
      @refresh="refresh"
    />

    <!-- Right sidebar: trips / eco-driving details -->
    <DetailPanel
      :vehicle="selectedVehicle"
      :tab="activeTab"
      :trips="trips"
      :ecoEvents="ecoEvents"
      :loadingTrips="loadingTrips"
      :loadingEco="loadingEco"
      v-model:fromDate="fromDate"
      v-model:toDate="toDate"
      :weather="weather"
      :loadingWeather="loadingWeather"
      :currentAddress="currentAddress"
      :expanded="panelExpanded"
      @tab="onTabChange"
      @reload="onReload"
      @tripClick="drawTripPins"
      @toggleExpand="panelExpanded = !panelExpanded"
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { Chart } from 'chart.js/auto'

import VehicleList  from './components/VehicleList.vue'
import MapView      from './components/MapView.vue'
import DetailPanel  from './components/DetailPanel.vue'

import { useFleet }         from './composables/useFleet.js'
import { useVehicleDetail } from './composables/useVehicleDetail.js'
import { useMap }           from './composables/useMap.js'
import { useWeather }       from './composables/useWeather.js'
import { reverseGeocode }   from './api/geocoding.js'

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

const {
  groupCode, vehicles, loading: loadingVehicles,
  lastRefresh, movingCount, idleCount, avgSpeed,
  init, refresh,
} = useFleet()

const {
  trips, ecoEvents, loadingTrips, loadingEco,
  fromDate, toDate,
  fetchTrips, fetchEco, fetchHistory,
} = useVehicleDetail()

const { updateMarkers, drawHistory, drawTripPins, fitAll, panTo, clearHistory } = useMap('map')

const { weather, loadingWeather, fetchWeather } = useWeather()

// ---------------------------------------------------------------------------
// Local UI state
// ---------------------------------------------------------------------------

/** Currently selected vehicle object, or null when none is selected. */
const selectedVehicle = ref(null)

/** Reverse-geocoded street address for the selected vehicle's position, or null. */
const currentAddress = ref(null)

/** Active tab in the detail panel: `'trips'` or `'eco'`. */
const activeTab = ref('trips')

/** Whether the right detail panel is in expanded (wide) mode. */
const panelExpanded = ref(false)

/** Map display mode: `'live'` shows live markers; `'history'` shows route polylines. */
const mapMode = ref('live')

// Chart.js instances – kept at module scope so they can be destroyed before
// re-creating (prevents canvas reuse warnings).
let speedChart = null
let ecoChart   = null

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  await init()
})

// Whenever the vehicle list updates, refresh live markers on the map
watch(vehicles, (v) => updateMarkers(v, onSelectVehicle))

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handles vehicle selection from the list or from a map marker click.
 * - Switches the map to live mode and removes any history layers.
 * - Pans the map to the vehicle's last known position.
 * - Loads trips for the default date range and draws the speed chart.
 *
 * @param {object} v - Vehicle object from the API.
 */
async function onSelectVehicle(v) {
  selectedVehicle.value = v
  mapMode.value = 'live'
  clearHistory()
  panTo(v)

  // Clear enrichment data immediately so the panel doesn't show stale values
  currentAddress.value = null

  // Reset the detail panel to the trips tab with a clean slate
  activeTab.value = 'trips'
  trips.value     = []
  ecoEvents.value = []

  await fetchTrips(v.Code)
  await nextTick() // wait for the canvas to render before drawing
  drawSpeedChart()

  // Fire-and-forget: enrich with weather + address (non-critical)
  const lat = parseFloat(v.LastPosition?.Latitude)
  const lng = parseFloat(v.LastPosition?.Longitude)
  if (!isNaN(lat) && !isNaN(lng)) {
    fetchWeather(lat, lng)
    fetchAddress(lat, lng)
  }
}

/**
 * Reverse-geocodes lat/lng via Nominatim and stores a short "Road, City" label
 * in `currentAddress`. Falls back to the full display_name if the structured
 * address fields are not available. Errors are silently ignored.
 *
 * @param {number} lat
 * @param {number} lng
 */
async function fetchAddress(lat, lng) {
  try {
    const result  = await reverseGeocode(lat, lng)
    const addr    = result.address ?? {}
    const road    = addr.road ?? addr.pedestrian ?? addr.path ?? ''
    const city    = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? ''
    currentAddress.value = (road && city) ? `${road}, ${city}` : (result.display_name ?? null)
  } catch (err) {
    console.warn('[fetchAddress] geocoding failed:', err)
  }
}

/**
 * Handles the map mode toggle (live ↔ history).
 * In history mode the last 7 days of GPS positions are fetched and drawn.
 *
 * @param {'live' | 'history'} mode
 */
async function onMapMode(mode) {
  mapMode.value = mode

  if (mode === 'history' && selectedVehicle.value) {
    const data = await fetchHistory(selectedVehicle.value.Code)
    drawHistory(data?.[0]?.Positions)
  } else {
    clearHistory()
    updateMarkers(vehicles.value, onSelectVehicle)
  }
}

/**
 * Handles tab switches in the detail panel.
 * Fetches the relevant data and re-draws the appropriate chart.
 *
 * @param {'trips' | 'eco'} tab
 */
async function onTabChange(tab) {
  activeTab.value = tab
  if (!selectedVehicle.value) return

  if (tab === 'trips') {
    await fetchTrips(selectedVehicle.value.Code)
    await nextTick()
    drawSpeedChart()
  } else {
    await fetchEco(selectedVehicle.value.Code)
    await nextTick()
    drawEcoChart()
  }
}

/**
 * Handles the "GO" reload button in the date-range row.
 * Re-fetches data for the active tab using the currently selected date range.
 */
async function onReload() {
  if (!selectedVehicle.value) return

  if (activeTab.value === 'trips') {
    await fetchTrips(selectedVehicle.value.Code)
    await nextTick()
    drawSpeedChart()
  } else {
    await fetchEco(selectedVehicle.value.Code)
    await nextTick()
    drawEcoChart()
  }
}

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------

/**
 * Renders (or re-renders) the per-trip speed bar chart in the detail panel.
 * Destroys the previous Chart.js instance to avoid canvas conflicts.
 */
function drawSpeedChart() {
  const ctx = document.getElementById('speedChart')
  if (!ctx || !trips.value.length) return

  speedChart?.destroy()

  speedChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trips.value.map((_, i) => `T${i + 1}`),
      datasets: [
        {
          label: 'Max speed',
          data: trips.value.map((t) => t.MaxSpeed),
          backgroundColor: 'rgba(255,71,87,0.6)',
          borderColor: '#ff4757',
          borderWidth: 1,
        },
        {
          label: 'Avg speed',
          data: trips.value.map((t) => t.AverageSpeed),
          backgroundColor: 'rgba(61,214,140,0.5)',
          borderColor: '#3dd68c',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#4a5568', font: { family: 'Space Mono', size: 9 } } },
      },
      scales: {
        x: { ticks: { color: '#4a5568', font: { family: 'Space Mono', size: 9 } }, grid: { color: '#1a2030' } },
        y: { ticks: { color: '#4a5568', font: { family: 'Space Mono', size: 9 } }, grid: { color: '#1a2030' } },
      },
    },
  })
}

/**
 * Renders (or re-renders) the eco-event doughnut chart in the detail panel.
 * Groups events by `EventType` and assigns a fixed colour palette.
 */
function drawEcoChart() {
  const ctx = document.getElementById('ecoChart')
  if (!ctx || !ecoEvents.value.length) return

  ecoChart?.destroy()

  /** Human-readable labels keyed by EventType integer. */
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

  const ECO_DESCRIPTIONS = {
    'Unknown':      'Unclassified event.',
    'Cornering L':  'Turned left too sharply — lateral tyre stress.',
    'Cornering R':  'Turned right too sharply — lateral tyre stress.',
    'Cornering':    'Sharp cornering detected — lateral tyre stress.',
    'Hard Accel':   'Aggressive acceleration — increases fuel consumption.',
    'Hard Brake':   'Sharp braking — excessive tyre and brake wear.',
    'Bump':         'Hit a pothole or speed bump at excessive speed.',
    'Long Clutch':  'Clutch held down too long — unnecessary clutch wear.',
    'Neutral Drive':'Driven in neutral — wastes fuel, reduces engine braking.',
    'Freewheeling': 'Engine off while moving — reduces control and safety.',
  }

  // Aggregate event counts by human-readable name
  const counts = {}
  ecoEvents.value.forEach((ev) => {
    const name = ECO_NAMES[ev.EventType] || 'Unknown'
    counts[name] = (counts[name] || 0) + 1
  })

  const colors = ['#f5a623', '#ff4757', '#3dd68c', '#4fc3f7', '#a78bfa', '#f472b6', '#34d399', '#60a5fa', '#fbbf24']

  ecoChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: colors,
        borderColor: '#131720',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#4a5568', font: { family: 'Space Mono', size: 8 }, padding: 8 },
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const name  = item.label
              const count = item.raw
              const desc  = ECO_DESCRIPTIONS[name] ?? ''
              return [`${name}: ${count} event${count !== 1 ? 's' : ''}`, desc]
            },
          },
          bodyFont:    { family: 'Space Mono', size: 10 },
          padding:     10,
          boxPadding:  4,
        },
      },
    },
  })
}
</script>
