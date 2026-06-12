import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider, Helmet } from 'react-helmet-async';
import Layout from './components/Layout/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SkeletonCards, SkeletonTable, SkeletonLoginBox } from './components/Skeleton/Skeleton';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Options = lazy(() => import('./pages/Options/Options'));
const OptionChain = lazy(() => import('./pages/OptionChain/OptionChain'));
const Sectors = lazy(() => import('./pages/Sectors/Sectors'));
const News = lazy(() => import('./pages/News/News'));
const SectorPE = lazy(() => import('./pages/SectorPE/SectorPE'));
const PEGRatio = lazy(() => import('./pages/PEGRatio/PEGRatio'));
const Portfolio = lazy(() => import('./pages/Portfolio/Portfolio'));
const ChartPage = lazy(() => import('./pages/Chart/ChartPage'));
const Tracker = lazy(() => import('./pages/Tracker/Tracker'));
const MarketDepth = lazy(() => import('./pages/MarketDepth/MarketDepth'));
const Levels = lazy(() => import('./pages/Levels/Levels'));
const Results = lazy(() => import('./pages/Results/Results'));
const HistoryTracker = lazy(() => import('./pages/HistoryTracker/HistoryTracker'));
const IndexLevels = lazy(() => import('./pages/IndexLevels/IndexLevels'));

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
  if (loading) return <SkeletonLoginBox />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
};

const S = ({ login, children }) => (
  <Suspense fallback={login ? <SkeletonLoginBox /> : <LoadingSpinner />}>{children}</Suspense>
)

function AppRoutes() {
  return (
    <Layout>
      {({ assetTab, setAssetTab }) => (
        <Routes>
          <Route path="/login" element={<S login><Login /></S>} />
          <Route index element={<Protected><S><Levels /></S></Protected>} />
          <Route path="/signals" element={<Protected><S><Dashboard assetTab={assetTab} setAssetTab={setAssetTab} /></S></Protected>} />
          <Route path="/market-depth" element={<Protected><S><MarketDepth /></S></Protected>} />
          <Route path="/options" element={<Protected><S><Options /></S></Protected>} />
          <Route path="/optionchain" element={<Protected><S><OptionChain /></S></Protected>} />
          <Route path="/sectors" element={<S><Sectors /></S>} />
          <Route path="/news" element={<S><News /></S>} />
          <Route path="/sector-pe" element={<S><SectorPE /></S>} />
          <Route path="/peg" element={<Protected><S><PEGRatio /></S></Protected>} />
          <Route path="/portfolio" element={<Protected><S><Portfolio /></S></Protected>} />
          <Route path="/chart/:symbol" element={<Protected><S><ChartPage /></S></Protected>} />
          <Route path="/tracker" element={<Protected><S><Tracker /></S></Protected>} />
          <Route path="/results" element={<Protected><S><Results /></S></Protected>} />
          <Route path="/history-tracker" element={<Protected><S><HistoryTracker /></S></Protected>} />
          <Route path="/index-levels" element={<Protected><S><IndexLevels /></S></Protected>} />

          <Route path="*" element={<S><NotFound /></S>} />
        </Routes>
      )}
    </Layout>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>TradingSignals - Trading Dashboard</title>
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
