/**
 * @file useMap.js
 * @description Composable that owns the Leaflet map instance and exposes
 * high-level helpers for rendering vehicle markers, route history polylines,
 * and trip start/end pins.
 *
 * The map is initialised in `onMounted` (so the DOM element exists) and
 * destroyed in `onUnmounted` to prevent memory leaks.
 *
 * @param {string} containerId - The `id` of the DOM element Leaflet should
 *   render into (must exist when the parent component mounts).
 */

import { onMounted, onUnmounted } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export function useMap(containerId) {
  // ---------------------------------------------------------------------------
  // Leaflet instances (module-scoped, not reactive – Leaflet manages its own
  // DOM and does not need Vue's reactivity system)
  // ---------------------------------------------------------------------------

  /** @type {L.Map | null} */
  let map = null

  /** Layer group that holds live-position markers. */
  let markersLayer = null

  /** Layer group that holds route-history polylines and trip pins. */
  let historyLayer = null

  // ---------------------------------------------------------------------------
  // Lifecycle hooks
  // ---------------------------------------------------------------------------

  onMounted(() => {
    map = L.map(containerId, { zoomControl: true, attributionControl: false, scrollWheelZoom: true })

    // OpenStreetMap tile layer – maxZoom matches OSM's tile availability
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    markersLayer = L.layerGroup().addTo(map)
    historyLayer = L.layerGroup().addTo(map)

    // Default view: central Czechia
    map.setView([50.07, 14.43], 7)
  })

  onUnmounted(() => {
    if (map) map.remove()
  })

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates a coloured circle `divIcon` for a vehicle marker.
   * Moving vehicles use green with a glow; idle vehicles use grey.
   *
   * @param {number} speed - Current speed of the vehicle in km/h.
   * @returns {L.DivIcon}
   */
  function vehicleIcon(speed) {
    const color = speed > 0 ? '#3dd68c' : '#4a5568'
    const glow = speed > 0 ? `box-shadow:0 0 8px ${color};` : ''
    return L.divIcon({
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};${glow}border:2px solid #131720;"></div>`,
    })
  }

  /**
   * Returns a small circular `divIcon` used for route start / end pins and
   * trip pins, coloured according to `color`.
   *
   * @param {string} color - CSS colour string.
   * @returns {L.DivIcon}
   */
  function pinIcon(color) {
    return L.divIcon({
      className: '',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid #fff"></div>`,
    })
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Replaces all markers in `markersLayer` with fresh markers built from the
   * current vehicle list. Each marker opens a popup and triggers `onVehicleClick`
   * when clicked.
   *
   * @param {Array<object>} vehicles       - Vehicle objects from the API.
   * @param {(v: object) => void} onVehicleClick - Callback invoked on marker click.
   */
  function updateMarkers(vehicles, onVehicleClick) {
    if (!markersLayer) return
    markersLayer.clearLayers()

    vehicles.forEach((v) => {
      // Skip vehicles with no position data
      if (!v.LastPosition?.Latitude) return

      const lat = parseFloat(v.LastPosition.Latitude)
      const lng = parseFloat(v.LastPosition.Longitude)
      if (isNaN(lat) || isNaN(lng)) return

      const marker = L.marker([lat, lng], { icon: vehicleIcon(v.Speed) })

      marker.bindPopup(`
        <div class="map-popup">
          <div class="map-popup-name">${v.Name}</div>
          <div class="map-popup-sub">${v.SPZ || 'No plate'}</div>
          <div class="map-popup-speed">Speed: <span>${v.Speed} km/h</span></div>
        </div>`, { className: 'dark-popup' })

      marker.on('click', () => onVehicleClick(v))
      markersLayer.addLayer(marker)
    })
  }

  /**
   * Renders a GPS history track as a colour-coded polyline on `historyLayer`.
   * Segment colour encodes speed: green ≤ 60 km/h, amber ≤ 90 km/h, red > 90 km/h.
   * Start and end positions are marked with coloured pins.
   *
   * @param {Array<{Lat: string, Lng: string, Speed: number}> | undefined} positions
   */
  function drawHistory(positions) {
    if (!historyLayer) return
    historyLayer.clearLayers()
    markersLayer.clearLayers()

    if (!positions?.length) return

    const coords = positions.map((p) => [parseFloat(p.Lat), parseFloat(p.Lng)])

    // Draw individual segments so each can be coloured by speed
    for (let i = 0; i < coords.length - 1; i++) {
      const speed = positions[i].Speed
      const color = speed > 90 ? '#ff4757' : speed > 60 ? '#f5a623' : '#3dd68c'
      L.polyline([coords[i], coords[i + 1]], { color, weight: 3, opacity: 0.85 }).addTo(historyLayer)
    }

    // Start pin (green) and end pin (red)
    L.marker(coords[0], { icon: pinIcon('#3dd68c') }).addTo(historyLayer).bindPopup('Start')
    L.marker(coords[coords.length - 1], { icon: pinIcon('#ff4757') }).addTo(historyLayer).bindPopup('End')

    map.fitBounds(coords, { padding: [40, 40] })
  }

  /**
   * Plots a trip's start and finish as pins connected by a dashed amber line.
   * Clears any existing history layer content first.
   *
   * @param {{ StartPosition: object, FinishPosition: object, StartAddress?: string, FinishAddress?: string }} trip
   */
  function drawTripPins(trip) {
    if (!trip.StartPosition || !trip.FinishPosition) return

    const start  = [parseFloat(trip.StartPosition.Latitude),  parseFloat(trip.StartPosition.Longitude)]
    const finish = [parseFloat(trip.FinishPosition.Latitude), parseFloat(trip.FinishPosition.Longitude)]

    historyLayer.clearLayers()

    L.marker(start,  { icon: pinIcon('#3dd68c') }).addTo(historyLayer).bindPopup(`Start: ${trip.StartAddress  || ''}`)
    L.marker(finish, { icon: pinIcon('#ff4757') }).addTo(historyLayer).bindPopup(`End: ${trip.FinishAddress || ''}`)

    // Dashed line as a visual guide between start and finish
    L.polyline([start, finish], { color: '#f5a623', weight: 2, dashArray: '6,4' }).addTo(historyLayer)

    map.fitBounds([start, finish], { padding: [60, 60] })
  }

  /**
   * Fits the map viewport to show all vehicles that have a known position.
   *
   * @param {Array<object>} vehicles - Vehicle objects from the API.
   */
  function fitAll(vehicles) {
    const points = vehicles
      .filter((v) => v.LastPosition?.Latitude)
      .map((v) => [parseFloat(v.LastPosition.Latitude), parseFloat(v.LastPosition.Longitude)])
      .filter((p) => !isNaN(p[0]))

    if (points.length) map.fitBounds(points, { padding: [30, 30] })
  }

  /**
   * Pans and zooms the map to centre on a single vehicle's last known position.
   *
   * @param {object} vehicle - Vehicle object from the API.
   */
  function panTo(vehicle) {
    if (!vehicle.LastPosition?.Latitude) return
    const lat = parseFloat(vehicle.LastPosition.Latitude)
    const lng = parseFloat(vehicle.LastPosition.Longitude)
    if (!isNaN(lat)) map.setView([lat, lng], 13)
  }

  /**
   * Removes all layers from `historyLayer` (route polylines and trip pins).
   */
  function clearHistory() {
    historyLayer?.clearLayers()
  }

  return { updateMarkers, drawHistory, drawTripPins, fitAll, panTo, clearHistory }
}
