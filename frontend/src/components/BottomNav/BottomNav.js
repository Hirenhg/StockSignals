import { useLocation } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';

const BottomNav = ({ assetTab, setAssetTab }) => {
  const location = useLocation();

  // Only show on dashboard page
  if (location.pathname !== '/') return null;

  const tabs = [
    { key: 'indices', label: 'Indices', icon: 'graph-up', solidIcon: 'graph-up-arrow' },
    { key: 'stocks', label: 'Watchlist', icon: 'star', solidIcon: 'star-fill' },
    { key: 'nifty50', label: 'Nifty 50', icon: 'trophy', solidIcon: 'trophy-fill' },
    { key: 'niftynext50', label: 'Next 50', icon: 'bar-chart', solidIcon: 'bar-chart-fill'},
    { key: 'commodities', label: 'Commod', icon: 'droplet', solidIcon: 'droplet-fill'},
    { key: 'crypto', label: 'Crypto', icon: 'currency-bitcoin', solidIcon: 'currency-bitcoin' }
  ];

  return (
    <nav className="d-md-none position-fixed bottom-0 start-0 end-0 bg-white border-top" style={{zIndex: 1000, boxShadow: '0 -2px 10px rgba(0,0,0,0.05)', overflowX: 'auto'}}>
      <div className="d-flex" style={{minWidth: 'max-content'}}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAssetTab(tab.key)}
            className={`d-flex flex-column align-items-center border-0 px-3 py-1 ${
              assetTab === tab.key ? 'text-dark bg-gray-200' : 'text-muted bg-transparent'
            }`}
          >
            <i className={`bi bi-${assetTab === tab.key ? tab.solidIcon : tab.icon}`} style={{fontSize: '24px'}}></i>
            <span style={{fontSize: '14px', fontWeight: assetTab === tab.key ? '600' : '400', whiteSpace: 'nowrap'}}>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
