import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeFaro } from '@grafana/faro-web-sdk';
import { App } from './App';
import './style.scss'

// initializeFaro({
//   // Mandatory, the URL of the Grafana Cloud collector with embedded application key.
//   // Copy from the configuration page of your application in Grafana.
//   url: "http://faro-collector-us-central-0.grafana.net/collect/{app-key}",
//   app: {
//     name: "elliotkirk",
//     version: "1.0.0",
//   },
// });

// Create a root.
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Initial render
root.render(<App />);