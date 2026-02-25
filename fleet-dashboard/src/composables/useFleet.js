/**
 * @file useFleet.js
 * @description Composable that manages fleet-level state: vehicle list, loading
 * indicator, last-refresh timestamp, and derived summary statistics.
 *
 * On `init()` the composable fetches the first available group and then loads
 * its vehicles. Subsequent calls to `refresh()` re-fetch the vehicle list and
 * update the timestamp displayed in the header.
 */

import { ref, computed } from 'vue'
import { getGroups, getVehicles } from '../api/gpsdozor.js'

/**
 * @returns {{
 *   groupCode:    import('vue').Ref<string>,
 *   vehicles:     import('vue').Ref<Array<object>>,
 *   loading:      import('vue').Ref<boolean>,
 *   lastRefresh:  import('vue').Ref<string>,
 *   movingCount:  import('vue').ComputedRef<number>,
 *   idleCount:    import('vue').ComputedRef<number>,
 *   avgSpeed:     import('vue').ComputedRef<number>,
 *   init:         () => Promise<void>,
 *   refresh:      () => Promise<void>,
 * }}
 */
export function useFleet() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Code of the currently active vehicle group. */
  const groupCode = ref('')

  /** Full vehicle list returned by the API for `groupCode`. */
  const vehicles = ref([])

  /** True while a network request is in flight. */
  const loading = ref(false)

  /** Human-readable time of the most recent successful refresh. */
  const lastRefresh = ref('')

  // ---------------------------------------------------------------------------
  // Derived statistics (computed from the vehicle list)
  // ---------------------------------------------------------------------------

  /** Number of vehicles currently moving (Speed > 0). */
  const movingCount = computed(() =>
    vehicles.value.filter((v) => v.Speed > 0).length,
  )

  /** Number of vehicles at a standstill (Speed === 0). */
  const idleCount = computed(() =>
    vehicles.value.filter((v) => v.Speed === 0).length,
  )

  /**
   * Average speed across all moving vehicles, rounded to the nearest integer.
   * Returns 0 when no vehicle is moving.
   */
  const avgSpeed = computed(() => {
    const moving = vehicles.value.filter((v) => v.Speed > 0)
    if (!moving.length) return 0
    return Math.round(moving.reduce((sum, v) => sum + v.Speed, 0) / moving.length)
  })

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Bootstraps the fleet: fetches groups from the API and loads vehicles for
   * the first group. Should be called once from `onMounted`.
   */
  async function init() {
    const groups = await getGroups()
    if (groups.length) {
      groupCode.value = groups[0].Code
      await refresh()
    }
  }

  /**
   * Re-fetches the vehicle list for `groupCode` and updates `lastRefresh`.
   * Sets `loading` to true for the duration of the request.
   */
  async function refresh() {
    loading.value = true
    try {
      vehicles.value = await getVehicles(groupCode.value)
      lastRefresh.value = new Date().toLocaleTimeString('cs-CZ')
    } finally {
      loading.value = false
    }
  }

  return { groupCode, vehicles, loading, lastRefresh, movingCount, idleCount, avgSpeed, init, refresh }
}
