// Straight-line distance in km. Good enough for "nearest cold-storage facility" -- a single
// nearest-point lookup doesn't need the AI service's real road-distance routing (that's reserved
// for actual multi-stop optimization), and no equivalent helper existed in the Node backend
// before this (the AI service has its own Python copy in ai/utils/distance.py for a different job).
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

module.exports = { haversineKm };
