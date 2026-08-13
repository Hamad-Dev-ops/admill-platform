import type { ServiceType } from '../../../types/enums';

// Services performed at the customer's location, with nothing to tow
// anywhere — no meaningful "drop-off" exists. Everything else
// (CAR_TOWING/BOX_RECOVERY/BIKE_TOWING) genuinely moves a vehicle from
// pickup to a real destination. Backend confirmation (Phase 4.5 direct
// source read, job.validator.ts): destinationLocation is unconditionally
// required by POST /jobs regardless of serviceType, and there is no
// pickup≠destination check — so for on-site services this screen defaults
// destination to the same point as pickup rather than asking the customer
// to pick a meaningless drop-off.
export const ON_SITE_SERVICE_TYPES: ServiceType[] = [
  'JUMP_START',
  'BATTERY_REPLACEMENT',
  'FLAT_TIRE_REPLACEMENT',
  'FUEL_DELIVERY',
];

export function isOnSiteService(serviceType: ServiceType): boolean {
  return ON_SITE_SERVICE_TYPES.includes(serviceType);
}
