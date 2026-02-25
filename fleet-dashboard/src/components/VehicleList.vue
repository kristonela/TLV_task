<!--
  VehicleList.vue – Left sidebar
  ==============================
  Displays fleet-level statistics and a scrollable, searchable list of vehicles.

  Fleet stats (moving count, idle count, average speed) also act as filter
  toggle buttons: clicking "Moving" or "Idle" filters the list to that status.
  Clicking the active filter a second time clears it.

  The search box filters by vehicle name or licence plate (case-insensitive).

  Props:
    vehicles     – full vehicle array from the API.
    selected     – currently selected vehicle object (or null).
    loading      – true while the vehicle list is being fetched.
    movingCount  – pre-computed count of moving vehicles.
    idleCount    – pre-computed count of idle vehicles.
    avgSpeed     – pre-computed average speed of moving vehicles (km/h).

  Emits:
    select – user clicked a vehicle row; payload is the vehicle object.
-->
<template>
  <aside class="sidebar-left">

    <!-- ── Fleet summary / filter bar ───────────────────────────────────── -->
    <div class="fleet-bar">
      <div
        class="fleet-stat"
        :class="{ active: statusFilter === 'moving' }"
        @click="toggleFilter('moving')"
      >
        <div class="fleet-stat-n">{{ movingCount }}</div>
        <div class="fleet-stat-l">Moving</div>
      </div>

      <div
        class="fleet-stat"
        :class="{ active: statusFilter === 'idle' }"
        @click="toggleFilter('idle')"
      >
        <div class="fleet-stat-n muted">{{ idleCount }}</div>
        <div class="fleet-stat-l">Idle</div>
      </div>

      <!-- Average speed is display-only (no filter toggle) -->
      <div class="fleet-stat">
        <div class="fleet-stat-n blue">{{ avgSpeed }}</div>
        <div class="fleet-stat-l">Avg km/h</div>
      </div>
    </div>

    <!-- ── Search box ────────────────────────────────────────────────────── -->
    <div class="sidebar-section">
      <div class="section-label">Search vehicles</div>
      <input
        class="search-box"
        v-model="search"
        placeholder="Name or plate…"
      />
    </div>

    <!-- ── Vehicle list ──────────────────────────────────────────────────── -->
    <div v-if="loading" class="state-msg">
      <span class="spinner" />Loading fleet…
    </div>

    <div v-else-if="!vehicles.length" class="state-msg">
      No vehicles found
    </div>

    <div v-else class="vehicle-list">
      <div
        v-for="v in filtered"
        :key="v.Code"
        class="vehicle-item"
        :class="{ active: selected?.Code === v.Code }"
        @click="$emit('select', v)"
      >
        <!-- Status dot: green pulse when moving, grey when idle -->
        <div class="v-status" :class="v.Speed > 0 ? 'moving' : 'idle'" />

        <div class="v-info">
          <div class="v-name">{{ v.Name }}</div>
          <div class="v-spz">{{ v.SPZ || 'No plate' }}</div>
        </div>

        <div class="v-speed">
          {{ v.Speed }}<br />
          <span class="v-unit">km/h</span>
        </div>
      </div>
    </div>

  </aside>
</template>

<script setup>
import { ref, computed } from 'vue'

// ---------------------------------------------------------------------------
// Props & emits
// ---------------------------------------------------------------------------

const props = defineProps({
  vehicles:    Array,
  selected:    Object,
  loading:     Boolean,
  movingCount: Number,
  idleCount:   Number,
  avgSpeed:    Number,
})

defineEmits(['select'])

// ---------------------------------------------------------------------------
// Local state
// ---------------------------------------------------------------------------

/** Current value of the search input. */
const search = ref('')

/**
 * Active status filter: `'moving'`, `'idle'`, or `null` (no filter).
 * @type {import('vue').Ref<'moving' | 'idle' | null>}
 */
const statusFilter = ref(null)

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

/**
 * Vehicle list after applying status filter and text search.
 * Filtering order: status → search text.
 */
const filtered = computed(() => {
  let list = props.vehicles

  // Apply status filter
  if (statusFilter.value === 'moving') list = list.filter((v) => v.Speed > 0)
  if (statusFilter.value === 'idle')   list = list.filter((v) => v.Speed === 0)

  // Apply text search (name or licence plate)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (v) => v.Name.toLowerCase().includes(q) || (v.SPZ || '').toLowerCase().includes(q),
    )
  }

  return list
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Toggles a status filter on or off.
 * Clicking the already-active filter clears it (acts as a reset).
 *
 * @param {'moving' | 'idle'} val
 */
function toggleFilter(val) {
  statusFilter.value = statusFilter.value === val ? null : val
}
</script>
