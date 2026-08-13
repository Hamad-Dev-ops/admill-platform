import "socket.io";
import { UserRole } from "../constants/role.enum";

// §17: every socket authenticates once at handshake (config/socket.ts) and carries the
// same { id, role } shape as Express's req.user (types/express.d.ts) for every event
// handler downstream — never re-verified per event.
declare module "socket.io" {
  interface Socket {
    user: {
      id: string;
      role: UserRole;
    };
  }
}

export {};
