import { z } from 'zod';

// Mirrors createVehicleSchema/updateVehicleSchema in the backend's
// vehicle.validator.ts exactly (min lengths, required fields) — verified
// directly against source during the Phase 2 preflight.
//
// Expiry dates are plain "YYYY-MM-DD" text input rather than a native date
// picker: adding @react-native-community/datetimepicker means another
// native module + a full native rebuild (the Phase 1 debug build alone took
// a very long time in this environment) for a Phase-2-scope form. Deferred
// deliberately, not a fake/missing feature — documented in PROGRESS.md.
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const vehicleFormSchema = z.object({
  plateNumber: z.string().min(1, 'Plate number is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  chassisNumber: z.string().min(1, 'Chassis number is required'),
  vehicleType: z.enum([
    'TOW_TRUCK',
    'FLATBED',
    'BIKE_RECOVERY',
    'BOX_RECOVERY',
    'PICKUP',
    'SERVICE_VAN',
    'OTHER',
  ]),
  recoveryType: z
    .array(
      z.enum([
        'CAR_TOWING',
        'BOX_RECOVERY',
        'BIKE_TOWING',
        'JUMP_START',
        'BATTERY_REPLACEMENT',
        'FLAT_TIRE_REPLACEMENT',
        'FUEL_DELIVERY',
      ]),
    )
    .min(1, 'Select at least one service'),
  insurancePolicyNumber: z.string().min(1, 'Insurance policy number is required'),
  insuranceExpiry: isoDateString,
  registrationExpiry: isoDateString,
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
