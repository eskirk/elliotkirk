import ReactDOM from 'react-dom/client';
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { App } from './App';
import './style.scss'
import { FetchInstrumentation } from '@grafana/faro-instrumentation-fetch';

initializeFaro({
  url: 'https://faro-collector-prod-us-central-0.grafana.net/collect/4b52c3dc56ceebc30064a60bd8da6ccc',
  app: {
    name: 'elliotkirk',
    version: '1.0.0',
    environment: 'production'
  },

  instrumentations: [
    ...getWebInstrumentations(),
    new FetchInstrumentation(),
  ],
});

// Create a root.
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// Initial render
root.render(<App />);