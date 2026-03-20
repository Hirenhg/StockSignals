import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

const Header = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { darkMode, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const auth = useAuth();
  const user = auth?.user;
  const isLoggedIn = auth?.isLoggedIn || false;
  const logout = auth?.logout || (() => {});

  const navItems = isLoggedIn
    ? [
        { path: '/', label: t('dashboard'), icon: 'bi-speedometer2' },
        { path: '/equity', label: t('equityTool'), icon: 'bi-graph-up-arrow' },
        { path: '/options', label: t('options'), icon: 'bi-gear' },
        { path: '/optionchain', label: t('optionChain'), icon: 'bi-link-45deg' },
        { path: '/chart/INFY', label: t('charts'), icon: 'bi-bar-chart-line' },
        { path: '/sectors', label: t('sectors'), icon: 'bi-building' },
        { path: '/news', label: t('news'), icon: 'bi-newspaper' },
        { path: '/sector-pe', label: 'Sector PE', icon: 'bi-pie-chart' },
        { path: '/peg', label: 'PEG Ratio', icon: 'bi-calculator' },
      ]
    : [
        { path: '/sectors', label: t('sectors'), icon: 'bi-building' },
        { path: '/news', label: t('news'), icon: 'bi-newspaper' },
        { path: '/sector-pe', label: 'Sector PE', icon: 'bi-pie-chart' },
      ];

  const ThemeToggle = () => (
    <button className="btn border-0 p-0 d-flex align-items-center" onClick={toggleTheme} title={darkMode ? 'Light mode' : 'Dark mode'}>
      <div style={{
        width: '40px', height: '22px', borderRadius: '11px',
        background: darkMode ? '#dfb938' : '#171717',
        position: 'relative', transition: 'background 0.3s ease'
      }}>
        <div style={{
          width: '16px', height: '16px', borderRadius: '50%',
          background: darkMode ? '#171717' : '#fff', position: 'absolute', top: '3px',
          left: darkMode ? '21px' : '3px', transition: 'left 0.3s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}>
          {darkMode ? '☀️' : '🌙'}
        </div>
      </div>
    </button>
  );

  return (
    <header className="sticky-top border-bottom app-header bg-white">
      <div className="container-fluid px-3 px-lg-4">
        <div className="d-flex align-items-center justify-content-between" style={{ height: '52px' }}>
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none">
            <span style={{ fontSize: '22px' }}>📈</span>
            <span className="fw-bold header-text" style={{ fontSize: '16px' }}>StockSignal</span>
          </Link>

          {/* Mobile/Tablet controls */}
          <div className="d-flex align-items-center gap-2 d-lg-none">
            <ThemeToggle />
            <select className="border-0 bg-transparent header-text" style={{ width: '28px', fontSize: '14px', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', textAlign: 'center', outline: 'none', cursor: 'pointer' }} value={lang} onChange={e => setLang(e.target.value)} aria-label="Language">
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="gu">GU</option>
            </select>
            <button className="btn btn-link p-0 text-decoration-none header-text" onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ fontSize: '22px', lineHeight: 1 }}>
              {isMenuOpen ? '✕' : '☰'}
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="d-none d-lg-flex align-items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}
                className={`nav-link-item ${location.pathname === item.path ? 'active' : ''}`}>
                {item.label}
              </Link>
            ))}
            <div className="header-divider" style={{ borderLeft: '1px solid', height: '24px', margin: '0 4px', opacity: 0.3 }} />
            <ThemeToggle />
            <select className="form-select form-select-sm border-0 header-text" style={{ width: 'auto', fontSize: '13px', background: 'transparent' }} value={lang} onChange={e => setLang(e.target.value)} aria-label="Language">
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="gu">GU</option>
            </select>
            {isLoggedIn ? (
              <div className="d-flex align-items-center gap-2 ms-1">
                <span className="header-muted" style={{ fontSize: '13px' }}>👤 {user?.name || user?.mobile}</span>
                <button className="btn btn-sm btn-outline-danger" style={{ fontSize: '12px', padding: '2px 8px' }} onClick={logout}>Logout</button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-sm btn-primary ms-1" style={{ fontSize: '12px', padding: '4px 12px' }}>Login</Link>
            )}
          </nav>
        </div>

        {/* Mobile/Tablet Menu */}
        {isMenuOpen && (
          <nav className="d-lg-none pb-3 border-top">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', padding: '8px 0' }}>
              {navItems.map((item) => (
                <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)}
                  className={`d-flex flex-column align-items-center gap-1 nav-grid-item ${location.pathname === item.path ? 'active' : ''}`}>
                  <i className={`bi ${item.icon}`} style={{ fontSize: '20px' }} />
                  <span style={{ lineHeight: 1.2, textAlign: 'center' }}>{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="border-top" style={{ paddingTop: '8px', marginTop: '4px' }}>
              {isLoggedIn ? (
                <div className="d-flex justify-content-between align-items-center px-2">
                  <span className="header-text" style={{ fontSize: '13px' }}>👤 {user?.name || user?.mobile}</span>
                  <button className="btn btn-sm btn-outline-danger" style={{ fontSize: '12px' }} onClick={() => { logout(); setIsMenuOpen(false); }}>Logout</button>
                </div>
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm w-100" onClick={() => setIsMenuOpen(false)}>Login</Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
