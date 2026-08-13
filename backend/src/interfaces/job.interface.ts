import { Types } from "mongoose";
import { JobStatus } from "../constants/job.enum";
import { ServiceType } from "../constants/service.enum";
import { IBase } from "./base.interface";
import { IGeoPoint } from "./geo.interface";

export interface IJobLocation {
  geo: IGeoPoint;
  address: string;
}

export interface IJob extends IBase {
  jobNumber: string;

  companyId: Types.ObjectId;
  customerId: Types.ObjectId;
  driverId?: Types.ObjectId;
  vehicleId?: Types.ObjectId;

  // Snapshot of the nearby-driver dispatch set at creation time — only a driver in
  // this list may accept (an AVAILABLE driver added to the company later, or one who
  // was out of range, cannot). Empty is valid (no one nearby); the job just sits
  // PENDING until it expires.
  offeredDriverIds: Types.ObjectId[];

  // References the Service catalog (Milestone 5) by type rather than by serviceId —
  // matches PricingService.calculateFare()'s actual signature, which resolves the
  // Service document from serviceType itself.
  serviceType: ServiceType;
  status: JobStatus;

  pickupLocation: IJobLocation;
  // Required, not optional: PricingService.calculateFare() needs both points to run
  // DistanceFactor, so a job can't get an estimatedFare without a destination.
  destinationLocation: IJobLocation;

  distanceKm: number;
  durationMinutes: number;
  estimatedFare: number;
  finalFare?: number;

  // Set at creation (now + a fixed window); PENDING jobs past this are lazily flipped
  // to EXPIRED on next read/accept attempt rather than via a separate cron process.
  expiresAt: Date;

  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}
