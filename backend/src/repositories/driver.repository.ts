import { Types } from "mongoose";
import { DriverApprovalStatus, DriverStatus } from "../constants/driver.enum";
import { IDriver } from "../interfaces/driver.interface";
import { IGeoPoint } from "../interfaces/geo.interface";
import { DriverModel } from "../models/driver.model";
import { omitUndefined } from "../utils/object";

const IDENTITY_FIELDS = "firstName lastName email phone profileImage";
// Narrower than IDENTITY_FIELDS on purpose — GAP-REPORT.md gap #13: a Customer may see
// their assigned driver's name/photo/rating, never email/phone (no call/message
// affordance exists). Field-listed at the query level (Mongo projection + a matching
// populate select), not fetched-then-filtered, so the excluded fields never leave the
// database for this path.
//
// Only firstName/lastName here, deliberately NOT profileImage — Driver has its own
// profileImage field (driver.interface.ts), separate from User.profileImage, and
// PATCH /drivers/:id (driver.validator.ts) writes to the Driver one. User.profileImage
// is never written anywhere in this codebase (grepped — confirmed dead, same class of
// issue as GAP-REPORT.md gap #13's own finding about Customer.averageRating). The
// gap #13 identity summary below reads photo from Driver.profileImage directly.
const PUBLIC_IDENTITY_FIELDS = "firstName lastName";

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

  // Gap #13 — the Customer-facing "who's my driver" lookup. rating + profileImage are
  // Driver's own fields; name comes from a name-only populate of User. Everything else
  // (email, phone, companyId, approvalStatus, documents, currentLocation, ...) is
  // excluded at the query level. Do not widen this to IDENTITY_FIELDS/
  // findByIdWithIdentity — that would leak phone/email to a Customer, which
  // GAP-REPORT.md gap #13 explicitly rules out (no call/message-driver affordance
  // exists).
  async findByIdWithPublicIdentity(id: string | Types.ObjectId) {
    return DriverModel.findOne({ _id: id, isDeleted: false })
      .select("rating profileImage userId")
      .populate("userId", PUBLIC_IDENTITY_FIELDS);
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
