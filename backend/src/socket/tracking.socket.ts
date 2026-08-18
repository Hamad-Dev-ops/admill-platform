import { Socket } from "socket.io";
import { UserRole } from "../constants/role.enum";
import { getIO } from "../config/socket";
import { TrackingService } from "../modules/tracking/tracking.service";
import { Checkpoint, locationSnapshot, logCheckpoint } from "../utils/checkpoint";
import { driverPositionUpdateSchema } from "../utils/geo";
import { safeEmit } from "./job.socket";

// Driver-initiated GPS ping. Identity is always socket.user.id (verified once at
// handshake, config/socket.ts) — the payload is never trusted for who the driver is,
// only for where they are. Rejected pings are logged at warn so QA can see why
// location silently stopped (previously swallowed with no trace).
export function registerTrackingSocketHandlers(socket: Socket): void {
  socket.on("driver:location:update", async (payload: unknown) => {
    try {
      if (socket.user.role !== UserRole.DRIVER) {
        logCheckpoint(
          Checkpoint.TRACKING_LOCATION_REJECT,
          {
            socketId: socket.id,
            userId: socket.user.id,
            role: socket.user.role,
            reason: "not_a_driver",
          },
          "warn"
        );
        return;
      }

      const parsed = driverPositionUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        logCheckpoint(
          Checkpoint.TRACKING_LOCATION_REJECT,
          {
            socketId: socket.id,
            userId: socket.user.id,
            reason: "validation_failed",
            issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
          "warn"
        );
        return;
      }

      const { location, speed, heading, accuracy, timestamp } = parsed.data;

      logCheckpoint(
        Checkpoint.TRACKING_LOCATION_RECEIVED,
        {
          socketId: socket.id,
          userId: socket.user.id,
          transport: "socket",
          ...locationSnapshot(location.coordinates),
          accuracy,
          speed,
          heading,
        },
        "debug"
      );

      // Single shared business path (Milestone 7 decision) — REST's
      // PATCH /drivers/me/location calls this same TrackingService.updateLocation.
      const result = await TrackingService.updateLocation(socket.user.id, location, {
        speed,
        heading,
        accuracy,
        timestamp,
      });

      const changedPayload = {
        driverId: result.driver._id!.toString(),
        jobId: result.activeJobId?.toString(),
        location: result.driver.currentLocation,
        speed,
        heading,
        accuracy,
        timestamp: (timestamp ?? new Date()).toISOString(),
      };

      safeEmit(() => {
        if (result.activeJobId) {
          getIO().to(`job:${result.activeJobId.toString()}`).emit("driver:location:changed", changedPayload);
        }

        getIO().to(`company:${result.driver.companyId.toString()}:fleet`).emit("driver:location:changed", changedPayload);
      });
    } catch (err) {
      logCheckpoint(
        Checkpoint.TRACKING_LOCATION_REJECT,
        {
          socketId: socket.id,
          userId: socket.user.id,
          reason: "handler_error",
          err,
        },
        "warn"
      );
    }
  });
}
