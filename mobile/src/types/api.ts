// Envelope shapes per frontend-docs/API-CONTRACT.md §Response envelope.
// Every backend response — success or error — uses exactly one of these.

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  // A single semicolon-joined string on validation errors, not a field-keyed
  // object — see API-CONTRACT.md. Split on "; " client-side if per-field
  // highlighting is ever needed.
  message: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [longitude: number, latitude: number];
}
