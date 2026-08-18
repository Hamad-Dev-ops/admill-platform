import { Socket } from "socket.io";
import { UserRole } from "../constants/role.enum";
import { getIO } from "../config/socket";
import { CompanyRepository } from "../repositories/company.repository";
import { DriverRepository } from "../repositories/driver.repository";
import { Checkpoint, logCheckpoint } from "../utils/checkpoint";
import { registerJobSocketHandlers } from "./job.socket";
import { registerTrackingSocketHandlers } from "./tracking.socket";

// §17: on connect, every socket joins its own private room plus, for drivers/owners,
// their company's fleet room — this is what lets job.socket.ts broadcast to "all of
// company X's drivers" or "this one user" without re-querying who's connected.
export function registerSocketHandlers(): void {
  const io = getIO();

  io.on("connection", async (socket: Socket) => {
    const { user } = socket;

    logCheckpoint(Checkpoint.SOCKET_CONNECT, {
      socketId: socket.id,
      userId: user.id,
      role: user.role,
    });

    await socket.join(`user:${user.id}`);
    registerJobSocketHandlers(socket);
    registerTrackingSocketHandlers(socket);

    socket.on("disconnect", (reason) => {
      logCheckpoint(Checkpoint.SOCKET_DISCONNECT, {
        socketId: socket.id,
        userId: user.id,
        role: user.role,
        reason,
      });
    });

    await joinCompanyFleetRoom(socket);
  });
}

async function joinCompanyFleetRoom(socket: Socket): Promise<void> {
  const { user } = socket;

  try {
    if (user.role === UserRole.DRIVER) {
      const driver = await DriverRepository.findByUserId(user.id);
      if (driver) {
        await socket.join(`company:${driver.companyId.toString()}:fleet`);
        logCheckpoint(Checkpoint.SOCKET_FLEET_JOIN, {
          socketId: socket.id,
          userId: user.id,
          role: user.role,
          companyId: driver.companyId.toString(),
          driverId: driver._id?.toString(),
        });
        socket.emit("fleet:joined", {
          companyId: driver.companyId.toString(),
          driverId: driver._id?.toString(),
        });
      } else {
        logCheckpoint(
          Checkpoint.SOCKET_FLEET_JOIN_FAIL,
          { socketId: socket.id, userId: user.id, role: user.role, reason: "driver_profile_not_found" },
          "warn"
        );
      }
    } else if (user.role === UserRole.OWNER) {
      const company = await CompanyRepository.findByOwnerId(user.id);
      if (company?._id) {
        await socket.join(`company:${company._id.toString()}:fleet`);
        logCheckpoint(Checkpoint.SOCKET_FLEET_JOIN, {
          socketId: socket.id,
          userId: user.id,
          role: user.role,
          companyId: company._id.toString(),
        });
      } else {
        logCheckpoint(
          Checkpoint.SOCKET_FLEET_JOIN_FAIL,
          { socketId: socket.id, userId: user.id, role: user.role, reason: "company_not_found" },
          "warn"
        );
      }
    }
  } catch (err) {
    logCheckpoint(
      Checkpoint.SOCKET_FLEET_JOIN_FAIL,
      { socketId: socket.id, userId: user.id, role: user.role, err },
      "error"
    );
  }
}
