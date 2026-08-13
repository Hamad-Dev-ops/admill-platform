import { Types } from "mongoose";
import { VehicleStatus } from "../constants/vehicle.enum";
import { IVehicle } from "../interfaces/vehicle.interface";
import { VehicleModel } from "../models/vehicle.model";

export const VehicleRepository = {
  async create(
    data: Pick<
      IVehicle,
      | "vehicleCode"
      | "companyId"
      | "plateNumber"
      | "registrationNumber"
      | "chassisNumber"
      | "vehicleType"
      | "recoveryType"
      | "insurancePolicyNumber"
      | "insuranceExpiry"
      | "registrationExpiry"
    >
  ) {
    return VehicleModel.create(data);
  },

  async findById(id: string | Types.ObjectId) {
    return VehicleModel.findOne({ _id: id, isDeleted: false });
  },

  async updateById(id: string | Types.ObjectId, data: Partial<IVehicle>) {
    return VehicleModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, { returnDocument: "after" });
  },

  async findManyByCompany(companyId: string | Types.ObjectId, pagination: { skip: number; limit: number }) {
    const query = { companyId, isDeleted: false };

    const [data, total] = await Promise.all([
      VehicleModel.find(query).skip(pagination.skip).limit(pagination.limit),
      VehicleModel.countDocuments(query),
    ]);

    return { data, total };
  },

  async countByStatus(currentStatus: VehicleStatus) {
    return VehicleModel.countDocuments({ currentStatus, isDeleted: false });
  },

  async findByAssignedDriver(driverId: string | Types.ObjectId) {
    return VehicleModel.findOne({ assignedDriver: driverId, isDeleted: false });
  },

  // Analytics (M10): the full company fleet, unpaginated — same reasoning as
  // DriverRepository.findAllByCompany.
  async findAllByCompany(companyId: string | Types.ObjectId) {
    return VehicleModel.find({ companyId, isDeleted: false });
  },

  // Company-scoped status breakdown — countByStatus above is deliberately global
  // (used nowhere company-scoped today), so a new method rather than repurposing it
  // to avoid changing its existing, unrelated callers' meaning.
  async getStatusBreakdownByCompany(companyId: string | Types.ObjectId) {
    return VehicleModel.aggregate<{ _id: VehicleStatus; count: number }>([
      { $match: { companyId: new Types.ObjectId(companyId), isDeleted: false } },
      { $group: { _id: "$currentStatus", count: { $sum: 1 } } },
    ]);
  },
};
