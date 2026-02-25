/**
 * useWeather.js – Vue composable that wraps the Open-Meteo weather client.
 *
 * Exposes:
 *   weather        – reactive ref, null or { icon, label, temp, wind }
 *   loadingWeather – reactive boolean
 *   fetchWeather   – async function(lat, lng); silently swallows errors
 */

import { ref } from 'vue'
import { getCurrentWeather } from '../api/weather.js'

/**
 * WMO Weather Interpretation Codes → { icon: emoji, label: string }
 * Reference: https://open-meteo.com/en/docs#weathervariables
 */
const WMO_CODES = {
  0:  { icon: '☀️',  label: 'Clear sky' },
  1:  { icon: '🌤️',  label: 'Mainly clear' },
  2:  { icon: '⛅',  label: 'Partly cloudy' },
  3:  { icon: '☁️',  label: 'Overcast' },
  45: { icon: '🌫️',  label: 'Fog' },
  48: { icon: '🌫️',  label: 'Icy fog' },
  51: { icon: '🌦️',  label: 'Light drizzle' },
  53: { icon: '🌦️',  label: 'Drizzle' },
  55: { icon: '🌧️',  label: 'Dense drizzle' },
  56: { icon: '🌨️',  label: 'Freezing drizzle' },
  57: { icon: '🌨️',  label: 'Heavy freezing drizzle' },
  61: { icon: '🌧️',  label: 'Slight rain' },
  63: { icon: '🌧️',  label: 'Rain' },
  65: { icon: '🌧️',  label: 'Heavy rain' },
  66: { icon: '🌨️',  label: 'Freezing rain' },
  67: { icon: '🌨️',  label: 'Heavy freezing rain' },
  71: { icon: '❄️',  label: 'Slight snow' },
  73: { icon: '❄️',  label: 'Snow' },
  75: { icon: '❄️',  label: 'Heavy snow' },
  77: { icon: '🌨️',  label: 'Snow grains' },
  80: { icon: '🌦️',  label: 'Slight showers' },
  81: { icon: '🌧️',  label: 'Showers' },
  82: { icon: '⛈️',  label: 'Heavy showers' },
  85: { icon: '🌨️',  label: 'Snow showers' },
  86: { icon: '🌨️',  label: 'Heavy snow showers' },
  95: { icon: '⛈️',  label: 'Thunderstorm' },
  96: { icon: '⛈️',  label: 'Thunderstorm w/ hail' },
  99: { icon: '⛈️',  label: 'Thunderstorm w/ heavy hail' },
}

/** Fallback for unknown WMO codes */
const UNKNOWN_CODE = { icon: '🌡️', label: 'Unknown' }

export function useWeather() {
  const weather        = ref(null)
  const loadingWeather = ref(false)

  /**
   * Fetch weather for the given coordinates and update the `weather` ref.
   * Failures are logged as warnings but never thrown – weather is non-critical.
   *
   * @param {number} lat
   * @param {number} lng
   */
  async function fetchWeather(lat, lng) {
    loadingWeather.value = true
    weather.value        = null

    try {
      const current = await getCurrentWeather(lat, lng)
      const code    = current.weather_code ?? 0
      const meta    = WMO_CODES[code] ?? UNKNOWN_CODE

      weather.value = {
        icon:  meta.icon,
        label: meta.label,
        temp:  current.temperature_2m,
        wind:  current.wind_speed_10m,
      }
    } catch (err) {
      console.warn('[useWeather] fetch failed:', err)
    } finally {
      loadingWeather.value = false
    }
  }

  return { weather, loadingWeather, fetchWeather }
}
