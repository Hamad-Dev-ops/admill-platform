import { Socket } from "socket.io";
import { UserRole } from "../constants/role.enum";
import { getIO } from "../config/socket";
import { TrackingService } from "../modules/tracking/tracking.service";
import { driverPositionUpdateSchema } from "../utils/geo";
import { safeEmit } from "./job.socket";

// Driver-initiated GPS ping. Identity is always socket.user.id (verified once at
// handshake, config/socket.ts) — the payload is never trusted for who the driver is,
// only for where they are. A non-driver or malformed payload is dropped silently,
// same best-effort posture as job.socket.ts's job:subscribe handler.
export function registerTrackingSocketHandlers(socket: Socket): void {
  socket.on("driver:location:update", async (payload: unknown) => {
    try {
      if (socket.user.role !== UserRole.DRIVER) {
        return;
      }

      const parsed = driverPositionUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }

      const { location, speed, heading, accuracy, timestamp } = parsed.data;

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
    } catch {
      // Best-effort ingestion — a bad ping or a transient failure must never crash the
      // socket connection; the next ping a few seconds later self-corrects.
    }
  });
}
