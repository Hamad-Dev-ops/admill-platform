import type { ServiceType, VehicleType } from '../../../types/enums';

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  TOW_TRUCK: 'Tow Truck',
  FLATBED: 'Flatbed',
  BIKE_RECOVERY: 'Bike Recovery',
  BOX_RECOVERY: 'Box Recovery',
  PICKUP: 'Pickup',
  SERVICE_VAN: 'Service Van',
  OTHER: 'Other',
};

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  CAR_TOWING: 'Car Towing',
  BOX_RECOVERY: 'Box Recovery',
  BIKE_TOWING: 'Bike Towing',
  JUMP_START: 'Jump Start',
  BATTERY_REPLACEMENT: 'Battery Replacement',
  FLAT_TIRE_REPLACEMENT: 'Flat Tire Replacement',
  FUEL_DELIVERY: 'Fuel Delivery',
};

export const VEHICLE_TYPE_OPTIONS = (Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[]).map(
  (value) => ({ value, label: VEHICLE_TYPE_LABEL[value] }),
);

export const SERVICE_TYPE_OPTIONS = (Object.keys(SERVICE_TYPE_LABEL) as ServiceType[]).map(
  (value) => ({ value, label: SERVICE_TYPE_LABEL[value] }),
);
