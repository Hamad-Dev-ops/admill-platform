import { IBase } from "./base.interface";
import { ServiceType } from "../constants/service.enum";

export interface IService extends IBase {
  serviceCode: string;

  serviceType: ServiceType;

  displayName: string;

  description?: string;

  baseFare: number;

  isAvailable: boolean;
}