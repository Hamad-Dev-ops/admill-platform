export enum JobStatus {
  PENDING = "PENDING", // Job created by customer, awaiting driver acceptance
  ACCEPTED = "ACCEPTED", // A driver has accepted the job
  EN_ROUTE = "EN_ROUTE", // Driver is on the way to the pickup location
  ARRIVED = "ARRIVED", // Driver has arrived at the pickup location
  STARTED = "STARTED", // The service has begun (e.g., vehicle is being towed)
  COMPLETED = "COMPLETED", // The job is finished
  CANCELLED = "CANCELLED", // The job has been cancelled
  EXPIRED = "EXPIRED", // No driver accepted before expiresAt — system-set, never a manual target
}
