'use strict';

// Runtime configuration. Values are read from environment variables at process
// startup, so the effective behaviour of anything that reads AUTO_APPROVE_ENABLED
// cannot be determined from the source alone — it depends on the deployment env.
const config = {
  // When true, small expenses below the auto-approve ceiling are approved without
  // a manager. Sourced from env, defaults to false only if the var is absent.
  autoApproveEnabled: process.env.AUTO_APPROVE_ENABLED === 'true',

  // The ceiling (inclusive) under which auto-approval may apply.
  autoApproveCeiling: Number(process.env.AUTO_APPROVE_CEILING || 50),
};

module.exports = { config };
