// DeviceToken.platform (Milestone 8) — metadata only, not branched on by the push
// provider (FCM sends by token regardless of platform); kept for the same "not
// currently used everywhere but the model needs it" reason other stored-only fields
// exist elsewhere in this codebase.
export enum DevicePlatform {
  IOS = "IOS",
  ANDROID = "ANDROID",
  WEB = "WEB",
}
