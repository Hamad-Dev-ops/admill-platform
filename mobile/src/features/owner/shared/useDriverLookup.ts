import { useQuery } from '@tanstack/react-query';
import { listDrivers } from '../../../api/drivers.api';
import { isPopulatedIdentity, type Driver } from '../../../types/entities';

// Vehicle.assignedDriver and Job.driverId are always raw ids (verified —
// see entities.ts). GET /drivers (list, used here) doesn't populate userId
// either, so a driver's display name has to come from this same list
// response's own fields — there is no name on a bare id. Cached once per
// screen-tree via React Query, reused by Fleet/Jobs/Drivers screens instead
// of each fetching its own copy.
export function useDriverLookup() {
  const query = useQuery({
    queryKey: ['drivers', 'all'],
    queryFn: () => listDrivers({ limit: 100 }),
  });

  const drivers = query.data?.data ?? [];
  const byId = new Map<string, Driver>(drivers.map((driver) => [driver._id, driver]));

  function getDriverLabel(driverId?: string): string {
    if (!driverId) return 'Unassigned';
    const driver = byId.get(driverId);
    if (!driver) return 'Unknown driver';
    if (isPopulatedIdentity(driver.userId)) {
      return `${driver.userId.firstName} ${driver.userId.lastName}`;
    }
    return driver.employeeId;
  }

  return { drivers, byId, getDriverLabel, isLoading: query.isLoading };
}
