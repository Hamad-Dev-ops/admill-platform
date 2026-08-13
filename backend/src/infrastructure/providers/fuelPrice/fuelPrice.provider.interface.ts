export interface IFuelPriceProvider {
  getCurrentFuelPrice(): Promise<number>;
}
