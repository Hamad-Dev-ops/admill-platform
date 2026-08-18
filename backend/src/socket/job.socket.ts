import { Types } from "mongoose";
import { Socket } from "socket.io";
import { UserRole } from "../constants/role.enum";
import { getIO } from "../config/socket";
import { IJob } from "../interfaces/job.interface";
import { CompanyRepository } from "../repositories/company.repository";
import { CustomerRepository } from "../repositories/customer.repository";
import { DriverRepository } from "../repositories/driver.repository";
import { JobRepository } from "../repositories/job.repository";
import { Checkpoint, logCheckpoint } from "../utils/checkpoint";

// Best-effort, same principle NotificationService (M8) will use: a socket emit failing
// (e.g. no connected clients) must never fail the REST request that triggered it.
// Exported so tracking.socket.ts (Milestone 7) reuses this instead of a second copy.
export function safeEmit(fn: () => void): void {
  try {
    fn();
  } catch {
    // intentionally swallowed — see comment above
  }
}

export function emitJobNewRequest(companyId: Types.ObjectId, job: IJob): void {
  safeEmit(() => {
    getIO().to(`company:${companyId.toString()}:fleet`).emit("job:new-request", job);
  });
}

export function emitJobAccepted(job: IJob): void {
  safeEmit(() => {
    getIO().to(`job:${job._id?.toString()}`).emit("job:accepted", job);
  });
}

export function emitJobStatusChanged(job: IJob): void {
  safeEmit(() => {
    getIO().to(`job:${job._id?.toString()}`).emit("job:status-changed", job);
  });
}

// Client-initiated: after creating a job (customer) or accepting one (driver), the
// client asks to receive that job's live events. Verified against the real job record
// so a socket can only subscribe to a job it actually has a relationship to.
export function registerJobSocketHandlers(socket: Socket): void {
  socket.on("job:subscribe", async (jobId: string) => {
    try {
      const job = await JobRepository.findById(jobId);
      if (!job) {
        logCheckpoint(
          Checkpoint.SOCKET_JOB_SUBSCRIBE_REJECT,
          { socketId: socket.id, userId: socket.user.id, role: socket.user.role, jobId, reason: "job_not_found" },
          "warn"
        );
        return;
      }

      const { user } = socket;
      let allowed = false;

      if (user.role === UserRole.CUSTOMER) {
        const customer = await CustomerRepository.findByUserId(user.id);
        allowed = Boolean(customer?._id?.equals(job.customerId));
      } else if (user.role === UserRole.DRIVER) {
        const driver = await DriverRepository.findByUserId(user.id);
        allowed = Boolean(driver?._id && job.driverId && driver._id.equals(job.driverId));
      } else if (user.role === UserRole.OWNER) {
        const company = await CompanyRepository.findByOwnerId(user.id);
        allowed = Boolean(company?._id?.equals(job.companyId));
      }

      if (allowed) {
        socket.join(`job:${jobId}`);
        socket.emit("job:subscribed", jobId);
        logCheckpoint(Checkpoint.SOCKET_JOB_SUBSCRIBE, {
          socketId: socket.id,
          userId: user.id,
          role: user.role,
          jobId,
          jobStatus: job.status,
        });
      } else {
        logCheckpoint(
          Checkpoint.SOCKET_JOB_SUBSCRIBE_REJECT,
          {
            socketId: socket.id,
            userId: user.id,
            role: user.role,
            jobId,
            reason: "not_authorized",
            jobStatus: job.status,
          },
          "warn"
        );
      }
    } catch (err) {
      logCheckpoint(
        Checkpoint.SOCKET_JOB_SUBSCRIBE_REJECT,
        { socketId: socket.id, userId: socket.user.id, role: socket.user.role, jobId, reason: "handler_error", err },
        "warn"
      );
    }
  });
}
