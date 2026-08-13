export enum DocumentOwnerType {
  DRIVER = "DRIVER",

  VEHICLE = "VEHICLE",

  COMPANY = "COMPANY",
}

// Not all types are mandatory for every owner yet — the taxonomy is built out ahead of
// enforcement so the model supports future growth without a schema change later.
export enum DocumentType {
  EMIRATES_ID = "EMIRATES_ID",

  DRIVING_LICENSE = "DRIVING_LICENSE",

  PASSPORT = "PASSPORT",

  PROFILE_PHOTO = "PROFILE_PHOTO",

  VEHICLE_REGISTRATION = "VEHICLE_REGISTRATION",

  INSURANCE_CERTIFICATE = "INSURANCE_CERTIFICATE",

  ROAD_PERMIT = "ROAD_PERMIT",

  COMPANY_LICENSE = "COMPANY_LICENSE",
}

export enum DocumentVerificationStatus {
  PENDING = "PENDING",

  VERIFIED = "VERIFIED",

  REJECTED = "REJECTED",
}
