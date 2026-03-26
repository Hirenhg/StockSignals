import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider, Helmet } from 'react-helmet-async';
import Layout from './components/Layout/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SkeletonCards, SkeletonTable } from './components/Skeleton/Skeleton';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const EquityTool = lazy(() => import('./pages/EquityTool/EquityTool'));
const Options = lazy(() => import('./pages/Options/Options'));
const OptionChain = lazy(() => import('./pages/OptionChain/OptionChain'));
const Sectors = lazy(() => import('./pages/Sectors/Sectors'));
const News = lazy(() => import('./pages/News/News'));
const SectorPE = lazy(() => import('./pages/SectorPE/SectorPE'));
const PEGRatio = lazy(() => import('./pages/PEGRatio/PEGRatio'));
const Portfolio = lazy(() => import('./pages/Portfolio/Portfolio'));
const ChartPage = lazy(() => import('./pages/Chart/ChartPage'));
const Tracker = lazy(() => import('./pages/Tracker/Tracker'));
const PaperTrade = lazy(() => import('./pages/PaperTrade/PaperTrade'));
const Login = lazy(() => import('./pages/Login/Login'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));

const LoadingSpinner = () => (
  <div className="p-1">
    <SkeletonCards count={3} />
    <SkeletonTable rows={6} cols={10} />
  </div>
);

const Protected = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Layout>
      {({ assetTab, setAssetTab }) => (
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route index element={<Protected><Dashboard assetTab={assetTab} setAssetTab={setAssetTab} /></Protected>} />
            <Route path="/equity" element={<Protected><EquityTool /></Protected>} />
            <Route path="/options" element={<Protected><Options /></Protected>} />
            <Route path="/optionchain" element={<Protected><OptionChain /></Protected>} />
            <Route path="/sectors" element={<Sectors />} />
            <Route path="/news" element={<News />} />
            <Route path="/sector-pe" element={<SectorPE />} />
            <Route path="/peg" element={<Protected><PEGRatio /></Protected>} />
            <Route path="/portfolio" element={<Protected><Portfolio /></Protected>} />
            <Route path="/chart/:symbol" element={<Protected><ChartPage /></Protected>} />
            <Route path="/tracker" element={<Protected><Tracker /></Protected>} />
            <Route path="/paper-trade" element={<Protected><PaperTrade /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      )}
    </Layout>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>StockSignal - Trading Dashboard</title>
        <meta name="description" content="Real-time stock trading signals with RSI, EMA indicators, option chain, sector indices and market news" />
      </Helmet>
      <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
      </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
