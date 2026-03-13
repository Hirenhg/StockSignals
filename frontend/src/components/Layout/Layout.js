import Header from '../Header/Header';
import BottomNav from '../BottomNav/BottomNav';
import { useState } from 'react';

const Layout = ({ children }) => {
  const [assetTab, setAssetTab] = useState('indices');

  return (
    <div className="min-vh-100 bg-light">
      <Header />
      <main className="container-fluid p-3" style={{paddingBottom: '80px'}}>
        {typeof children === 'function' ? children({ assetTab, setAssetTab }) : children}
      </main>
      <BottomNav assetTab={assetTab} setAssetTab={setAssetTab} />
    </div>
  );
};

export default Layout;
