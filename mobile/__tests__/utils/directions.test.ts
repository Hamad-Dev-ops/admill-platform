// GOOGLE_MAPS_API_KEY needs to vary per describe block (present vs. absent),
// so env.ts is re-mocked via jest.doMock + a fresh require each time rather
// than one static top-level jest.mock — the module (and its top-level
// `env` read) must be freshly loaded after each doMock for the new value to
// take effect.
function loadGetRoute(apiKey: string | undefined) {
  jest.resetModules();
  jest.doMock('../../src/config/env', () => ({ env: { GOOGLE_MAPS_API_KEY: apiKey } }));
  return (require('../../src/utils/directions') as typeof import('../../src/utils/directions')).getRoute;
}

const PICKUP = { type: 'Point' as const, coordinates: [55.2744, 25.1972] as [number, number] };
const DESTINATION = { type: 'Point' as const, coordinates: [55.14, 25.08] as [number, number] };

describe('getRoute — a real GOOGLE_MAPS_API_KEY is configured', () => {
  let mockFetch: jest.Mock;
  let getRoute: typeof import('../../src/utils/directions').getRoute;

  beforeEach(() => {
    getRoute = loadGetRoute('test-key');
    mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  // Google's own documented example polyline+decoded-coordinates pair —
  // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
  it('decodes a real encoded polyline into coordinates', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } }] }),
    });

    const result = await getRoute(PICKUP, DESTINATION);

    expect(result).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it('sends origin/destination correctly converted from GeoJSON [lng,lat] to Routes API {latitude,longitude}', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [{ polyline: { encodedPolyline: '_p~iF~ps|U' } }] }),
    });

    await getRoute(PICKUP, DESTINATION);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Goog-Api-Key': 'test-key' }),
      }),
    );
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.origin.location.latLng).toEqual({ latitude: 25.1972, longitude: 55.2744 });
    expect(body.destination.location.latLng).toEqual({ latitude: 25.08, longitude: 55.14 });
  });

  it('returns null on a non-OK HTTP response (e.g. REQUEST_DENIED/auth failure)', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    expect(await getRoute(PICKUP, DESTINATION)).toBeNull();
  });

  it('returns null when the response has no routes (e.g. ZERO_RESULTS)', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ routes: [] }) });
    expect(await getRoute(PICKUP, DESTINATION)).toBeNull();
  });

  it('returns null when the response is missing polyline data entirely', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ routes: [{}] }) });
    expect(await getRoute(PICKUP, DESTINATION)).toBeNull();
  });

  it('returns null on a network error, never throwing', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));
    await expect(getRoute(PICKUP, DESTINATION)).resolves.toBeNull();
  });

  it('returns null on malformed JSON in the response, never throwing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    });
    await expect(getRoute(PICKUP, DESTINATION)).resolves.toBeNull();
  });

  it('aborts and returns null if the request exceeds the timeout', async () => {
    jest.useFakeTimers();
    mockFetch.mockImplementation(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
        }),
    );

    const promise = getRoute(PICKUP, DESTINATION);
    jest.advanceTimersByTime(9000);
    await expect(promise).resolves.toBeNull();

    jest.useRealTimers();
  });
});

describe('getRoute — no GOOGLE_MAPS_API_KEY configured', () => {
  it('returns null immediately without ever calling fetch', async () => {
    const getRoute = loadGetRoute(undefined);
    const mockFetch = jest.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await getRoute(PICKUP, DESTINATION);

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
