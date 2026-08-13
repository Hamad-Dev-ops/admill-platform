import { Types } from "mongoose";
import { IBase } from "./base.interface";
import { DriverApprovalStatus, DriverStatus } from "../constants/driver.enum";
import { IGeoPoint } from "./geo.interface";

export interface IDriver extends IBase {
  employeeId: string;

  userId: Types.ObjectId;

  companyId: Types.ObjectId;

  nationalId: string;

  emiratesId: string;

  emiratesIdExpiry: Date;

  drivingLicenseNumber: string;

  drivingLicenseExpiry: Date;

  profileImage?: string;

  status: DriverStatus;

  approvalStatus: DriverApprovalStatus;

  rejectionReason?: string;

  rating: number;

  totalTrips: number;

  // Pulled forward from Milestone 7 (Tracking) so Milestone 6 dispatch can run a real
  // 2dsphere nearby-driver query. Only the field + index are M6-scoped; live GPS
  // ingestion (sockets, ITrackingStore, LocationHistory sampling) is still all M7.
  currentLocation?: IGeoPoint;
}