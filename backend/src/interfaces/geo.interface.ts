// Standard shape for all location data project-wide (Decision #3, §3.1) — Job, Driver,
// Customer, Vehicle, and any future geospatial query all use this same structure.
export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude] — GeoJSON order, NOT lat/lng
}
