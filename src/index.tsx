import React from 'react';
import ReactDOM from 'react-dom/client';
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { App } from './App';
import './style.scss'

initializeFaro({
  url: 'https://faro-collector-ops-us-east-0.grafana-ops.net/collect/53a38142e55b4beec237143a2140ca51',
  app: {
    name: 'eskirk.github.io',
    version: '1.0.0',
    environment: 'production'
  },
  instrumentations: [
    // Mandatory, overwriting the instrumentations array would cause the default instrumentations to be omitted
    ...getWebInstrumentations(),
    // Mandatory, initialization of the tracing package
    new TracingInstrumentation(),
  ],
});

// Create a root.
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Initial render
root.render(<App />);