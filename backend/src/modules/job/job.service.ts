import { Types } from "mongoose";
import { DriverApprovalStatus, DriverStatus } from "../../constants/driver.enum";
import { JobStatus } from "../../constants/job.enum";
import { NotificationType } from "../../constants/notification.enum";
import { UserRole } from "../../constants/role.enum";
import { VehicleStatus } from "../../constants/vehicle.enum";
import { AppError } from "../../errors/AppError";
import { IJob } from "../../interfaces/job.interface";
import { CompanyRepository } from "../../repositories/company.repository";
import { CompanySettingsRepository } from "../../repositories/companySettings.repository";
import { CounterRepository } from "../../repositories/counter.repository";
import { CustomerRepository } from "../../repositories/customer.repository";
import { DriverRepository } from "../../repositories/driver.repository";
import { FareCalculationRepository } from "../../repositories/fareCalculation.repository";
import { JobRepository } from "../../repositories/job.repository";
import { JobStatusHistoryRepository } from "../../repositories/jobStatusHistory.repository";
import { VehicleRepository } from "../../repositories/vehicle.repository";
import { emitJobAccepted, emitJobNewRequest, emitJobStatusChanged } from "../../socket/job.socket";
import { generateBusinessId } from "../../utils/schema/generateBusinessId";
import { NotificationService } from "../notification/notification.service";
import { PricingService } from "../pricing/pricing.service";
import { JobStateMachine } from "./job.state-machine";
import { CreateJobInput, UpdateJobStatusInput } from "./job.validator";

// No CompanySettings record ever fails a job creation — a sane fallback keeps dispatch
// working even for a company that never configured a radius.
const DEFAULT_DISPATCH_RADIUS_KM = 15;

// A PENDING job with no driver action past this window is lazily flipped to EXPIRED.
const JOB_EXPIRY_MINUTES = 10;

// Milestone 8 — status transitions this milestone's testing checklist scope actually
// covers ("a job-status change triggers the correct notification type"). EN_ROUTE has
// no matching NotificationType and is intentionally not notified (see PROGRESS.md);
// CANCELLED is handled separately in notifyJobStatusChange since its recipient
// depends on who cancelled, not a fixed status→type mapping.
const JOB_STATUS_NOTIFICATION_TYPE: Partial<Record<JobStatus, NotificationType>> = {
  [JobStatus.ARRIVED]: NotificationType.DRIVER_ARRIVED,
  [JobStatus.STARTED]: NotificationType.JOB_STARTED,
  [JobStatus.COMPLETED]: NotificationType.JOB_COMPLETED,
};

async function releaseDriverAndVehicle(driverId: Types.ObjectId, vehicleId?: Types.ObjectId): Promise<void> {
  await DriverRepository.updateById(driverId, { status: DriverStatus.AVAILABLE });

  if (vehicleId) {
    await VehicleRepository.updateById(vehicleId, { currentStatus: VehicleStatus.AVAILABLE });
  }
}

// ARRIVED/STARTED/COMPLETED are always driver-initiated (assertStatusChangeAllowed
// enforces this), so the customer is always the recipient. CANCELLED can come from
// either side (M6's Cancellation Policy) — notify whichever party didn't cause it.
async function notifyJobStatusChange(job: IJob, newStatus: JobStatus, requesterRole: UserRole): Promise<void> {
  if (newStatus === JobStatus.CANCELLED) {
    if (requesterRole === UserRole.CUSTOMER && job.driverId) {
      const driver = await DriverRepository.findById(job.driverId);
      if (driver) {
        await NotificationService.notify(driver.userId, NotificationType.JOB_CANCELLED, {
          title: "Job cancelled",
          message: `Job ${job.jobNumber} was cancelled by the customer.`,
        });
      }
      return;
    }

    const customer = await CustomerRepository.findById(job.customerId);
    if (customer) {
      await NotificationService.notify(customer.userId, NotificationType.JOB_CANCELLED, {
        title: "Job cancelled",
        message: `Job ${job.jobNumber} was cancelled.`,
      });
    }
    return;
  }

  const notificationType = JOB_STATUS_NOTIFICATION_TYPE[newStatus];
  if (!notificationType) {
    return;
  }

  const customer = await CustomerRepository.findById(job.customerId);
  if (customer) {
    await NotificationService.notify(customer.userId, notificationType, {
      title: "Job update",
      message: `Job ${job.jobNumber} is now ${newStatus}.`,
    });
  }
}

// Gap #14 resolution (GAP-REPORT.md): the Customer booking API has no
// company concept at all — a Customer has no legitimate way to obtain a
// companyId (no company-discovery endpoint exists anywhere, and the public
// GET /companies/lookup/:companyCode deliberately never returns _id), and
// the product design never shows one. This platform runs a single
// operational company today, identified by its companyCode via
// DEFAULT_COMPANY_CODE.
//
// Deliberately reads process.env directly here rather than through the
// validated `env` singleton in config/env.ts (the codebase's normal
// pattern for all other configuration) — investigated and confirmed
// necessary: env.ts's `loadEnv()` runs once, at first import, and freezes
// its result. The integration test suite (job/analytics/hardening/
// notification/rating/tracking.test.ts) each create their own company
// per test run and only learn its generated companyCode *after* app/env
// are already loaded — a frozen-at-boot value could never reflect that.
// Reading process.env fresh per-request is what lets tests point this at
// their own dynamically-created company (see tests/setup/defaultCompany.ts)
// without restructuring how the suite works, and incidentally lets the
// operational company be reconfigured without a server restart.
//
// This is a deliberate single-operational-company simplification, not a
// stand-in for real multi-company support — see GAP-REPORT.md gap #14 for
// what a future geo-based multi-company dispatch model would require.
async function resolveOperationalCompany() {
  const companyCode = process.env.DEFAULT_COMPANY_CODE;
  if (!companyCode) {
    throw new AppError(500, "Booking is temporarily unavailable — no operational company is configured");
  }

  const company = await CompanyRepository.findByCompanyCode(companyCode);
  if (!company) {
    throw new AppError(500, "Booking is temporarily unavailable — the configured operational company was not found");
  }

  return company;
}

export const JobService = {
  async create(customerUserId: string, input: CreateJobInput) {
    const customer = await CustomerRepository.findByUserId(customerUserId);
    if (!customer) {
      throw new AppError(404, "Customer profile not found");
    }

    const company = await resolveOperationalCompany();

    const breakdown = await PricingService.calculateFare(
      input.serviceType,
      input.pickupLocation.geo,
      input.destinationLocation.geo
    );

    // Nearby drivers are resolved before the job exists so the offer set can be
    // snapshotted into the same insert — only a driver in this list may later accept
    // (see accept()); a driver who comes online nearby afterward is not retroactively added.
    const settings = await CompanySettingsRepository.findByCompanyId(company._id!);
    const radiusKm = settings?.defaultServiceRadiusKm ?? DEFAULT_DISPATCH_RADIUS_KM;
    const nearbyDrivers = await DriverRepository.findNearbyAvailable(company._id!, input.pickupLocation.geo, radiusKm);

    // Per-day sequence (the counter name embeds the date), matching the JOB-YYYYMMDD-NNNNNN
    // format — a fresh 000001 each day, not an ever-growing global sequence.
    const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const sequence = await CounterRepository.incrementAndGet(`job-${dateKey}`);
    const jobNumber = generateBusinessId("JOB", sequence, true);

    const job = await JobRepository.create({
      jobNumber,
      companyId: company._id!,
      customerId: customer._id!,
      offeredDriverIds: nearbyDrivers.map((d) => d._id!),
      serviceType: input.serviceType,
      status: JobStatus.PENDING,
      pickupLocation: input.pickupLocation,
      destinationLocation: input.destinationLocation,
      distanceKm: breakdown.distanceKm,
      durationMinutes: breakdown.durationMinutes,
      estimatedFare: breakdown.total,
      expiresAt: new Date(Date.now() + JOB_EXPIRY_MINUTES * 60_000),
    });

    await FareCalculationRepository.create({
      jobId: job._id!,
      serviceType: input.serviceType,
      distanceKm: breakdown.distanceKm,
      durationMinutes: breakdown.durationMinutes,
      factors: breakdown.factors,
      total: breakdown.total,
    });

    await JobStatusHistoryRepository.create(job._id!, JobStatus.PENDING, new Types.ObjectId(customerUserId));

    if (nearbyDrivers.length > 0) {
      emitJobNewRequest(company._id!, job);

      await Promise.all(
        nearbyDrivers.map((driver) =>
          NotificationService.notify(driver.userId, NotificationType.JOB_REQUEST, {
            title: "New job request",
            message: `A new ${input.serviceType} job is available near you.`,
          })
        )
      );
    }

    return job;
  },

  // Lazy expiration: called before any read/accept/reject touches a PENDING job. A
  // no-op for jobs not PENDING or not yet past expiresAt (expireIfPast's own filter
  // guarantees that), so it's always safe to call unconditionally here.
  async expireIfNeeded<T extends IJob>(job: T): Promise<T> {
    if (job.status !== JobStatus.PENDING) {
      return job;
    }

    const expired = await JobRepository.expireIfPast(job._id!, new Date());
    return (expired as T | null) ?? job;
  },

  async assertJobAccess(requesterId: string, requesterRole: UserRole, job: IJob): Promise<void> {
    if (requesterRole === UserRole.CUSTOMER) {
      const customer = await CustomerRepository.findByUserId(requesterId);
      if (customer?._id?.equals(job.customerId)) return;
    } else if (requesterRole === UserRole.DRIVER) {
      const driver = await DriverRepository.findByUserId(requesterId);
      if (driver?._id && job.driverId && driver._id.equals(job.driverId)) return;
    } else if (requesterRole === UserRole.OWNER) {
      const company = await CompanyRepository.findByOwnerId(requesterId);
      if (company?._id?.equals(job.companyId)) return;
    }

    throw new AppError(403, "You do not have permission to access this job");
  },

  async getById(requesterId: string, requesterRole: UserRole, jobId: string) {
    const job = await JobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, "Job not found");
    }

    await this.assertJobAccess(requesterId, requesterRole, job);
    return this.expireIfNeeded(job);
  },

  async accept(driverUserId: string, jobId: string) {
    let job = await JobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, "Job not found");
    }

    const driver = await DriverRepository.findByUserId(driverUserId);
    if (!driver) {
      throw new AppError(404, "Driver profile not found");
    }

    if (!driver.companyId.equals(job.companyId)) {
      throw new AppError(403, "This job does not belong to your company");
    }

    if (driver.approvalStatus !== DriverApprovalStatus.APPROVED) {
      throw new AppError(403, "Driver is not approved to accept jobs");
    }

    if (driver.status !== DriverStatus.AVAILABLE) {
      throw new AppError(409, "You must be AVAILABLE to accept a job");
    }

    if (!job.offeredDriverIds.some((id) => id.equals(driver._id!))) {
      throw new AppError(403, "This job was not offered to you");
    }

    job = await this.expireIfNeeded(job);
    if (job.status === JobStatus.EXPIRED) {
      throw new AppError(410, "This job has expired");
    }

    const vehicle = await VehicleRepository.findByAssignedDriver(driver._id!);

    // Atomic: the filter re-checks status: PENDING inside the same findOneAndUpdate, so
    // of two simultaneous accept calls only one can match and return a document — the
    // loser gets null, never a duplicate/partial accept (M6's concurrent-accept test).
    const accepted = await JobRepository.acceptIfPending(jobId, driver._id!, vehicle?._id, new Date());

    if (!accepted) {
      throw new AppError(409, "This job has already been accepted by another driver");
    }

    await JobStatusHistoryRepository.create(accepted._id!, JobStatus.ACCEPTED, new Types.ObjectId(driverUserId));
    await DriverRepository.updateById(driver._id!, { status: DriverStatus.ON_JOB });

    if (vehicle) {
      await VehicleRepository.updateById(vehicle._id!, { currentStatus: VehicleStatus.ON_RECOVERY });
    }

    emitJobAccepted(accepted);

    const customer = await CustomerRepository.findById(accepted.customerId);
    if (customer) {
      await NotificationService.notify(customer.userId, NotificationType.JOB_ACCEPTED, {
        title: "Driver assigned",
        message: `A driver has accepted your job ${accepted.jobNumber}.`,
      });
    }

    return accepted;
  },

  async reject(driverUserId: string, jobId: string) {
    const job = await JobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, "Job not found");
    }

    const driver = await DriverRepository.findByUserId(driverUserId);
    if (!driver) {
      throw new AppError(404, "Driver profile not found");
    }

    if (!driver.companyId.equals(job.companyId)) {
      throw new AppError(403, "This job does not belong to your company");
    }

    if (!job.offeredDriverIds.some((id) => id.equals(driver._id!))) {
      throw new AppError(403, "This job was not offered to you");
    }

    if (job.status !== JobStatus.PENDING) {
      throw new AppError(409, "This job is no longer pending — it cannot be declined");
    }

    // No persistent per-driver offer list in V1 — the job itself stays PENDING for
    // other drivers; declining is only recorded in history, not a status change.
    await JobStatusHistoryRepository.create(
      job._id!,
      JobStatus.PENDING,
      new Types.ObjectId(driverUserId),
      "Driver declined this job"
    );

    return job;
  },

  // Cancellation Policy (defined here, not in the frozen doc — see PROGRESS.md
  // Milestone 6 for the record of that): whoever can *view* the job can *cancel* it —
  // the job's own Customer, its assigned Driver (only once one exists — an
  // unassigned/PENDING job has no Driver, so only Customer/Owner can cancel it then),
  // or the owning Company's Owner. Reuses assertJobAccess rather than a separate rule.
  // Allowed from any non-terminal state (JobStateMachine.assertCanTransition still
  // rejects it from COMPLETED/CANCELLED/EXPIRED, since those have no outgoing edges).
  async assertStatusChangeAllowed(
    requesterId: string,
    requesterRole: UserRole,
    job: IJob,
    newStatus: JobStatus
  ): Promise<void> {
    if (newStatus === JobStatus.CANCELLED) {
      await this.assertJobAccess(requesterId, requesterRole, job);
      return;
    }

    // Every other transition (EN_ROUTE/ARRIVED/STARTED/COMPLETED) is driver-only — the
    // driver actually performing the job progresses it, not the customer or owner.
    if (requesterRole !== UserRole.DRIVER) {
      throw new AppError(403, "Only the assigned driver can progress this job's status");
    }

    const driver = await DriverRepository.findByUserId(requesterId);
    if (!driver?._id || !job.driverId || !driver._id.equals(job.driverId)) {
      throw new AppError(403, "You are not the driver assigned to this job");
    }
  },

  async updateStatus(requesterId: string, requesterRole: UserRole, jobId: string, input: UpdateJobStatusInput) {
    let job = await JobRepository.findById(jobId);
    if (!job) {
      throw new AppError(404, "Job not found");
    }

    job = await this.expireIfNeeded(job);

    await this.assertStatusChangeAllowed(requesterId, requesterRole, job, input.status);
    JobStateMachine.assertCanTransition(job.status, input.status);

    const extra: Partial<IJob> = {};

    if (input.status === JobStatus.STARTED) {
      extra.startedAt = new Date();
    }

    if (input.status === JobStatus.COMPLETED) {
      extra.completedAt = new Date();
      // No live-tracking distance exists without Milestone 7 — the completion fare is
      // the same estimate computed from the static pickup/destination pair, not a
      // real recompute against an actual traveled route.
      extra.finalFare = job.estimatedFare;
    }

    if (input.status === JobStatus.CANCELLED) {
      extra.cancelledAt = new Date();
      extra.cancellationReason = input.cancellationReason;
    }

    const updated = await JobRepository.updateById(jobId, { status: input.status, ...extra });
    if (!updated) {
      throw new AppError(404, "Job not found");
    }

    await JobStatusHistoryRepository.create(
      updated._id!,
      input.status,
      new Types.ObjectId(requesterId),
      input.cancellationReason
    );

    if ((input.status === JobStatus.COMPLETED || input.status === JobStatus.CANCELLED) && updated.driverId) {
      await releaseDriverAndVehicle(updated.driverId, updated.vehicleId);
    }

    emitJobStatusChanged(updated);
    await notifyJobStatusChange(updated, input.status, requesterRole);

    return updated;
  },

  async listForRequester(
    requesterId: string,
    requesterRole: UserRole,
    filter: { status?: JobStatus },
    pagination: { skip: number; limit: number }
  ) {
    if (requesterRole === UserRole.OWNER) {
      const company = await CompanyRepository.findByOwnerId(requesterId);
      if (!company) throw new AppError(404, "Company not found");
      return JobRepository.findManyByCompany(company._id!, filter, pagination);
    }

    if (requesterRole === UserRole.DRIVER) {
      const driver = await DriverRepository.findByUserId(requesterId);
      if (!driver) throw new AppError(404, "Driver profile not found");
      return JobRepository.findManyByDriver(driver._id!, filter, pagination);
    }

    const customer = await CustomerRepository.findByUserId(requesterId);
    if (!customer) throw new AppError(404, "Customer profile not found");
    return JobRepository.findManyByCustomer(customer._id!, filter, pagination);
  },
};
