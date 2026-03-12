import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.scss';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

serviceWorkerRegistration.register();
reportWebVitals();
