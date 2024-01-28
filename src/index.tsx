import React from 'react';
import ReactDOM from 'react-dom/client';
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { App } from './App';
import './style.scss'

initializeFaro({
  url: 'https://faro-collector-prod-us-west-0.grafana.net/collect/7b743fc448d6be8546b6758de7e71ca2',
  app: {
    name: 'elliotkirk',
    version: '1.0.0',
    environment: 'production'
  },

  instrumentations: [
    ...getWebInstrumentations(),
    new TracingInstrumentation(),
  ],
});

// Create a root.
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Initial render
root.render(<App />);