export type DriverTabParamList = {
  Dashboard: undefined;
  Jobs: undefined;
  Earnings: undefined;
  Profile: undefined;
};

// The outer stack — hosts the tab navigator plus every screen that needs to
// be pushed regardless of which tab is active. Mirrors OwnerStackParamList's
// shape (src/navigation/owner/types.ts) for consistency across roles.
export type DriverStackParamList = {
  DriverTabs: undefined;
  JobDetail: { jobId: string };
  Notifications: undefined;
  Vehicle: undefined;
  Documents: undefined;
  EditProfile: undefined;
};
