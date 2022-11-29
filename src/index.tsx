import React from 'react';
import * as ReactDOM from 'react-dom';
import { initializeFaro } from '@grafana/faro-web-sdk';
import { App } from './App';
import './style.scss'

initializeFaro({
  // Mandatory, the URL of the Grafana Cloud collector with embedded application key.
  // Copy from the configuration page of your application in Grafana.
  url: "http://faro-collector-us-central-0.grafana.net/collect/{app-key}",
  app: {
    name: "elliotkirk",
    version: "1.0.0",
  },
});

ReactDOM.render(
  <App />,
  document.getElementById('root')
);