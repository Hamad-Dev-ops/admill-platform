import { Types } from "mongoose";
import { DriverApprovalStatus, DriverStatus } from "../constants/driver.enum";
import { IDriver } from "../interfaces/driver.interface";
import { IGeoPoint } from "../interfaces/geo.interface";
import { DriverModel } from "../models/driver.model";
import { omitUndefined } from "../utils/object";

const IDENTITY_FIELDS = "firstName lastName email phone profileImage";

export const DriverRepository = {
  async create(
    data: Pick<
      IDriver,
      | "employeeId"
      | "userId"
      | "companyId"
      | "nationalId"
      | "emiratesId"
      | "emiratesIdExpiry"
      | "drivingLicenseNumber"
      | "drivingLicenseExpiry"
    >
  ) {
    return DriverModel.create(data);
  },

  async findById(id: string | Types.ObjectId) {
    return DriverModel.findOne({ _id: id, isDeleted: false });
  },

  async findByUserId(userId: string | Types.ObjectId) {
    return DriverModel.findOne({ userId, isDeleted: false });
  },

  // Decision #4/§3.3: identity lives only on User — any endpoint returning a driver
  // profile populates it from there rather than duplicating name/email/phone here.
  async findByIdWithIdentity(id: string | Types.ObjectId) {
    return DriverModel.findOne({ _id: id, isDeleted: false }).populate("userId", IDENTITY_FIELDS);
  },

  async updateById(id: string | Types.ObjectId, data: Partial<IDriver>) {
    return DriverModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, { returnDocument: "after" });
  },

  async findManyByCompany(
    companyId: string | Types.ObjectId,
    filter: { approvalStatus?: DriverApprovalStatus },
    pagination: { skip: number; limit: number }
  ) {
    const query = { companyId, isDeleted: false, ...omitUndefined(filter) };

    const [data, total] = await Promise.all([
      DriverModel.find(query).skip(pagination.skip).limit(pagination.limit),
      DriverModel.countDocuments(query),
    ]);

    return { data, total };
  },

  async countByStatus(status: DriverStatus) {
    return DriverModel.countDocuments({ status, isDeleted: false });
  },

  // Analytics (M10): the full company roster, unpaginated — a report needs every
  // driver merged with their period stats, not one page of them. Company driver
  // rosters are MVP-scale (dozens, not thousands), same assumption findNearbyAvailable
  // already makes for a single dispatch query.
  async findAllByCompany(companyId: string | Types.ObjectId) {
    return DriverModel.find({ companyId, isDeleted: false });
  },

  async updateLocationByUserId(userId: string | Types.ObjectId, location: IGeoPoint) {
    return DriverModel.findOneAndUpdate({ userId, isDeleted: false }, { currentLocation: location }, { returnDocument: "after" });
  },

  // Job dispatch (M6): a single $near query against the 2dsphere-indexed
  // currentLocation field, filtered to this company's approved, available drivers.
  // $near returns results pre-sorted by distance ascending.
  async findNearbyAvailable(companyId: string | Types.ObjectId, point: IGeoPoint, radiusKm: number) {
    return DriverModel.find({
      companyId,
      isDeleted: false,
      approvalStatus: DriverApprovalStatus.APPROVED,
      status: DriverStatus.AVAILABLE,
      currentLocation: {
        $near: {
          $geometry: point,
          $maxDistance: radiusKm * 1000,
        },
      },
    });
  },
};
