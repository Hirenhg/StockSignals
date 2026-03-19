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
        { path: '/', label: t('dashboard'), icon: '📊' },
        { path: '/equity', label: t('equityTool'), icon: '📈' },
        { path: '/options', label: t('options'), icon: '⚙️' },
        { path: '/optionchain', label: t('optionChain'), icon: '🔗' },
        { path: '/chart/INFY', label: t('charts'), icon: '📉' },
        { path: '/sectors', label: t('sectors'), icon: '🏢' },
        { path: '/news', label: t('news'), icon: '📰' },
        { path: '/sector-pe', label: 'Sector PE', icon: '📊' },
      ]
    : [
        { path: '/', label: t('dashboard'), icon: '📊' },
        { path: '/sectors', label: t('sectors'), icon: '🏢' },
        { path: '/news', label: t('news'), icon: '📰' },
        { path: '/sector-pe', label: 'Sector PE', icon: '📊' },
      ];

  return (
    <header className="bg-white shadow-sm sticky-top border-bottom app-header">
      <div className="container-fluid px-3 px-md-4">
        <div className="d-flex align-items-center justify-content-between" style={{ height: '56px' }}>
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: '24px' }}>📈</span>
            <h1 className="h5 fw-bold mb-0">StockSignal</h1>
          </div>
          
          {/* Mobile Menu Toggle */}
          <div className="d-flex align-items-center gap-3 d-md-none">
            <button
              className="btn border-0 p-0 d-flex align-items-center justify-content-center theme-toggle"
              onClick={toggleTheme}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              <div className="theme-toggle-track" style={{
                width: '44px', height: '24px', borderRadius: '12px',
                background: darkMode ? '#dfb938' : '#171717',
                position: 'relative', transition: 'background 0.3s ease'
              }}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: '#171717', position: 'absolute', top: '3px',
                  left: darkMode ? '23px' : '3px', transition: 'left 0.3s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}>
                  {darkMode ? '☀️' : '🌙'}
                </div>
              </div>
            </button>
            <select className="border-0 bg-transparent" style={{width: '32px', fontSize: '16px', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', textAlign: 'center', outline: 'none', cursor: 'pointer'}} value={lang} onChange={e => setLang(e.target.value)} aria-label="Language">
              <option value="en">ENG</option>
              <option value="hi">HIN</option>
              <option value="gu">GUJ</option>
            </select>
            <button 
              className="btn btn-link p-0 text-dark text-decoration-none" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{ fontSize: '24px' }}
            >
              {isMenuOpen ? '✕' : '☰'}
            </button>
          </div>

          {/* Desktop Navigation */}
          <nav className="d-none d-md-flex gap-3 align-items-center">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-1 text-decoration-none ${
                  location.pathname === item.path 
                    ? 'text-primary' 
                    : 'text-dark'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              className="btn border-0 p-0 d-flex align-items-center justify-content-center theme-toggle"
              onClick={toggleTheme}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              <div className="theme-toggle-track" style={{
                width: '44px', height: '24px', borderRadius: '12px',
                background: darkMode ? '#dfb938' : '#171717',
                position: 'relative', transition: 'background 0.3s ease'
              }}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: '#fff', position: 'absolute', top: '3px',
                  left: darkMode ? '23px' : '3px', transition: 'left 0.3s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}>
                  {darkMode ? '☀️' : '🌙'}
                </div>
              </div>
            </button>
            <select className="form-select form-select-sm border-0" style={{width: 'auto', fontSize: '16px'}} value={lang} onChange={e => setLang(e.target.value)} aria-label="Language">
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="gu">ગુજરાતી</option>
            </select>
            {isLoggedIn ? (
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted" style={{fontSize: '13px'}}>👤 {user?.name || user?.mobile}</span>
                <button className="btn btn-sm btn-outline-danger" onClick={logout}>Logout</button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-sm btn-primary">Login</Link>
            )}
          </nav>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="d-md-none pb-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={`d-flex align-items-center gap-2 py-2 px-3 mb-1 rounded text-decoration-none ${
                  location.pathname === item.path 
                    ? 'bg-light text-primary fw-semibold' 
                    : 'text-dark'
                }`}
              >
                <span>{item.label}</span>
              </Link>
            ))}
            <div className="py-2 px-3 border-top mt-2">
              {isLoggedIn ? (
                <div className="d-flex justify-content-between align-items-center">
                  <span style={{fontSize: '14px'}}>👤 {user?.name || user?.mobile}</span>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => { logout(); setIsMenuOpen(false); }}>Logout</button>
                </div>
              ) : (
                <Link to="/login" className="btn btn-primary w-100" onClick={() => setIsMenuOpen(false)}>Login</Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
