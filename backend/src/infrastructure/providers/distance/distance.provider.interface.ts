import { IGeoPoint } from "../../../interfaces/geo.interface";

export interface IRouteResult {
  distanceKm: number;
  durationMinutes: number;
}

export interface IDistanceProvider {
  getRoute(origin: IGeoPoint, destination: IGeoPoint): Promise<IRouteResult>;
}
