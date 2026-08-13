import { DriverStatus } from "../../constants/driver.enum";
import { VehicleStatus } from "../../constants/vehicle.enum";
import { DriverRepository } from "../../repositories/driver.repository";
import { VehicleRepository } from "../../repositories/vehicle.repository";

export interface IDemandSnapshot {
  availableDrivers: number;
  availableVehicles: number;
  demandRatio: number; // 0 (no pressure) .. 1 (max pressure)
}

/**
 * Demand is derived from our own data via repositories, not a third-party
 * integration — this is a domain estimator, not an infrastructure provider, so it
 * lives in modules/pricing rather than infrastructure/providers.
 *
 * Interim signal: driver/vehicle availability only. `Job` doesn't exist until
 * Milestone 6 — once it does, pending-jobs/incoming-requests counts should extend
 * this same snapshot without changing DemandFactor's contract.
 */
export const DemandEstimator = {
  async getSnapshot(lowSupplyThreshold: number): Promise<IDemandSnapshot> {
    const [availableDrivers, availableVehicles] = await Promise.all([
      DriverRepository.countByStatus(DriverStatus.AVAILABLE),
      VehicleRepository.countByStatus(VehicleStatus.AVAILABLE),
    ]);

    const demandRatio =
      lowSupplyThreshold <= 0 ? 0 : Math.max(0, Math.min(1, 1 - availableDrivers / lowSupplyThreshold));

    return { availableDrivers, availableVehicles, demandRatio };
  },
};
