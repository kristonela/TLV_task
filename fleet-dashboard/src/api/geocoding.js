/**
 * geocoding.js – Thin client for the Nominatim OpenStreetMap reverse-geocoding API.
 *
 * Resolves a lat/lng pair to a structured address object. No API key required.
 * zoom=16 resolves to street-level detail.
 *
 * @see https://nominatim.org/release-docs/latest/api/Reverse/
 */

const BASE = 'https://nominatim.openstreetmap.org/reverse'

/**
 * Reverse-geocode the given coordinates.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{display_name: string, address: object}>}
 */
export async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    lat,
    lon:    lng,
    format: 'json',
    zoom:   16,
  })

  const res = await fetch(`${BASE}?${params}`, {
    headers: { 'Accept-Language': 'cs,en' },
  })
  if (!res.ok) throw new Error(`Nominatim ${res.status}`)

  return res.json()
}
