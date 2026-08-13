import { IPeakHourWindow } from "../../../interfaces/pricingConfig.interface";
import { IFactorResult, IPricingContext, IPricingFactor } from "./types";

// UAE doesn't observe DST, so a fixed offset is safe and avoids depending on the
// server process's own timezone (which is very likely UTC in a real deployment) —
// getHours()/getUTCHours() would silently check the wrong hour otherwise.
const UAE_UTC_OFFSET_HOURS = 4;

function getUaeHour(timestamp: Date): number {
  return (timestamp.getUTCHours() + UAE_UTC_OFFSET_HOURS) % 24;
}

function isWithinWindow(hour: number, window: IPeakHourWindow): boolean {
  if (window.startHour <= window.endHour) {
    return hour >= window.startHour && hour < window.endHour;
  }

  // Wrapping window, e.g. 22-2.
  return hour >= window.startHour || hour < window.endHour;
}

export class TimeFactor implements IPricingFactor {
  name = "time";

  calculate(context: IPricingContext): IFactorResult {
    const hour = getUaeHour(context.timestamp);
    const isPeak = context.peakHourWindows.some((window) => isWithinWindow(hour, window));
    const amount = isPeak ? context.peakHourSurcharge : 0;

    return {
      name: this.name,
      amount,
      description: isPeak ? "Peak-hour surcharge" : "Off-peak — no surcharge",
    };
  }
}
