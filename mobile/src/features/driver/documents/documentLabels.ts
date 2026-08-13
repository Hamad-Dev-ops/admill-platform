import type { DocumentType } from '../../../types/enums';

// Only the DocumentType values relevant to a driver's own identity
// documents — VEHICLE_REGISTRATION/INSURANCE_CERTIFICATE/ROAD_PERMIT/
// COMPANY_LICENSE exist for vehicles/companies, not drivers (verified
// against src/constants/document.enum.ts), so they're intentionally
// excluded from this driver-facing picker.
export const DRIVER_DOCUMENT_TYPES: DocumentType[] = [
  'EMIRATES_ID',
  'DRIVING_LICENSE',
  'PASSPORT',
  'PROFILE_PHOTO',
];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  EMIRATES_ID: 'Emirates ID',
  DRIVING_LICENSE: 'Driving License',
  PASSPORT: 'Passport',
  PROFILE_PHOTO: 'Profile Photo',
  VEHICLE_REGISTRATION: 'Vehicle Registration',
  INSURANCE_CERTIFICATE: 'Insurance Certificate',
  ROAD_PERMIT: 'Road Permit',
  COMPANY_LICENSE: 'Company License',
};
