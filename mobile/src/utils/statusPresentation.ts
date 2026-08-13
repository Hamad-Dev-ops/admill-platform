import type { ChipTone } from '../components/StatusChip';
import type {
  DocumentVerificationStatus,
  DriverApprovalStatus,
  DriverStatus,
  JobStatus,
  VehicleStatus,
} from '../types/enums';

// Centralizes label + chip tone for every backend enum shown as a status
// chip, so Fleet/Drivers/Jobs screens all render the same enum the same way
// instead of each inventing its own labels/colors.

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  EN_ROUTE: 'En Route',
  ARRIVED: 'Arrived',
  STARTED: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const JOB_STATUS_TONE: Record<JobStatus, ChipTone> = {
  PENDING: 'warning',
  ACCEPTED: 'info',
  EN_ROUTE: 'info',
  ARRIVED: 'info',
  STARTED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'neutral',
};

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  AVAILABLE: 'Available',
  ASSIGNED: 'Assigned',
  ON_RECOVERY: 'On Recovery',
  MAINTENANCE: 'Maintenance',
  OFFLINE: 'Offline',
};

export const VEHICLE_STATUS_TONE: Record<VehicleStatus, ChipTone> = {
  AVAILABLE: 'success',
  ASSIGNED: 'info',
  ON_RECOVERY: 'info',
  MAINTENANCE: 'warning',
  OFFLINE: 'neutral',
};

export const DRIVER_STATUS_LABEL: Record<DriverStatus, string> = {
  AVAILABLE: 'Available',
  ON_JOB: 'On Job',
  OFFLINE: 'Offline',
  ON_BREAK: 'On Break',
  ON_LEAVE: 'On Leave',
  SUSPENDED: 'Suspended',
};

export const DRIVER_STATUS_TONE: Record<DriverStatus, ChipTone> = {
  AVAILABLE: 'success',
  ON_JOB: 'info',
  OFFLINE: 'neutral',
  ON_BREAK: 'warning',
  ON_LEAVE: 'warning',
  SUSPENDED: 'danger',
};

export const APPROVAL_STATUS_LABEL: Record<DriverApprovalStatus, string> = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const APPROVAL_STATUS_TONE: Record<DriverApprovalStatus, ChipTone> = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const DOCUMENT_STATUS_LABEL: Record<DocumentVerificationStatus, string> = {
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
};

export const DOCUMENT_STATUS_TONE: Record<DocumentVerificationStatus, ChipTone> = {
  PENDING: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
};
