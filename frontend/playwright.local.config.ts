import base from './playwright.config';

// Local override for running against an already-running server.
export default {
  ...base,
  webServer: undefined,
  use: {
    ...(base.use || {}),
    serviceWorkers: 'allow',
  },
};
