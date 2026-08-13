import { z } from 'zod';

// Field constraints mirror frontend-docs/API-CONTRACT.md §Auth exactly
// (min lengths etc. match the backend's Zod validator, so a client-side
// failure and a server-side 400 never disagree).

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().min(6, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['OWNER', 'DRIVER', 'CUSTOMER']),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
