import ReactDOM from 'react-dom/client';
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { ReactIntegration } from '@grafana/faro-react';
import { App } from './App';
import './style.scss'
import { TracingInstrumentation } from '@grafana/faro-web-tracing';

initializeFaro({
  url: 'https://faro-collector-dev-us-central-0.grafana-dev.net/collect/2cc4b89fb2f942929562684139620993',
  app: {
    name: 'elliotkirk',
    version: '1.0.0',
    environment: 'production'
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