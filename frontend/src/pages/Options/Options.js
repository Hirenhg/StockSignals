import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import API from "../../services/api";

const Options = () => {
  const [optionsData, setOptionsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [signalTab, setSignalTab] = useState('all');
  const [optionTypeTab, setOptionTypeTab] = useState('index');
  const [newOption, setNewOption] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSymbol, setDeleteSymbol] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const filteredOptions = optionsData
    .filter((option) => {
      const matchesSearch = option.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const indexSymbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
      const underlyingSymbol = option.symbol.match(/^([A-Z]+)/)?.[1];
      const isIndex = indexSymbols.includes(underlyingSymbol);
      
      const matchesType = (optionTypeTab === 'index' && isIndex) || 
                          (optionTypeTab === 'stocks' && !isIndex);
      
      if (signalTab === 'all') return matchesSearch && matchesType;
      const isCE = option.symbol.includes('CE');
      if (signalTab === 'ce') return matchesSearch && matchesType && isCE;
      if (signalTab === 'pe') return matchesSearch && matchesType && !isCE;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const aValue = a[sortConfig.key] || 0;
      const bValue = b[sortConfig.key] || 0;
      if (sortConfig.direction === "asc") {
        return aValue > bValue ? 1 : -1;
      }
      return bValue > aValue ? 1 : -1;
    });

  const ceCount = filteredOptions.filter(o => o.symbol.includes('CE')).length;
  const peCount = filteredOptions.filter(o => o.symbol.includes('PE')).length;

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const fetchOptionsData = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/options/live");
      const data = await response.json();
      setOptionsData(data);
    } catch (error) {
      console.error("Error fetching options data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOption = () => {
    if (!newOption.trim()) {
      showToast('Symbol is required', 'error');
      return;
    }
    API.post('/api/options', { symbol: newOption })
      .then(() => {
        setNewOption('');
        setShowAddModal(false);
        showToast('Option added successfully!', 'success');
        fetchOptionsData();
      })
      .catch(err => showToast(err.response?.data?.error || 'Error adding option', 'error'));
  };

  const handleDeleteOption = () => {
    API.delete(`/api/options/${deleteSymbol}`)
      .then(() => {
        setOptionsData(optionsData.filter(o => o.symbol !== deleteSymbol));
        setShowDeleteModal(false);
        setDeleteSymbol('');
        showToast('Option deleted successfully!', 'success');
      })
      .catch(err => showToast(err.response?.data?.error || 'Error deleting option', 'error'));
  };

  const openDeleteModal = (symbol) => {
    setDeleteSymbol(symbol);
    setShowDeleteModal(true);
  };

  useEffect(() => {
    fetchOptionsData();
    const interval = setInterval(fetchOptionsData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <div className="spinner-border" role="status"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Stock Signals Options</title>
      </Helmet>
      <div>
        {toast.show && (
          <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
            <div className={`alert alert-${toast.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`} role="alert">
              {toast.message}
              <button type="button" className="btn-close" onClick={() => setToast({ show: false, message: '', type: '' })}></button>
            </div>
          </div>
        )}

        {showAddModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Add Option</h5>
                  <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Option Symbol</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., NIFTY30MAR2623500CE"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-primary" onClick={handleAddOption}>Add Option</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Option</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to delete <strong>{deleteSymbol}</strong>?</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={handleDeleteOption}>Delete</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="d-none d-md-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Options Data</h4>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>Add Option</button>
        </div>

        <div className="d-md-none mb-3">
          <h4 className="mb-0 fw-bold">Options</h4>
        </div>

        <div className="d-md-none mb-3">
          <div className="position-relative mb-2">
            <input
              type="text"
              className="form-control"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted p-0 me-3 text-decoration-none"
                onClick={() => setSearchTerm('')}
                style={{fontSize: '14px'}}
              >✕</button>
            )}
          </div>
          <button className="btn btn-primary w-100" onClick={() => setShowAddModal(true)}>Add Option</button>
        </div>

        <div className="overflow-auto mb-3 d-none d-md-block" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <style>{`.overflow-auto::-webkit-scrollbar { display: none; }`}</style>
          <div className="d-flex gap-2 pb-2">
            <button
              className={`btn btn-sm flex-shrink-0 ${optionTypeTab === 'index' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setOptionTypeTab('index')}
              style={{fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap'}}
            >
              Index Options
            </button>
            <button
              className={`btn btn-sm flex-shrink-0 ${optionTypeTab === 'stocks' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setOptionTypeTab('stocks')}
              style={{fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap'}}
            >
              Stock Options
            </button>
          </div>
        </div>

        <div className="d-none d-md-flex justify-content-between align-items-center mb-3">
          <div className="d-flex gap-2 align-items-center">
            <div className="btn-group" role="group">
              <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
              <button className={`btn btn-sm ${signalTab === 'ce' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('ce')}>CE</button>
              <button className={`btn btn-sm ${signalTab === 'pe' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('pe')}>PE</button>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={fetchOptionsData}>Refresh</button>
          </div>
          <div className="d-flex align-items-center gap-2">
            <input
              type="text"
              className="form-control"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: "300px" }}
            />
            <div className="d-flex gap-2">
              <span className="badge bg-success p-2">CE: {ceCount}</span>
              <span className="badge bg-danger p-2">PE: {peCount}</span>
            </div>
          </div>
        </div>

        <div className="d-md-none d-flex flex-column gap-3 mb-3">
          <div className="d-flex gap-2 align-items-center">
            <div className="btn-group flex-grow-1" role="group">
              <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
              <button className={`btn btn-sm ${signalTab === 'ce' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('ce')}>CE</button>
              <button className={`btn btn-sm ${signalTab === 'pe' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('pe')}>PE</button>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={fetchOptionsData}>Refresh</button>
          </div>
          <div className="d-flex gap-2">
            <span className="badge bg-success p-2">CE: {ceCount}</span>
            <span className="badge bg-danger p-2">PE: {peCount}</span>
          </div>
        </div>

        <div className="d-md-none position-fixed bottom-0 start-0 end-0 bg-white border-top shadow-lg" style={{zIndex: 1000}}>
          <div className="d-flex">
            <button
              className={`btn flex-fill rounded-0 border-0 py-3 ${optionTypeTab === 'index' ? 'btn-primary' : 'btn-light'}`}
              onClick={() => setOptionTypeTab('index')}
              style={{fontSize: '14px', fontWeight: '600'}}
            >
              Index Options
            </button>
            <button
              className={`btn flex-fill rounded-0 border-0 py-3 ${optionTypeTab === 'stocks' ? 'btn-primary' : 'btn-light'}`}
              onClick={() => setOptionTypeTab('stocks')}
              style={{fontSize: '14px', fontWeight: '600'}}
            >
              Stock Options
            </button>
          </div>
        </div>

        <div className="d-md-none" style={{paddingBottom: '80px'}}>
          {filteredOptions.map((option, index) => {
            const isCE = option.symbol.includes('CE');
            const textColor = isCE ? '#198754' : '#dc3545';
            return (
              <div key={index} className="card mb-3 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h6 className="card-title mb-1 fw-bold" style={{ color: textColor, wordBreak: "break-all" }}>{option.symbol}</h6>
                      <h6 className="text-primary fw-bold mb-0">₹{option.ltp?.toFixed(2) || "0.00"}</h6>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge rounded-pill px-3 py-2 ${option.signal === 'BUY' ? 'bg-success' : option.signal === 'SELL' ? 'bg-danger' : 'bg-secondary'}`}>
                        {option.signal || 'HOLD'}
                      </span>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => openDeleteModal(option.symbol)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <small className="text-muted d-block">Lot Size</small>
                      <strong>{option.lotSize}</strong>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">RSI</small>
                      <strong>{option.rsi || '-'}</strong>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">Open</small>
                      <strong>₹{option.open?.toFixed(2) || "0.00"}</strong>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">High</small>
                      <strong>₹{option.high?.toFixed(2) || "0.00"}</strong>
                    </div>
                    <div className="col-6">
                      <small className="text-muted d-block">Low</small>
                      <strong>₹{option.low?.toFixed(2) || "0.00"}</strong>
                    </div>
                  </div>

                  <div className="row g-3 border-top mt-3">
                    <div className="col-6">
                      <small className="text-danger d-block">EMA5</small>
                      <strong className="text-danger">₹{option.ema5 || '-'}</strong>
                    </div>
                    <div className="col-6">
                      <small className="text-success d-block">EMA10</small>
                      <strong className="text-success">₹{option.ema10 || '-'}</strong>
                    </div>
                    <div className="col-6">
                      <small className="text-primary d-block">EMA15</small>
                      <strong className="text-primary">₹{option.ema15 || '-'}</strong>
                    </div>
                    <div className="col-6">
                      <small className="text-warning d-block">EMA20</small>
                      <strong className="text-warning">₹{option.ema20 || '-'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="d-none d-md-block table-responsive">
          <table className="table table-hover" style={{ fontSize: "14px" }}>
            <thead className="table-dark">
              <tr style={{verticalAlign: 'middle'}}>
                <th
                  onClick={() => handleSort("symbol")}
                  style={{ cursor: "pointer" }}
                >
                  Symbol{" "}
                  {sortConfig.key === "symbol" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th>Lot Size</th>
                <th
                  onClick={() => handleSort("ltp")}
                  style={{ cursor: "pointer" }}
                >
                  LTP{" "}
                  {sortConfig.key === "ltp" &&
                    (sortConfig.direction === "asc" ? "↑" : "↓")}
                </th>
                <th>Signal</th>
                <th>RSI</th>
                <th style={{color: 'red'}}>EMA5</th>
                <th style={{color: 'green'}}>EMA10</th>
                <th style={{color: 'blue'}}>EMA15</th>
                <th style={{color: '#ffc107'}}>EMA20</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOptions.map((option, index) => {
                const isCE = option.symbol.includes('CE');
                const textColor = isCE ? '#198754' : '#dc3545';
                return (
                  <tr key={index} style={{verticalAlign: 'middle'}}>
                    <td style={{ color: textColor, fontSize: '14px', fontWeight: 600 }}>
                      {option.symbol}
                    </td>
                    <td>{option.lotSize}</td>
                    <td className="fw-bold">₹{option.ltp?.toFixed(2) || "0.00"}</td>
                    <td>
                      <span className={`badge ${option.signal === "BUY" ? "bg-success" : option.signal === "SELL" ? "bg-danger" : "bg-secondary"}`}>
                        {option.signal || 'HOLD'}
                      </span>
                    </td>
                    <td>{option.rsi || '-'}</td>
                    <td style={{color: 'red'}}>₹{option.ema5 || '-'}</td>
                    <td style={{color: 'green'}}>₹{option.ema10 || '-'}</td>
                    <td style={{color: 'blue'}}>₹{option.ema15 || '-'}</td>
                    <td style={{color: '#ffc107'}}>₹{option.ema20 || '-'}</td>
                    <td>₹{option.open?.toFixed(2) || "0.00"}</td>
                    <td>₹{option.high?.toFixed(2) || "0.00"}</td>
                    <td>₹{option.low?.toFixed(2) || "0.00"}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={() => openDeleteModal(option.symbol)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default Options;
