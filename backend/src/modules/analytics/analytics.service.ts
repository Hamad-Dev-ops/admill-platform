import { Types } from "mongoose";
import { AppError } from "../../errors/AppError";
import { CompanyRepository } from "../../repositories/company.repository";
import { DriverRepository } from "../../repositories/driver.repository";
import { JobRepository } from "../../repositories/job.repository";
import { VehicleRepository } from "../../repositories/vehicle.repository";

export interface IDateRange {
  startDate: Date;
  endDate: Date;
}

async function resolveOwnerCompanyId(ownerId: string): Promise<Types.ObjectId> {
  const company = await CompanyRepository.findByOwnerId(ownerId);
  if (!company?._id) {
    throw new AppError(404, "Company not found");
  }
  return company._id;
}

export const AnalyticsService = {
  async getRevenue(ownerId: string, range: IDateRange) {
    const companyId = await resolveOwnerCompanyId(ownerId);
    const summary = await JobRepository.getRevenueSummary(companyId, range.startDate, range.endDate);

    return {
      startDate: range.startDate,
      endDate: range.endDate,
      totalRevenue: summary.totalRevenue,
      completedJobsCount: summary.completedJobsCount,
      averageFare: summary.averageFare,
    };
  },

  async getDriverStats(ownerId: string, range: IDateRange) {
    const companyId = await resolveOwnerCompanyId(ownerId);

    const [drivers, jobStats] = await Promise.all([
      DriverRepository.findAllByCompany(companyId),
      JobRepository.getCompletedJobStatsByDriver(companyId, range.startDate, range.endDate),
    ]);

    const statsByDriverId = new Map(jobStats.map((s) => [s._id.toString(), s]));

    return drivers.map((driver) => {
      const stats = statsByDriverId.get(driver._id!.toString());

      return {
        driverId: driver._id,
        employeeId: driver.employeeId,
        completedJobsCount: stats?.completedJobsCount ?? 0,
        revenue: stats?.revenue ?? 0,
        rating: driver.rating,
        totalTrips: driver.totalTrips,
      };
    });
  },

  async getFleetUtilization(ownerId: string, range: IDateRange) {
    const companyId = await resolveOwnerCompanyId(ownerId);

    const [vehicles, jobStats, statusBreakdownRows] = await Promise.all([
      VehicleRepository.findAllByCompany(companyId),
      JobRepository.getCompletedJobStatsByVehicle(companyId, range.startDate, range.endDate),
      VehicleRepository.getStatusBreakdownByCompany(companyId),
    ]);

    const statsByVehicleId = new Map(jobStats.map((s) => [s._id.toString(), s]));
    const statusBreakdown = Object.fromEntries(statusBreakdownRows.map((row) => [row._id, row.count]));

    return {
      totalVehicles: vehicles.length,
      statusBreakdown,
      vehicles: vehicles.map((vehicle) => ({
        vehicleId: vehicle._id,
        vehicleCode: vehicle.vehicleCode,
        completedJobsCount: statsByVehicleId.get(vehicle._id!.toString())?.completedJobsCount ?? 0,
      })),
    };
  },
};
