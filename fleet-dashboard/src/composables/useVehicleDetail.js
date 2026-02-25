/**
 * @file useVehicleDetail.js
 * @description Composable that manages per-vehicle detail data: trips,
 * eco-driving events, and GPS history.
 *
 * The date range defaults to the past 7 days and can be changed by the user
 * via the `fromDate` / `toDate` refs (bound via `v-model` in `DetailPanel`).
 */

import { ref } from 'vue'
import { getTrips, getEcoDriving, getVehicleHistory } from '../api/gpsdozor.js'

// ---------------------------------------------------------------------------
// Default date range helpers (evaluated once at module load time)
// ---------------------------------------------------------------------------

const today = new Date()
const weekAgo = new Date(today - 7 * 86_400_000) // 7 days × ms-per-day

/**
 * @returns {{
 *   trips:        import('vue').Ref<Array<object>>,
 *   ecoEvents:    import('vue').Ref<Array<object>>,
 *   loadingTrips: import('vue').Ref<boolean>,
 *   loadingEco:   import('vue').Ref<boolean>,
 *   fromDate:     import('vue').Ref<string>,
 *   toDate:       import('vue').Ref<string>,
 *   fetchTrips:   (code: string) => Promise<void>,
 *   fetchEco:     (code: string) => Promise<void>,
 *   fetchHistory: (code: string) => Promise<Array<object>>,
 * }}
 */
export function useVehicleDetail() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Trip records for the selected vehicle and date range. */
  const trips = ref([])

  /** Eco-driving event records for the selected vehicle and date range. */
  const ecoEvents = ref([])

  /** True while trip data is being fetched. */
  const loadingTrips = ref(false)

  /** True while eco-driving data is being fetched. */
  const loadingEco = ref(false)

  /** Start of the date range in `YYYY-MM-DD` format. */
  const fromDate = ref(weekAgo.toISOString().slice(0, 10))

  /** End of the date range in `YYYY-MM-DD` format. */
  const toDate = ref(today.toISOString().slice(0, 10))

  // ---------------------------------------------------------------------------
  // Helpers – build ISO datetime strings for the API query params
  // ---------------------------------------------------------------------------

  /** Returns the start datetime string (`YYYY-MM-DDTHH:MM`). */
  const from = () => `${fromDate.value}T00:00`

  /** Returns the end datetime string (`YYYY-MM-DDTHH:MM`). */
  const to = () => `${toDate.value}T23:59`

  // ---------------------------------------------------------------------------
  // Fetch actions
  // ---------------------------------------------------------------------------

  /**
   * Fetches trip records for the given vehicle code and the current date range.
   * Resets `trips` before loading so stale data is never visible.
   *
   * @param {string} code - Vehicle code.
   */
  async function fetchTrips(code) {
    loadingTrips.value = true
    trips.value = []
    try {
      trips.value = (await getTrips(code, from(), to())) || []
    } finally {
      loadingTrips.value = false
    }
  }

  /**
   * Fetches eco-driving events for the given vehicle code and date range.
   * Normalises the response to an array even if the API returns a non-array.
   *
   * @param {string} code - Vehicle code.
   */
  async function fetchEco(code) {
    loadingEco.value = true
    ecoEvents.value = []
    try {
      const data = await getEcoDriving(code, from(), to())
      ecoEvents.value = Array.isArray(data) ? data : []
    } finally {
      loadingEco.value = false
    }
  }

  /**
   * Fetches raw GPS position history for the given vehicle code and date range.
   * Returns the raw API response; the caller is responsible for rendering it.
   *
   * @param {string} code - Vehicle code.
   * @returns {Promise<Array<object>>}
   */
  async function fetchHistory(code) {
    return getVehicleHistory(code, from(), to())
  }

  return { trips, ecoEvents, loadingTrips, loadingEco, fromDate, toDate, fetchTrips, fetchEco, fetchHistory }
}
