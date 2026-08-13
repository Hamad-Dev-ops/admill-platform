import { Socket } from "socket.io";
import { UserRole } from "../constants/role.enum";
import { getIO } from "../config/socket";
import { CompanyRepository } from "../repositories/company.repository";
import { DriverRepository } from "../repositories/driver.repository";
import { logger } from "../utils/logger";
import { registerJobSocketHandlers } from "./job.socket";
import { registerTrackingSocketHandlers } from "./tracking.socket";

// §17: on connect, every socket joins its own private room plus, for drivers/owners,
// their company's fleet room — this is what lets job.socket.ts broadcast to "all of
// company X's drivers" or "this one user" without re-querying who's connected.
export function registerSocketHandlers(): void {
  const io = getIO();

  io.on("connection", (socket: Socket) => {
    const { user } = socket;

    socket.join(`user:${user.id}`);
    registerJobSocketHandlers(socket);
    registerTrackingSocketHandlers(socket);

    void joinCompanyFleetRoom(socket);

    socket.on("disconnect", () => {
      logger.debug({ userId: user.id }, "Socket disconnected");
    });
  });
}

async function joinCompanyFleetRoom(socket: Socket): Promise<void> {
  const { user } = socket;

  try {
    if (user.role === UserRole.DRIVER) {
      const driver = await DriverRepository.findByUserId(user.id);
      if (driver) {
        socket.join(`company:${driver.companyId.toString()}:fleet`);
      }
    } else if (user.role === UserRole.OWNER) {
      const company = await CompanyRepository.findByOwnerId(user.id);
      if (company?._id) {
        socket.join(`company:${company._id.toString()}:fleet`);
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to join company fleet room on socket connect");
  }
}
