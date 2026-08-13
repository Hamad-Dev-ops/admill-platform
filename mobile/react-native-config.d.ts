declare module 'react-native-config' {
  export interface NativeConfig {
    API_BASE_URL?: string;
    SOCKET_URL?: string;
    // Consumed both natively (AndroidManifest.xml meta-data via
    // react-native-config's auto-generated @string/GOOGLE_MAPS_API_KEY
    // resource, for the Maps SDK) and now from JS (src/config/env.ts,
    // src/utils/directions.ts — Phase 5 Polyline's Directions/Routes API
    // call). The same key must have both usages enabled/authorized in
    // Google Cloud Console; see GAP-REPORT.md's Phase 5 Polyline note.
    GOOGLE_MAPS_API_KEY?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
