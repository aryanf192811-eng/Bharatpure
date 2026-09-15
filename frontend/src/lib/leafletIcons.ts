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
