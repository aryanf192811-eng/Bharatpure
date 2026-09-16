import L from 'leaflet'

// Leaflet's default marker icon references relative image paths that break under Vite's bundler
// (a well-known Leaflet+bundler issue). Pointing at the same package's CDN-hosted assets sidesteps
// touching Leaflet's internal icon-URL resolution.
const CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images'

export const defaultMarkerIcon = L.icon({
  iconUrl: `${CDN_BASE}/marker-icon.png`,
  iconRetinaUrl: `${CDN_BASE}/marker-icon-2x.png`,
  shadowUrl: `${CDN_BASE}/marker-shadow.png`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

// A distinct marker for an auto-inserted cold-storage reroute stop, so it doesn't read as just
// another delivery stop on the map. A DivIcon (no extra image asset) keeps this self-contained.
export const coldStorageMarkerIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:9999px;background:#1D6FA4;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:15px;">❄️</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
})
