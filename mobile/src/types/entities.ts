import type {
  DocumentOwnerType,
  DocumentType,
  DocumentVerificationStatus,
  DriverApprovalStatus,
  DriverStatus,
  JobStatus,
  NotificationPriority,
  NotificationType,
  ServiceType,
  UserRole,
  VehicleStatus,
  VehicleType,
} from './enums';
import type { GeoPoint } from './api';

// Base fields every backend entity carries (frontend-docs/API-CONTRACT.md
// §Base entity shape).
export interface BaseEntity {
  _id: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
}

export interface AuthResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

// A User's identity fields, as populated onto Driver.userId by GET/PATCH
// /drivers/:id only (never on the GET /drivers list — see DriverListItem
// below). Verified directly against driver.repository.ts.
export interface PopulatedIdentity {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profileImage?: string;
}

// Minimal shape for Phase 1 navigation branching (§ROLE-PERMISSION-MATRIX.md
// "two-step profile creation"). `employeeId` — NOT `driverCode` (Phase 1 had
// this wrong; never actually read anywhere, fixed in Phase 2 before it could
// cause a real bug).
export interface DriverProfileSummary extends BaseEntity {
  employeeId: string;
  companyId: string;
  status: DriverStatus;
  approvalStatus: DriverApprovalStatus;
}

// Full Driver shape, as returned by GET /drivers (list — userId unpopulated)
// and GET/PATCH /drivers/:id (userId populated). Verified against
// driver.interface.ts + driver.repository.ts populate behavior.
export interface Driver extends BaseEntity {
  employeeId: string;
  userId: string | PopulatedIdentity;
  companyId: string;
  nationalId: string;
  emiratesId: string;
  emiratesIdExpiry: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiry: string;
  profileImage?: string;
  status: DriverStatus;
  approvalStatus: DriverApprovalStatus;
  rejectionReason?: string;
  rating: number;
  totalTrips: number;
  currentLocation?: GeoPoint;
}

// Shared across Driver/Customer — both populate `userId` from User the
// exact same way (customer.repository.ts/driver.repository.ts, identical
// IDENTITY_FIELDS).
export function isPopulatedIdentity(
  userId: string | PopulatedIdentity,
): userId is PopulatedIdentity {
  return typeof userId === 'object';
}

// Full Customer shape, as returned by GET/PATCH /customers/me (userId
// identity-populated — verified against customer.repository.ts's
// findByIdWithIdentity, same IDENTITY_FIELDS as Driver). POST /customers'
// own response is NOT identity-populated (register() returns the raw
// CustomerRepository.create() result) — callers should invalidate and let
// GET /customers/me re-fetch rather than reading identity off a create
// response.
//
// Deliberately excludes `averageRating`/`totalJobs`, even though both exist
// on the backend's ICustomer schema — confirmed via direct source grep
// (Phase 4 preflight audit, GAP-REPORT.md gap #13) that neither field is
// ever written by any code path. Including them here would invite a future
// screen to render them as if they were real. Derive a trips count from
// GET /jobs?status=COMPLETED's meta.total instead, same pattern Driver's
// earnings screen already uses.
export interface Customer extends BaseEntity {
  customerCode: string;
  userId: string | PopulatedIdentity;
  nationalId: string;
  address?: string;
}

export interface CompanySummary extends BaseEntity {
  companyCode: string;
  companyName: string;
  email: string;
  phone: string;
  logo?: string;
  address: string;
  city: string;
  country: string;
  tradeLicenseNumber: string;
  tradeLicenseExpiry: string;
  serviceAreas: string[];
  ownerId: string;
}

export interface CompanySettings extends BaseEntity {
  companyId: string;
  operatingHours: { open: string; close: string };
  defaultServiceRadiusKm: number;
  notificationPreferences: { email: boolean; sms: boolean; push: boolean };
  invoiceBranding: { logoUrl?: string; invoicePrefix?: string };
}

// Vehicle.assignedDriver is NEVER populated by the backend (verified against
// vehicle.repository.ts — zero .populate() calls in the vehicle module) —
// always a raw id or undefined. Resolve a display name client-side against
// the cached driver roster (src/features/owner/fleet/useDriverLookup.ts).
export interface Vehicle extends BaseEntity {
  vehicleCode: string;
  companyId: string;
  assignedDriver?: string;
  plateNumber: string;
  registrationNumber: string;
  chassisNumber: string;
  vehicleType: VehicleType;
  recoveryType: ServiceType[];
  currentStatus: VehicleStatus;
  insurancePolicyNumber: string;
  insuranceExpiry: string;
  registrationExpiry: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
}

export interface JobLocation {
  geo: GeoPoint;
  address: string;
}

// Job.companyId/customerId/driverId/vehicleId/offeredDriverIds are NEVER
// populated (verified against job.repository.ts) — always raw ids. The
// backend has no Owner-facing customer lookup at all (see GAP-REPORT.md
// gap #11) — do not build UI that assumes a customer name/phone is
// available here. assignedDriver (below) is the one deliberate exception —
// a Gap #13 addition, name/photo/rating only, never email/phone.
export interface Job extends BaseEntity {
  jobNumber: string;
  companyId: string;
  customerId: string;
  driverId?: string;
  vehicleId?: string;
  offeredDriverIds: string[];
  serviceType: ServiceType;
  status: JobStatus;
  pickupLocation: JobLocation;
  destinationLocation: JobLocation;
  distanceKm: number;
  durationMinutes: number;
  estimatedFare: number;
  finalFare?: number;
  expiresAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  // GET /jobs/:id only (GAP-REPORT.md gap #13) — null before a driver is
  // assigned, and once assigned, only ever the fields listed here.
  assignedDriver?: JobAssignedDriver | null;
}

export interface JobAssignedDriver {
  firstName: string;
  lastName: string;
  profileImage?: string;
  rating: number;
}

export interface Notification extends BaseEntity {
  receiverId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  isRead: boolean;
}

export interface Rating extends BaseEntity {
  jobId: string;
  customerId: string;
  driverId: string;
  stars: number;
  review?: string;
}

export interface AppDocument extends BaseEntity {
  ownerType: DocumentOwnerType;
  ownerId: string;
  documentType: DocumentType;
  fileUrl: string;
  expiryDate?: string;
  verificationStatus: DocumentVerificationStatus;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

// Analytics response shapes — verified directly against analytics.service.ts.
// All numeric fields are UNROUNDED floats server-side; round in the UI layer.
export interface RevenueSummary {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  completedJobsCount: number;
  averageFare: number;
}

export interface DriverStat {
  driverId: string;
  employeeId: string;
  completedJobsCount: number;
  revenue: number;
  rating: number;
  totalTrips: number;
}

// PricingConfig is GLOBAL, not per-company (frontend-docs/GAP-REPORT.md —
// "already-known, carried-over gaps"). Any OWNER can read/write the one
// active version for the whole platform; there is no per-company isolation
// today. Never present this as "your company's private pricing" in UI copy.
export interface PricingConfig extends BaseEntity {
  version: number;
  effectiveFrom: string;
  effectiveTo?: string;
  currentFuelPrice: number;
  fuelConsumptionPerKm: number;
  perKmRate: number;
  peakHourWindows: Array<{ startHour: number; endHour: number }>;
  peakHourSurcharge: number;
  lowSupplyThreshold: number;
  maxDemandSurcharge: number;
  surgeEnabled: boolean;
}

// statusBreakdown is a SPARSE map (verified) — a VehicleStatus with zero
// vehicles simply has no key. Always default to 0 when reading, never
// assume every enum value is present.
export interface FleetUtilization {
  totalVehicles: number;
  statusBreakdown: Partial<Record<VehicleStatus, number>>;
  vehicles: Array<{ vehicleId: string; vehicleCode: string; completedJobsCount: number }>;
}
