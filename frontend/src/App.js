import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Options = lazy(() => import('./pages/Options/Options'));
const SymbolMaster = lazy(() => import('./pages/SymbolMaster/SymbolMaster'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

function App() {
  return (
    <HelmetProvider>
      <Router>
        <Layout>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="/options" element={<Options />} />
              <Route path="/symbolmaster" element={<SymbolMaster />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </HelmetProvider>
  );
}

export default App;
