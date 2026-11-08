// Ambient types for values injected at build time via webpack's DefinePlugin
// (see webpack.config.js). Each referenced member expression is replaced with
// a string literal at build time, so `process` is never evaluated at runtime.
declare const process: {
  env: {
    FARO_COLLECTOR_URL: string;
    FARO_ENVIRONMENT: string;
    FARO_APP_VERSION: string;
  };
};
