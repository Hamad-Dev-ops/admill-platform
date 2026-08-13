import type { ServiceType } from '../../types/enums';

// Design's own "Developer handoff" notes (section 07): "CUSTOMER · 4 TABS:
// Home (map-first) · Trips · Chat · Profile." Chat is omitted here — no
// backend messaging system exists at all (frontend-docs/GAP-REPORT.md gap
// #2) — leaving 3 real tabs. "The request flow is a modal stack over Home,
// never a tab" is honored below via the modal Stack.Group in
// CustomerNavigator, not a 4th tab.
export type CustomerTabParamList = {
  Home: undefined;
  Trips: undefined;
  Profile: undefined;
};

// Mirrors DriverStackParamList's shape (src/navigation/driver/types.ts) —
// one stack hosting the tab navigator plus every screen that needs to be
// pushed regardless of which tab is active.
//
// JobDetail intentionally covers active-job tracking (4.8), history detail
// (4.9), and post-completion rating (4.10) in one screen rather than three —
// it already conditionally renders on job.status the same way Driver's
// DriverJobDetailScreen conditionally renders its progression/cancel
// controls. This avoids screen-proliferation for what is fundamentally one
// "view this job" surface (per the Phase 4 approval's instruction #5).
//
// FareEstimate carries serviceType from ServiceSelection; the "4.6 job
// creation" mutation lives inside FareEstimateScreen itself (its Request
// Recovery button), not as a separate route — same instruction #5.
export type CustomerStackParamList = {
  CustomerTabs: undefined;
  ServiceSelection: undefined;
  FareEstimate: { serviceType: ServiceType };
  FindingDriver: { jobId: string };
  JobDetail: { jobId: string };
  Notifications: undefined;
  EditProfile: undefined;
};
