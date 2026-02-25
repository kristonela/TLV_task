/**
 * @file gpsdozor.js
 * @description HTTP client for the GPS Dozor REST API.
 *
 * All requests use HTTP Basic authentication and target the proxy path `/api/v1`,
 * which Vite's dev-server rewrites to the real GPS Dozor host (see vite.config.js).
 *
 * Exported helpers are thin wrappers around `apiFetch` so callers never have to
 * construct URLs or set auth headers manually.
 */

/** Base path forwarded by the Vite dev-server proxy. */
const API_BASE = '/api/v1'

/** Pre-encoded Basic-auth header value (username:password → base64). */
const AUTH = btoa('api_gpsdozor:yakmwlARdn')

/** Default headers applied to every request. */
const HEADERS = { Authorization: `Basic ${AUTH}` }

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

/**
 * Performs an authenticated GET request against the GPS Dozor API.
 *
 * @param {string} path - API path relative to `API_BASE` (e.g. `/groups`).
 * @returns {Promise<any>} Parsed JSON response body.
 * @throws {Error} When the HTTP response status is not OK (2xx).
 */
async function apiFetch(path) {
  const res = await fetch(API_BASE + path, { headers: HEADERS })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches all vehicle groups the authenticated user has access to.
 *
 * @returns {Promise<Array<{Code: string, Name: string}>>}
 */
export const getGroups = () => apiFetch('/groups')

/**
 * Fetches all vehicles belonging to a specific group.
 *
 * @param {string} groupCode - The group's unique code.
 * @returns {Promise<Array<object>>} Array of vehicle objects.
 */
export const getVehicles = (groupCode) => apiFetch(`/vehicles/group/${groupCode}`)

/**
 * Fetches GPS position history for a single vehicle within a time window.
 *
 * @param {string} code  - Vehicle code.
 * @param {string} from  - ISO 8601 start datetime (e.g. `"2024-01-01T00:00"`).
 * @param {string} to    - ISO 8601 end datetime.
 * @returns {Promise<Array<object>>}
 */
export const getVehicleHistory = (code, from, to) =>
  apiFetch(`/vehicles/history/${code}?from=${from}&to=${to}`)

/**
 * Fetches trip records for a vehicle within a time window.
 *
 * @param {string} code  - Vehicle code.
 * @param {string} from  - ISO 8601 start datetime.
 * @param {string} to    - ISO 8601 end datetime.
 * @returns {Promise<Array<object>>}
 */
export const getTrips = (code, from, to) =>
  apiFetch(`/vehicle/${code}/trips?from=${from}&to=${to}`)

/**
 * Fetches eco-driving events for a vehicle within a time window.
 *
 * @param {string} code  - Vehicle code.
 * @param {string} from  - ISO 8601 start datetime.
 * @param {string} to    - ISO 8601 end datetime.
 * @returns {Promise<Array<object>>}
 */
export const getEcoDriving = (code, from, to) =>
  apiFetch(`/vehicle/${code}/eco-driving-events?from=${from}&to=${to}`)
