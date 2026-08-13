declare module 'react-native-config' {
  export interface NativeConfig {
    API_BASE_URL?: string;
    SOCKET_URL?: string;
    // Consumed natively only (AndroidManifest.xml meta-data via
    // react-native-config's auto-generated @string/GOOGLE_MAPS_API_KEY
    // resource) — not read from JS, listed here for documentation.
    GOOGLE_MAPS_API_KEY?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
