type FlowLogData = Record<string, string | number | boolean | null | undefined>;

function roundCoord(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function flowCoords(latitude: number, longitude: number): { lat: number; lng: number } {
  return { lat: roundCoord(latitude), lng: roundCoord(longitude) };
}

/** Logcat-grepable diagnostics for the customer → driver recovery path. Never log tokens. */
export function flowLog(event: string, data: FlowLogData = {}): void {
  const extras = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  console.info(extras ? `AdmillFlow ${event} ${extras}` : `AdmillFlow ${event}`);
}
