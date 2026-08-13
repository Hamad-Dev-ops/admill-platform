import { IBase } from "./base.interface";

export interface IPeakHourWindow {
  startHour: number; // 0-23, local server time
  endHour: number; // 0-23, exclusive
}

/**
 * Global for the MVP (Service catalog is global too — see service.interface.ts), but
 * deliberately structured so a future `companyId?: Types.ObjectId` field can be added
 * without breaking existing documents: global config would simply have no companyId,
 * company-specific overrides would have one. No refactor needed to get there.
 *
 * Versioned rather than mutated in place: monthly fuel price changes (and any other
 * rule change) create a new document instead of overwriting the old one, so historical
 * fare calculations remain explainable against the config that was actually active
 * when they happened.
 */
export interface IPricingConfig extends IBase {
  version: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;

  currentFuelPrice: number; // AED per liter, manually updated monthly
  fuelConsumptionPerKm: number; // liters/km — vehicle-physics constant
  perKmRate: number; // AED per km

  peakHourWindows: IPeakHourWindow[];
  peakHourSurcharge: number; // flat AED surcharge inside a configured window

  lowSupplyThreshold: number; // available-driver count below which demand surcharge kicks in
  maxDemandSurcharge: number; // AED, surcharge at maximum demand pressure

  surgeEnabled: boolean; // reserved — CompanyPricingFactor/SurgeFactor are still stubs
}
