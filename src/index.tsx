import React from 'react';
import ReactDOM from 'react-dom/client';
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { App } from './App';
import './style.scss'

initializeFaro({
  url: 'https://faro-collector-prod-us-central-0.grafana.net/collect/ac63b4f7c1d69de8dc66b6969477d399',
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