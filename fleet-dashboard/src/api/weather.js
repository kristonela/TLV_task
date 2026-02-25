/**
 * weather.js – Thin client for the Open-Meteo public API.
 *
 * Fetches current weather (temperature, wind speed, WMO weather code) for a
 * given latitude / longitude. No API key required.
 *
 * @see https://open-meteo.com/en/docs
 */

const BASE = 'https://api.open-meteo.com/v1/forecast'

/**
 * Fetch current weather for the given coordinates.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{temperature_2m: number, wind_speed_10m: number, weather_code: number}>}
 */
export async function getCurrentWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude:              lat,
    longitude:             lng,
    current:               'temperature_2m,wind_speed_10m,weather_code',
    wind_speed_unit:       'kmh',
    forecast_days:         1,
  })

  const res = await fetch(`${BASE}?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)

  const data = await res.json()
  return data.current
}
