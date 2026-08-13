import { useQuery } from '@tanstack/react-query';
import { listVehicles } from '../../../api/vehicles.api';

// Symmetrical to useDriverLookup.ts — Job.vehicleId is never populated
// either (see entities.ts), so resolving "which vehicle" needs the same
// cached-list-and-map-by-id approach.
export function useVehicleLookup() {
  const query = useQuery({
    queryKey: ['vehicles', 'all'],
    queryFn: () => listVehicles({ limit: 100 }),
  });

  const vehicles = query.data?.data ?? [];
  const byId = new Map(vehicles.map((vehicle) => [vehicle._id, vehicle]));

  function getVehicleLabel(vehicleId?: string): string {
    if (!vehicleId) return 'No vehicle';
    const vehicle = byId.get(vehicleId);
    return vehicle ? vehicle.plateNumber : 'Unknown vehicle';
  }

  function getVehicleAssignedTo(driverId: string) {
    return vehicles.find((vehicle) => vehicle.assignedDriver === driverId);
  }

  return { vehicles, byId, getVehicleLabel, getVehicleAssignedTo, isLoading: query.isLoading };
}
