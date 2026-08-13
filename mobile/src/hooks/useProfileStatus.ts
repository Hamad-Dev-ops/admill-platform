import { useQuery } from '@tanstack/react-query';
import { getMyCompany } from '../api/companies.api';
import { getMyCustomerProfile } from '../api/customers.api';
import { getMyDriverProfile } from '../api/drivers.api';
import { useAuth } from '../auth/AuthContext';

export type ProfileStatus =
  | { kind: 'loading' }
  | { kind: 'no-profile' }
  | { kind: 'pending-approval' }
  | { kind: 'rejected' }
  | { kind: 'ready' }
  | { kind: 'error'; retry: () => void };

// Drives the "two-step profile creation" navigation branch described in
// frontend-docs/ROLE-PERMISSION-MATRIX.md and architecture-baseline.md §5.2.
//
// getMyCompany/getMyDriverProfile/getMyCustomerProfile all share one
// contract (companies.api.ts/drivers.api.ts/customers.api.ts): a real 404
// ("this role has genuinely never completed profile setup") resolves to
// `null` — a *successful* query with no data — while every other failure
// (offline, timeout, 500) is rethrown and surfaces as the query's own
// isError. Those are not the same thing and must not collapse into the same
// branch here: checking `data` truthiness alone (the previous bug) treats a
// dropped connection identically to "you never registered", which would
// send an already-set-up user back through onboarding just because the
// network hiccuped.
export function useProfileStatus(): ProfileStatus {
  const { user } = useAuth();

  const ownerQuery = useQuery({
    queryKey: ['companies', 'me'],
    queryFn: getMyCompany,
    enabled: user?.role === 'OWNER',
  });

  const customerQuery = useQuery({
    queryKey: ['customers', 'me'],
    queryFn: getMyCustomerProfile,
    enabled: user?.role === 'CUSTOMER',
  });

  const driverQuery = useQuery({
    queryKey: ['drivers', 'me'],
    queryFn: getMyDriverProfile,
    enabled: user?.role === 'DRIVER',
  });

  if (!user) return { kind: 'loading' };

  if (user.role === 'OWNER') {
    if (ownerQuery.isLoading) return { kind: 'loading' };
    if (ownerQuery.isError) return { kind: 'error', retry: () => ownerQuery.refetch() };
    return ownerQuery.data ? { kind: 'ready' } : { kind: 'no-profile' };
  }

  if (user.role === 'CUSTOMER') {
    if (customerQuery.isLoading) return { kind: 'loading' };
    if (customerQuery.isError) return { kind: 'error', retry: () => customerQuery.refetch() };
    return customerQuery.data ? { kind: 'ready' } : { kind: 'no-profile' };
  }

  // DRIVER
  if (driverQuery.isLoading) return { kind: 'loading' };
  if (driverQuery.isError) return { kind: 'error', retry: () => driverQuery.refetch() };
  if (!driverQuery.data) return { kind: 'no-profile' };
  if (driverQuery.data.approvalStatus === 'APPROVED') return { kind: 'ready' };
  if (driverQuery.data.approvalStatus === 'REJECTED') return { kind: 'rejected' };
  return { kind: 'pending-approval' };
}
