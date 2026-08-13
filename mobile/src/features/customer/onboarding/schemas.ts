import { z } from 'zod';

// Mirrors registerCustomerSchema in the backend's customer.validator.ts
// exactly (re-verified directly against source, Phase 4.2) — nationalId
// required, address optional. Nothing else exists on this endpoint.
//
// address has no client-side min-length check even though the backend's
// address field is `z.string().min(1).optional()` (rejects an explicit
// empty string) — the screen strips a blank address to `undefined` before
// submitting, so an empty field never reaches the API as `''`.
export const customerRegistrationSchema = z.object({
  nationalId: z.string().min(1, 'National ID is required'),
  address: z.string().optional(),
});

export type CustomerRegistrationValues = z.infer<typeof customerRegistrationSchema>;
