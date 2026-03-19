import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HelmetProvider, Helmet } from 'react-helmet-async';
import Layout from './components/Layout/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { SkeletonTable, SkeletonCards } from './components/Skeleton/Skeleton';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const EquityTool = lazy(() => import('./pages/EquityTool/EquityTool'));
const Options = lazy(() => import('./pages/Options/Options'));
const OptionChain = lazy(() => import('./pages/OptionChain/OptionChain'));
const Sectors = lazy(() => import('./pages/Sectors/Sectors'));
const News = lazy(() => import('./pages/News/News'));
const ChartPage = lazy(() => import('./pages/Chart/ChartPage'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));

const LoadingSpinner = () => (
  <div className="p-1">
    <SkeletonCards count={3} />
    <SkeletonTable rows={6} cols={10} />
  </div>
);

function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>StockSignal - Trading Dashboard</title>
        <meta name="description" content="Real-time stock trading signals with RSI, EMA indicators, option chain, sector indices and market news" />
      </Helmet>
      <ThemeProvider>
      <LanguageProvider>
      <Router>
        <Layout>
          {({ assetTab, setAssetTab }) => (
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route index element={<Dashboard assetTab={assetTab} setAssetTab={setAssetTab} />} />
                <Route path="/equity" element={<EquityTool />} />
                <Route path="/options" element={<Options />} />
                <Route path="/optionchain" element={<OptionChain />} />
                <Route path="/sectors" element={<Sectors />} />
                <Route path="/news" element={<News />} />
                <Route path="/chart/:symbol" element={<ChartPage />} />
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
