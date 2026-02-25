<!--
  MapView.vue – Map panel
  =======================
  Thin presentational wrapper around the Leaflet `#map` div.

  The actual Leaflet instance is owned by the `useMap` composable in the
  parent (App.vue). This component only renders the DOM container and the
  overlay buttons, emitting events upward so the parent can change map mode
  or trigger data refreshes.

  Props:
    mode       – current map mode ('live' | 'history'), used to highlight the
                 active toggle button.
    hasVehicle – whether a vehicle is currently selected; controls whether the
                 ROUTE HISTORY button is enabled.

  Emits:
    mode    – user clicked a mode toggle button; payload is the new mode string.
    fitAll  – user clicked FIT ALL.
    refresh – user clicked REFRESH.
-->
<template>
  <div class="map-area">
    <!-- Leaflet renders into this div (id referenced by useMap composable) -->
    <div id="map" />

    <!-- Mode toggle: LIVE / ROUTE HISTORY -->
    <div class="map-top">
      <button
        class="map-btn"
        :class="{ active: mode === 'live' }"
        @click="$emit('mode', 'live')"
      >
        ● LIVE
      </button>

      <button
        class="map-btn"
        :class="{ active: mode === 'history' }"
        :disabled="!hasVehicle"
        @click="$emit('mode', 'history')"
      >
        ROUTE HISTORY
      </button>
    </div>

    <!-- Bottom-left utility controls -->
    <div class="map-overlay">
      <button class="map-btn" @click="$emit('fitAll')">FIT ALL</button>
      <button class="map-btn" @click="$emit('refresh')">↻ REFRESH</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  /** Current map mode ('live' | 'history'). */
  mode: String,
  /** True when a vehicle is selected (enables the ROUTE HISTORY button). */
  hasVehicle: Boolean,
})

defineEmits(['mode', 'fitAll', 'refresh'])
</script>
