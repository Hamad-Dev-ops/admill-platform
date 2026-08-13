export type OwnerTabParamList = {
  Dashboard: undefined;
  Fleet: undefined;
  Jobs: undefined;
  Tracking: undefined;
  More: undefined;
};

// The outer stack — hosts the tab navigator plus every screen that needs to
// be pushed regardless of which tab is active (detail/form screens,
// notifications, analytics, settings). Keeps detail screens defined once
// instead of duplicated per-tab stack.
export type OwnerStackParamList = {
  OwnerTabs: undefined;
  VehicleDetail: { vehicleId: string };
  VehicleForm: { vehicleId?: string };
  DriverDetail: { driverId: string };
  JobDetail: { jobId: string };
  Notifications: undefined;
  Analytics: undefined;
  Settings: undefined;
};
