import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import API from "../../services/api";
import { useTheme } from "../../context/ThemeContext";

const Sectors = () => {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryTab, setCategoryTab] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [refreshing, setRefreshing] = useState(false);
  const { darkMode } = useTheme();

  const fetchSectors = useCallback(async (showToast = false) => {
    if (showToast) setRefreshing(true);
    try {
      const res = await API.get('/api/sectors');
      setSectors(res.data);
    } catch (err) {
      console.error("Sectors error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSectors(); }, [fetchSectors]);

  const categories = ['all', ...new Set(sectors.map(s => s.category))];

  const filtered = sectors
    .filter(s => categoryTab === 'all' || s.category === categoryTab)
    .sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'string') return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const advancers = filtered.filter(s => s.change > 0).length;
  const decliners = filtered.filter(s => s.change < 0).length;
  const unchanged = filtered.filter(s => s.change === 0).length;

  const arrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : '';

  if (loading) {
    return (<div className="d-flex justify-content-center p-5"><div className="spinner-border" role="status"></div></div>);
  }

  return (
    <>
      <Helmet><title>Sector Indices - Live Market</title></Helmet>
      <div>
        {/* Header */}
        <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          <h4 className="mb-0 fw-bold me-auto">Live Market Indices</h4>
          <button className="btn btn-sm btn-outline-primary" onClick={() => fetchSectors(true)} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Summary Bar */}
        <div className="d-flex gap-3 mb-3 flex-wrap">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-success px-3 py-2">▲ Advances: {advancers}</span>
            <span className="badge bg-danger px-3 py-2">▼ Declines: {decliners}</span>
            <span className="badge bg-secondary px-3 py-2">● Unchanged: {unchanged}</span>
          </div>
        </div>

        {/* Category Tabs - Desktop */}
        <div className="d-none d-md-flex gap-2 mb-3 overflow-auto" style={{scrollbarWidth: 'none'}}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`btn btn-sm flex-shrink-0 ${categoryTab === cat ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setCategoryTab(cat)}
              style={{fontSize: '13px', padding: '6px 14px', whiteSpace: 'nowrap'}}
            >
              {cat === 'all' ? 'All Indices' : cat}
            </button>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="d-none d-md-block table-responsive">
          <table className="table table-hover mb-0" style={{fontSize: '14px'}}>
            <thead className="table-dark">
              <tr style={{verticalAlign: 'middle'}}>
                <th onClick={() => handleSort('name')} style={{cursor: 'pointer'}}>Index{arrow('name')}</th>
                <th onClick={() => handleSort('last')} style={{cursor: 'pointer'}} className="text-end">Last{arrow('last')}</th>
                <th onClick={() => handleSort('change')} style={{cursor: 'pointer'}} className="text-end">Change{arrow('change')}</th>
                <th onClick={() => handleSort('pChange')} style={{cursor: 'pointer'}} className="text-end">% Change{arrow('pChange')}</th>
                <th className="text-end">Open</th>
                <th className="text-end">High</th>
                <th className="text-end">Low</th>
                <th className="text-end">Prev Close</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sector, idx) => {
                const isUp = sector.change >= 0;
                const color = isUp ? '#198754' : '#dc3545';
                return (
                  <tr key={idx} style={{verticalAlign: 'middle'}}>
                    <td>
                      <div className="fw-bold">{sector.name}</div>
                      <small className="text-muted">{sector.category}</small>
                    </td>
                    <td className="text-end fw-bold">₹{sector.last.toLocaleString()}</td>
                    <td className="text-end fw-bold" style={{color}}>
                      {isUp ? '▲' : '▼'} {Math.abs(sector.change).toFixed(2)}
                    </td>
                    <td className="text-end">
                      <span className={`badge ${isUp ? 'bg-success' : 'bg-danger'} px-2 py-1`} style={{fontSize: '13px'}}>
                        {isUp ? '+' : ''}{sector.pChange.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-end">₹{sector.open?.toLocaleString() || '-'}</td>
                    <td className="text-end">₹{sector.high?.toLocaleString() || '-'}</td>
                    <td className="text-end">₹{sector.low?.toLocaleString() || '-'}</td>
                    <td className="text-end">₹{sector.prevClose?.toLocaleString() || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Bottom Bar */}
        <div className="d-md-none position-fixed bottom-0 start-0 end-0 bg-white border-top shadow-lg bottom-nav" style={{zIndex: 1000}}>
          <div className="d-flex">
            {categories.map(cat => (
              <button
                key={cat}
                className={`btn flex-fill rounded-0 border-0 py-3 ${categoryTab === cat ? 'btn-primary' : 'btn-light'}`}
                onClick={() => setCategoryTab(cat)}
                style={{fontSize: '13px', fontWeight: '600'}}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="d-md-none" style={{paddingBottom: '80px'}}>
          {filtered.map((sector, idx) => {
            const isUp = sector.change >= 0;
            const color = isUp ? '#198754' : '#dc3545';
            const bgGradient = isUp
              ? 'linear-gradient(135deg, rgba(25,135,84,0.05) 0%, rgba(25,135,84,0) 100%)'
              : 'linear-gradient(135deg, rgba(220,53,69,0.05) 0%, rgba(220,53,69,0) 100%)';
            return (
              <div key={idx} className="card mb-2 shadow-sm" style={{background: bgGradient, borderLeft: `3px solid ${color}`}}>
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <div className="fw-bold" style={{fontSize: '15px'}}>{sector.name}</div>
                      <small className="text-muted">{sector.category}</small>
                    </div>
                    <span className={`badge ${isUp ? 'bg-success' : 'bg-danger'} px-2 py-1`} style={{fontSize: '13px'}}>
                      {isUp ? '+' : ''}{sector.pChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="d-flex justify-content-between align-items-end">
                    <div>
                      <span className="fw-bold" style={{fontSize: '18px'}}>₹{sector.last.toLocaleString()}</span>
                    </div>
                    <div className="text-end">
                      <span className="fw-bold" style={{color, fontSize: '14px'}}>
                        {isUp ? '▲' : '▼'} {Math.abs(sector.change).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between mt-2 pt-2 border-top" style={{fontSize: '12px'}}>
                    <div><span className="text-muted">O:</span> ₹{sector.open?.toLocaleString() || '-'}</div>
                    <div><span className="text-muted">H:</span> ₹{sector.high?.toLocaleString() || '-'}</div>
                    <div><span className="text-muted">L:</span> ₹{sector.low?.toLocaleString() || '-'}</div>
                    <div><span className="text-muted">PC:</span> ₹{sector.prevClose?.toLocaleString() || '-'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Sectors;
