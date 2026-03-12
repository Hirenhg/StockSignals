import Header from '../Header/Header';

const Layout = ({ children }) => {
  return (
    <div className="min-vh-100 bg-light">
      <Header />
      <main className="container-fluid p-3">
        {children}
      </main>
    </div>
  );
};

export default Layout;
