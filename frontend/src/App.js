import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Options = lazy(() => import('./pages/Options/Options'));
const OptionChain = lazy(() => import('./pages/OptionChain/OptionChain'));
const Sectors = lazy(() => import('./pages/Sectors/Sectors'));
const News = lazy(() => import('./pages/News/News'));
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
      <ThemeProvider>
      <LanguageProvider>
      <Router>
        <Layout>
          {({ assetTab, setAssetTab }) => (
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route index element={<Dashboard assetTab={assetTab} setAssetTab={setAssetTab} />} />
                <Route path="/options" element={<Options />} />
                <Route path="/optionchain" element={<OptionChain />} />
                <Route path="/sectors" element={<Sectors />} />
                <Route path="/news" element={<News />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          )}
        </Layout>
      </Router>
      </LanguageProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
