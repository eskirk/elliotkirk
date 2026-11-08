import React from 'react';
import ReactDOM from 'react-dom/client';
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { ReactIntegration } from '@grafana/faro-react';
import { App } from './App';
import './style.scss';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

// Faro config is injected at build time via webpack's DefinePlugin
// (see webpack.config.js). These are replaced with literal values at build
// time, so `process` does not exist at runtime in the browser bundle.
// Defaults keep today's behaviour (dev collector); set FARO_COLLECTOR_URL /
// FARO_ENVIRONMENT in CI to target a production collector.
initializeFaro({
  url: process.env.FARO_COLLECTOR_URL,
  app: {
    name: 'elliotkirk',
    version: process.env.FARO_APP_VERSION,
    environment: process.env.FARO_ENVIRONMENT,
  },

  // Opt into remote configuration (remote session sampling rate). The config
  // endpoint is derived from the collector URL (/collect/{key} -> /config/{key}).
  remoteConfig: {},

  instrumentations: [
    // Mandatory, omits default instrumentations otherwise.
    ...getWebInstrumentations({ captureConsole: true }),
    new ReactIntegration(),
    // Tracing package for end-to-end visibility on HTTP requests.
    new TracingInstrumentation(),
  ],
  experimental: {
    trackNavigation: true,
  },
});

// Create a root.
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Initial render
root.render(<App />);
