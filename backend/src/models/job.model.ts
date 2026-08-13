import { model, Schema } from "mongoose";
import { JobStatus } from "../constants/job.enum";
import { ServiceType } from "../constants/service.enum";
import { IJob } from "../interfaces/job.interface";
import { mongooseOptions } from "../utils/schema/mongooseOptions";
import { softDeleteDefinition } from "../utils/schema/softDelete";

const jobLocationSchema = {
  geo: {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true },
  },
  address: { type: String, required: true },
};

const jobSchema = new Schema<IJob>(
  {
    jobNumber: { type: String, required: true, unique: true },

    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    offeredDriverIds: { type: [Schema.Types.ObjectId], ref: "Driver", default: [] },

    serviceType: { type: String, enum: Object.values(ServiceType), required: true },
    status: { type: String, enum: Object.values(JobStatus), default: JobStatus.PENDING, index: true },

    pickupLocation: { type: jobLocationSchema, required: true },
    destinationLocation: { type: jobLocationSchema, required: true },

    distanceKm: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
    estimatedFare: { type: Number, required: true },
    finalFare: { type: Number },

    expiresAt: { type: Date, required: true },

    acceptedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },

    ...softDeleteDefinition,
  },
  mongooseOptions
);

jobSchema.index({ "pickupLocation.geo": "2dsphere" });
jobSchema.index({ "destinationLocation.geo": "2dsphere" });
jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({ driverId: 1, status: 1 });
jobSchema.index({ status: 1, expiresAt: 1 });

export const JobModel = model<IJob>("Job", jobSchema);
