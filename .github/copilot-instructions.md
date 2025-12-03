# Copilot Instructions for ChatGPT1 (Spotify Cover & Code Generator)

## Project Overview
Spotify Cover & Code Generator is a web app that searches Spotify for albums, artists, playlists, and tracks, then generates print-ready composite images combining cover art with Spotify QR codes. The app uses Spotify's Web API and canvas-based image generation.

**Tech Stack:** Node.js (HTTP server), Vanilla JavaScript (client), Canvas API, Spotify Web API

---

## Architecture & Data Flow

### Backend (`server.js`)
- **Single Node.js HTTP server** handling both static file serving and API requests
- **Token management:** Uses OAuth 2.0 client credentials to request Spotify access tokens, with caching logic (60s buffer before expiry)
- **Search endpoint:** `/api/search?q=<query>&type=<comma-separated-types>` returns normalized JSON with cover URLs and Spotify URIs
- **Static serving:** Routes requests through `public/` directory with path normalization security checks

**Key patterns:**
- Spotify token is cached in `tokenCache` object (not persisted to disk)
- All API responses include CORS headers to allow browser requests
- Error handling converts Spotify API responses into user-friendly messages

### Frontend (`public/app.js`)
- **Stateful UI:** Tracks selected item in `selectedItem` variable between search and generation phases
- **Two-phase workflow:** (1) Search/browse results, (2) Select item → customize resolution → generate composite
- **LocalStorage history:** Persists last 10 searches under `spotify-search-history` key
- **Canvas rendering:** `generateComposite()` centers cover and code images on white background with metadata text

**Search flow:**
```
form submission → performSearch() → fetch /api/search → renderResults() → user clicks item
→ selectItem() → detailCard reveals → user adjusts resolution → generateComposite()
```

---

## Critical Workflows

### Running the App
```powershell
npm start  # Calls dev-env.bat (loads Spotify credentials), then starts server on :3000
```
**Important:** `dev-env.bat` must execute before `node server.js` to set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` as environment variables.

### Development
- **Debug search:** Add `console.log()` in `handleSearch()` before fetch or in `mapItem()` to inspect Spotify data structure
- **Test canvas rendering:** Inspect `canvas` element in DevTools Elements panel; check for clipping issues with custom resolutions
- **Check token expiry:** Token caches for ~3599 seconds; expiry logic has 60s buffer to refresh preemptively

### Fixing Spotify Integration Issues
- Credentials in `dev-env.bat` are client credentials (not user auth); only search/read operations work
- Spotify API returns 401 if token is missing or expired—check token refresh in `getAccessToken()`
- Search results limited to 12 items per type; adjust `limit=12` in `SEARCH_URL` construction for more results
- Playlists are commented out in results aggregation (line ~164)—uncomment if needed

---

## Project-Specific Patterns & Conventions

### Data Normalization
Results from different Spotify types (album, artist, track, playlist) are normalized through `mapItem()`:
- **All types:** `id`, `name`, `url`, `uri`, `coverUrl`, `codeUrl` (always included)
- **Tracks & albums:** Include `subtitle` as artist names
- **Artists:** Subtitle is fixed string "Artist"
- **Playlists:** Subtitle includes owner display name

This ensures the UI can render any type with a single template.

### Image Composition Formula (Canvas Rendering)
The `generateComposite()` function uses proportional sizing:
- Cover takes 55% of height (centered, square aspect ratio)
- Gap between cover and code = 4% of width
- Code = 14% of height (auto-width to maintain aspect ratio)
- Title/subtitle rendered below with proportional font sizing (3.5% and 2.5% of width)

### Error Handling Strategy
- Server catches Spotify errors and returns `{ error: "<message>" }` JSON
- Client catches fetch errors and displays message in `messageEl`
- User-friendly error messages in German (app language is German)

---

## Key Files & Their Responsibilities

| File | Purpose | Key Functions |
|------|---------|---|
| `server.js` | HTTP server, Spotify integration | `getAccessToken()`, `handleSearch()`, `mapItem()`, `buildCodeUrl()` |
| `public/app.js` | Search UI, history, canvas generation | `performSearch()`, `generateComposite()`, `renderResults()`, `loadHistory()` |
| `public/index.html` | DOM structure (German labels) | Form controls, detail card template, canvas element |
| `public/styles.css` | Dark theme with Spotify green accent | Responsive grid, card layout, detail panel styling |
| `dev-env.bat` | Environment variables for local dev | Sets `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` |
| `package.json` | Project metadata & start script | Calls `dev-env.bat` before running server |

---

## Integration Points & External Dependencies

- **Spotify Web API:** Requires valid client credentials; endpoints: `/api/token`, `/v1/search`, `/scannables.scdn.co/uri/plain/png/...`
- **LocalStorage API:** Stores search history; capacity depends on browser (typically 5–10 MB)
- **Canvas API:** Draws composite images; uses `loadImage()` helper to handle CORS and async loading
- **fetch API:** All HTTP requests use modern fetch, not XMLHttpRequest

---

## Common Modifications

### Add a New Spotify Type to Search
1. Uncomment or add in `handleSearch()` result aggregation (around line 164)
2. Add checkbox in `index.html` search form (section `search__types`)
3. Add corresponding case in `mapItem()` to handle any type-specific fields

### Customize Canvas Layout
Edit proportions in `generateComposite()`:
- `margin` (8% of width by default)
- `coverHeight` (55% of height, but capped at available width)
- `codeHeight` (14% of height)

### Change Color Scheme
Theme colors defined in `public/styles.css` CSS variables (`:root`):
- `--bg`, `--card`, `--accent` are primary controls
- Regenerate composite images by adjusting `fillStyle` values in canvas context

---

## Notes for AI Agents

- **When debugging canvas rendering:** Always check `canvas.width` and `canvas.height` match user's selected resolution; check `ctx.drawImage()` calls use correct coordinates
- **When modifying search:** Remember that filter checkboxes in the form must map to valid Spotify `type` parameter values (album, artist, playlist, track)
- **When touching Spotify integration:** Client credentials are intentionally used (read-only); never attempt user-based auth flows without refactoring `getAccessToken()`
- **When updating API responses:** Changes to `mapItem()` output format require corresponding UI updates in `renderResults()` and detail card rendering
