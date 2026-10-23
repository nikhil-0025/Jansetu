/**
 * Connection states for Indian Government API services.
 * Implements strict state visibility as required by JanSetu governance.
 */
const CONNECTION_STATES = {
  CONNECTED: 'Connected',
  SANDBOX: 'Sandbox',
  AWAITING_APPROVAL: 'Awaiting Approval',
  UNAVAILABLE: 'Unavailable',
  DEMO_MODE: 'Demo Mode'
};

const STATE_DESCRIPTIONS = {
  [CONNECTION_STATES.CONNECTED]: 'Production credentials active and authorized. Connecting to live government service endpoints.',
  [CONNECTION_STATES.SANDBOX]: 'Sandbox/testing credentials active. Interacting with official test/staging environment.',
  [CONNECTION_STATES.AWAITING_APPROVAL]: 'Credentials registered or use-case submitted on API Setu / Partner Portal; awaiting department authorization.',
  [CONNECTION_STATES.UNAVAILABLE]: 'Service endpoint unreachable, network timeout, rate-limited, or upstream outage.',
  [CONNECTION_STATES.DEMO_MODE]: 'No government credentials configured. Operating with high-fidelity, clearly-labeled simulated mock adapter.'
};

module.exports = {
  CONNECTION_STATES,
  STATE_DESCRIPTIONS
};
