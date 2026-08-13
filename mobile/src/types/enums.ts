// Mirrors frontend-docs/API-CONTRACT.md §Enums exactly. Do not add/rename
// values here without re-checking the backend source — these are the real
// wire values, not display labels.

export type UserRole = 'OWNER' | 'DRIVER' | 'CUSTOMER';

export type DriverStatus =
  | 'AVAILABLE'
  | 'ON_JOB'
  | 'OFFLINE'
  | 'ON_BREAK'
  | 'ON_LEAVE'
  | 'SUSPENDED';

export type DriverApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type ServiceType =
  | 'CAR_TOWING'
  | 'BOX_RECOVERY'
  | 'BIKE_TOWING'
  | 'JUMP_START'
  | 'BATTERY_REPLACEMENT'
  | 'FLAT_TIRE_REPLACEMENT'
  | 'FUEL_DELIVERY';

export type JobStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'STARTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB';

export type DocumentOwnerType = 'DRIVER' | 'VEHICLE' | 'COMPANY';

export type DocumentType =
  | 'EMIRATES_ID'
  | 'DRIVING_LICENSE'
  | 'PASSPORT'
  | 'PROFILE_PHOTO'
  | 'VEHICLE_REGISTRATION'
  | 'INSURANCE_CERTIFICATE'
  | 'ROAD_PERMIT'
  | 'COMPANY_LICENSE';

export type DocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type NotificationType =
  | 'JOB_REQUEST'
  | 'JOB_ACCEPTED'
  | 'JOB_REJECTED'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVED'
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_CANCELLED'
  | 'PAYMENT_RECEIVED'
  | 'DRIVER_ONLINE'
  | 'DRIVER_OFFLINE'
  | 'VEHICLE_ASSIGNED'
  | 'VEHICLE_MAINTENANCE'
  | 'VEHICLE_DOCUMENT_EXPIRY'
  | 'LICENSE_EXPIRY'
  | 'SYSTEM';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type VehicleStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_RECOVERY' | 'MAINTENANCE' | 'OFFLINE';

export type VehicleType =
  | 'TOW_TRUCK'
  | 'FLATBED'
  | 'BIKE_RECOVERY'
  | 'BOX_RECOVERY'
  | 'PICKUP'
  | 'SERVICE_VAN'
  | 'OTHER';
