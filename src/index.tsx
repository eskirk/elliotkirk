import ReactDOM from 'react-dom/client';
import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk';
import { App } from './App';
import './style.scss'
import { FetchInstrumentation } from '@grafana/faro-instrumentation-fetch';

initializeFaro({
  url: 'https://faro-collector-prod-us-central-0.grafana.net/collect/0d86c69dbcfccb6b5d5761e70d6abd23',
  app: {
    name: 'elliotkirkdev',
    version: '1.0.0',
    environment: 'dev'
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