# Fleet Dashboard – GPS Dozor

## Running the app

```bash
cd fleet-dashboard
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Who it's for and why

The app is built for **fleet dispatchers and managers** who need a single view of vehicle positions, trip history, and driver behaviour — without switching between tabs.

I chose a **three-column layout** (vehicle list → map → detail) because it matches the dispatcher's natural mental model: pick a vehicle, see where it is, drill into details. Leaflet over Google Maps to keep costs at zero and use offline-friendly OSM tiles. Chart.js for charts — minimal setup, no overhead. Open-Meteo and Nominatim as a bonus: weather directly affects eco scores, and resolving GPS coordinates to a street address saves the dispatcher time.

---

## AI tools and workflow

The entire project was developed inside **Claude Code** (Anthropic's CLI tool) directly in the terminal.

Workflow:
1. Described the intent, let Claude propose the project structure and key files.
2. Added features iteratively — each time I gave a specific requirement, Claude proposed an implementation, I reviewed the code and either approved or redirected.
3. Visual feedback via screenshots — I sent screen captures directly into the chat and Claude adjusted CSS or logic based on what it saw.
4. Bugs were handled the same way: screenshot or error description → Claude identified the root cause → fixed it.

---

## Problems encountered

| Problem | Solution |
|---|---|
| CORS when calling the GPS Dozor API from the browser | Vite dev-server proxy: `/api` → `https://a1.gpsguard.eu` |
| Weather strip never appeared | Vehicle coordinates live at `v.LastPosition.Latitude`, not `v.Latitude` — wrong key caused a silent no-op |
| Leaflet popup had a white background despite inline dark styles | Leaflet's own `.leaflet-popup-content-wrapper` CSS wins — overrode it via a custom `dark-popup` class |
| Eco events showed `-2147483648 km/h` | GPS Dozor uses `INT32_MIN` as a sentinel for missing speed — added a guard and display `N/A` instead |

---

## What I'd do differently or add with more time

- **Auth via UI** — credentials are currently hard-coded; ideally a login screen with a token stored in `sessionStorage`
- **Production proxy / backend** — Vite proxy only works in dev mode; a real deployment needs a Node or nginx reverse proxy
- **WebSocket or SSE** — replace polling with a push-based connection for truly real-time position updates
- **Mobile layout** — the three-column grid breaks on small screens
- **Tests** — at minimum unit tests for composables and API clients (Vitest)
