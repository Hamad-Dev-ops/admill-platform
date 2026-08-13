import type { NotificationType } from '../../../types/enums';

// Only JOB_REQUEST, JOB_ACCEPTED, JOB_CANCELLED, DRIVER_ARRIVED, JOB_STARTED,
// JOB_COMPLETED are actually emitted anywhere in the backend today
// (verified — API-CONTRACT.md §Enums). The rest are mapped too so an
// unexpected/future type still renders something reasonable rather than
// crashing on a missing key.
export const NOTIFICATION_ICON: Record<NotificationType, string> = {
  JOB_REQUEST: 'clipboard-text-outline',
  JOB_ACCEPTED: 'check-circle-outline',
  JOB_REJECTED: 'close-circle-outline',
  DRIVER_ASSIGNED: 'account-check-outline',
  DRIVER_ARRIVED: 'map-marker-check-outline',
  JOB_STARTED: 'progress-clock',
  JOB_COMPLETED: 'flag-checkered',
  JOB_CANCELLED: 'cancel',
  PAYMENT_RECEIVED: 'cash-check',
  DRIVER_ONLINE: 'account-arrow-right-outline',
  DRIVER_OFFLINE: 'account-arrow-left-outline',
  VEHICLE_ASSIGNED: 'truck-check-outline',
  VEHICLE_MAINTENANCE: 'truck-alert-outline',
  VEHICLE_DOCUMENT_EXPIRY: 'file-alert-outline',
  LICENSE_EXPIRY: 'card-account-details-outline',
  SYSTEM: 'information-outline',
};
