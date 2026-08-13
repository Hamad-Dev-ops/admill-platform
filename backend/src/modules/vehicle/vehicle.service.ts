import { UserRole } from "../../constants/role.enum";
import { AppError } from "../../errors/AppError";
import { IVehicle } from "../../interfaces/vehicle.interface";
import { CompanyRepository } from "../../repositories/company.repository";
import { CounterRepository } from "../../repositories/counter.repository";
import { DriverRepository } from "../../repositories/driver.repository";
import { VehicleRepository } from "../../repositories/vehicle.repository";
import { generateBusinessId } from "../../utils/schema/generateBusinessId";
import { CompanyService } from "../company/company.service";
import { CreateVehicleInput, UpdateVehicleInput } from "./vehicle.validator";

async function assertVehicleAccess(
  requesterId: string,
  requesterRole: UserRole,
  vehicle: Pick<IVehicle, "companyId" | "assignedDriver">
): Promise<void> {
  if (requesterRole === UserRole.OWNER) {
    await CompanyService.assertOwnerOwnsCompany(requesterId, vehicle.companyId);
    return;
  }

  if (requesterRole === UserRole.DRIVER) {
    const driver = await DriverRepository.findByUserId(requesterId);

    if (driver && vehicle.assignedDriver && driver._id.equals(vehicle.assignedDriver)) {
      return;
    }
  }

  throw new AppError(403, "You do not have permission to access this vehicle");
}

export const VehicleService = {
  async create(ownerId: string, input: CreateVehicleInput) {
    const company = await CompanyRepository.findByOwnerId(ownerId);

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    const sequence = await CounterRepository.incrementAndGet("vehicle");
    const vehicleCode = generateBusinessId("VEH", sequence);

    return VehicleRepository.create({ ...input, vehicleCode, companyId: company._id });
  },

  async getById(requesterId: string, requesterRole: UserRole, vehicleId: string) {
    const vehicle = await VehicleRepository.findById(vehicleId);

    if (!vehicle) {
      throw new AppError(404, "Vehicle not found");
    }

    await assertVehicleAccess(requesterId, requesterRole, vehicle);

    return vehicle;
  },

  async updateById(ownerId: string, vehicleId: string, input: UpdateVehicleInput) {
    const vehicle = await VehicleRepository.findById(vehicleId);

    if (!vehicle) {
      throw new AppError(404, "Vehicle not found");
    }

    await CompanyService.assertOwnerOwnsCompany(ownerId, vehicle.companyId);

    const updated = await VehicleRepository.updateById(vehicleId, input);

    if (!updated) {
      throw new AppError(404, "Vehicle not found");
    }

    return updated;
  },

  async assignDriver(ownerId: string, vehicleId: string, driverId: string) {
    const vehicle = await VehicleRepository.findById(vehicleId);

    if (!vehicle) {
      throw new AppError(404, "Vehicle not found");
    }

    await CompanyService.assertOwnerOwnsCompany(ownerId, vehicle.companyId);

    const driver = await DriverRepository.findById(driverId);

    if (!driver) {
      throw new AppError(404, "Driver not found");
    }

    if (!driver.companyId.equals(vehicle.companyId)) {
      throw new AppError(409, "Driver does not belong to the same company as this vehicle");
    }

    return VehicleRepository.updateById(vehicleId, { assignedDriver: driver._id });
  },

  async listForMyCompany(ownerId: string, pagination: { skip: number; limit: number }) {
    const company = await CompanyRepository.findByOwnerId(ownerId);

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    return VehicleRepository.findManyByCompany(company._id, pagination);
  },
};
