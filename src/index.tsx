import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeFaro } from '@grafana/faro-web-sdk';
import { App } from './App';
import './style.scss'

initializeFaro({
  url: 'https://faro-collector-prod-us-central-0.grafana.net/collect/8ebb309a2a2a14a8f3d81a0d9e9d3a9f',
  app: {
    name: 'My first app',
    version: '1.0.0',
    environment: 'production'
  },
});

// Create a root.
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Initial render
root.render(<App />);