import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/options', label: 'Options' },
    { path: '/symbolmaster', label: 'Symbol Master' }
  ];

  return (
    <header className="bg-white shadow-sm sticky-top border-bottom">
      <div className="container-fluid px-4">
        <div className="d-flex align-items-center justify-content-between" style={{ height: '64px' }}>
          <div className="d-flex align-items-center gap-3">
            <span style={{ fontSize: '28px' }}>📈</span>
            <h1 className="h4 fw-bold mb-0">StockSignal</h1>
          </div>
          
          <nav className="d-flex gap-2 align-items-center">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-2 d-flex align-items-center text-decoration-none ${
                  location.pathname === item.path 
                    ? 'text-secondary' 
                    : 'text-primary'
                }`}
              >
                <span className="d-none d-md-inline">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
