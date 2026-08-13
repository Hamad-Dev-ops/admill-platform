import { Types } from "mongoose";
import { DriverApprovalStatus } from "../../constants/driver.enum";
import { UserRole } from "../../constants/role.enum";
import { AppError } from "../../errors/AppError";
import { IDriver } from "../../interfaces/driver.interface";
import { CompanyRepository } from "../../repositories/company.repository";
import { CounterRepository } from "../../repositories/counter.repository";
import { DriverRepository } from "../../repositories/driver.repository";
import { DriverPositionUpdateInput } from "../../utils/geo";
import { generateBusinessId } from "../../utils/schema/generateBusinessId";
import { CompanyService } from "../company/company.service";
import { TrackingService } from "../tracking/tracking.service";
import { RegisterDriverInput, UpdateDriverInput, UpdateDriverStatusInput } from "./driver.validator";

async function assertDriverAccess(
  requesterId: string,
  requesterRole: UserRole,
  driver: Pick<IDriver, "userId" | "companyId">
): Promise<void> {
  if (requesterRole === UserRole.DRIVER && driver.userId.toString() === requesterId) {
    return;
  }

  if (requesterRole === UserRole.OWNER) {
    await CompanyService.assertOwnerOwnsCompany(requesterId, driver.companyId);
    return;
  }

  throw new AppError(403, "You do not have permission to access this driver");
}

export const DriverService = {
  async register(userId: string, input: RegisterDriverInput) {
    const company = await CompanyRepository.findByCompanyCode(input.companyCode);

    if (!company) {
      throw new AppError(404, "No company found for this code");
    }

    const existing = await DriverRepository.findByUserId(userId);

    if (existing) {
      throw new AppError(409, "You already have a driver profile");
    }

    const sequence = await CounterRepository.incrementAndGet("driver");
    const employeeId = generateBusinessId("DRV", sequence);

    return DriverRepository.create({
      employeeId,
      userId: new Types.ObjectId(userId),
      companyId: company._id,
      nationalId: input.nationalId,
      emiratesId: input.emiratesId,
      emiratesIdExpiry: input.emiratesIdExpiry,
      drivingLicenseNumber: input.drivingLicenseNumber,
      drivingLicenseExpiry: input.drivingLicenseExpiry,
    });
  },

  // Returns the raw (unpopulated) document — used internally by callers that only need
  // driver._id/companyId (e.g. document upload), not a public-facing response shape.
  async getRawById(requesterId: string, requesterRole: UserRole, driverId: string) {
    const driver = await DriverRepository.findById(driverId);

    if (!driver) {
      throw new AppError(404, "Driver not found");
    }

    await assertDriverAccess(requesterId, requesterRole, driver);

    return driver;
  },

  // Mirrors CustomerService.getMyProfile exactly (Phase 3 mobile gap #10) — resolves
  // the driver by the caller's own userId first, so "self" is guaranteed by
  // construction and assertDriverAccess's self-or-owner check is unnecessary here,
  // unlike getById below which takes a driver _id from someone else's route param.
  async getMyProfile(userId: string) {
    const driver = await DriverRepository.findByUserId(userId);

    if (!driver) {
      throw new AppError(404, "Driver profile not found");
    }

    const populated = await DriverRepository.findByIdWithIdentity(driver._id!);

    if (!populated) {
      throw new AppError(404, "Driver profile not found");
    }

    return populated;
  },

  // Decision #4/§3.3: any endpoint returning a driver profile populates identity from
  // User rather than exposing/duplicating it on Driver.
  async getById(requesterId: string, requesterRole: UserRole, driverId: string) {
    await this.getRawById(requesterId, requesterRole, driverId);

    const populated = await DriverRepository.findByIdWithIdentity(driverId);

    if (!populated) {
      throw new AppError(404, "Driver not found");
    }

    return populated;
  },

  async updateById(requesterId: string, requesterRole: UserRole, driverId: string, input: UpdateDriverInput) {
    const driver = await DriverRepository.findById(driverId);

    if (!driver) {
      throw new AppError(404, "Driver not found");
    }

    await assertDriverAccess(requesterId, requesterRole, driver);

    const updated = await DriverRepository.updateById(driverId, input);

    if (!updated) {
      throw new AppError(404, "Driver not found");
    }

    return DriverRepository.findByIdWithIdentity(driverId);
  },

  async approve(ownerId: string, driverId: string) {
    const driver = await DriverRepository.findById(driverId);

    if (!driver) {
      throw new AppError(404, "Driver not found");
    }

    await CompanyService.assertOwnerOwnsCompany(ownerId, driver.companyId);

    return DriverRepository.updateById(driverId, { approvalStatus: DriverApprovalStatus.APPROVED });
  },

  async reject(ownerId: string, driverId: string, reason?: string) {
    const driver = await DriverRepository.findById(driverId);

    if (!driver) {
      throw new AppError(404, "Driver not found");
    }

    await CompanyService.assertOwnerOwnsCompany(ownerId, driver.companyId);

    return DriverRepository.updateById(driverId, {
      approvalStatus: DriverApprovalStatus.REJECTED,
      rejectionReason: reason,
    });
  },

  async listForMyCompany(
    ownerId: string,
    filter: { approvalStatus?: DriverApprovalStatus },
    pagination: { skip: number; limit: number }
  ) {
    const company = await CompanyRepository.findByOwnerId(ownerId);

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    return DriverRepository.findManyByCompany(company._id, filter, pagination);
  },

  // Milestone 7 decision: REST and Socket.IO (socket/tracking.socket.ts) both funnel
  // through this exact TrackingService call — no location-update business logic is
  // duplicated between the two ingestion paths.
  async updateMyLocation(userId: string, input: DriverPositionUpdateInput) {
    const result = await TrackingService.updateLocation(userId, input.location, {
      speed: input.speed,
      heading: input.heading,
      accuracy: input.accuracy,
      timestamp: input.timestamp,
    });

    return result.driver;
  },

  async updateMyStatus(userId: string, input: UpdateDriverStatusInput) {
    const driver = await DriverRepository.findByUserId(userId);

    if (!driver) {
      throw new AppError(404, "Driver profile not found");
    }

    if (driver.approvalStatus !== DriverApprovalStatus.APPROVED) {
      throw new AppError(403, "Driver must be approved before going online");
    }

    return DriverRepository.updateById(driver._id!, { status: input.status });
  },
};
