import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

const Header = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/options', label: 'Options', icon: '⚙️' },
    { path: '/symbolmaster', label: 'Symbol Master', icon: '📋' }
  ];

  return (
    <header className="bg-white shadow-sm sticky-top border-bottom">
      <div className="container-fluid px-3 px-md-4">
        <div className="d-flex align-items-center justify-content-between" style={{ height: '56px' }}>
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: '24px' }}>📈</span>
            <h1 className="h5 fw-bold mb-0">StockSignal</h1>
          </div>
          
          {/* Mobile Menu Toggle */}
          <button 
            className="btn btn-link d-md-none p-0 text-dark text-decoration-none" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{ fontSize: '24px' }}
          >
            {isMenuOpen ? '✕' : '☰'}
          </button>

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
          </nav>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="d-md-none">
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
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
