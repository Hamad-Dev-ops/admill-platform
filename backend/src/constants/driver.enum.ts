export enum DriverStatus {
  AVAILABLE = "AVAILABLE",

  ON_JOB = "ON_JOB",

  OFFLINE = "OFFLINE",

  ON_BREAK = "ON_BREAK",

  ON_LEAVE = "ON_LEAVE",

  SUSPENDED = "SUSPENDED",
}

// Onboarding-approval state — distinct from DriverStatus (operational availability).
// A driver can be PENDING_APPROVAL while their `status` field is meaningless/OFFLINE;
// these are two different concerns and mixing them into one enum would be confusing.
export enum DriverApprovalStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",

  APPROVED = "APPROVED",

  REJECTED = "REJECTED",
}