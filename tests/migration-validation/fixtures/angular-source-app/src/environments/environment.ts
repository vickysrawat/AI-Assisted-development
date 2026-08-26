// Production environment configuration.
// The value of `autoApproveShortLeave` is toggled per-deployment by the CI pipeline,
// so the checked-in value here does NOT necessarily reflect what runs in production.
export const environment = {
  production: true,
  apiBaseUrl: '/api',
  // Feature flag: when true, leave requests of 1 day or fewer are auto-approved
  // without a manager. CI overwrites this at deploy time from a pipeline variable.
  autoApproveShortLeave: false,
  maxLeaveDays: 20,
};
