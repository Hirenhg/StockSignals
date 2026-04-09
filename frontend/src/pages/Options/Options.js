import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import API from "../../services/api";
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton/Skeleton";

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
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const exportCSV = () => {
    const headers = ['Symbol','LotSize','LTP','Target','SL','%Chg','Signal','RSI','EMA7','Pivot','R1','R2','R3','S1','S2','S3','Open','High','Low']
    const rows = filteredOptions.map(o => {
      const p = o.ltp || 0
      const isSell = o.signal === 'SELL'
      return [o.symbol,o.lotSize,p.toFixed(2),isSell?(p*0.7).toFixed(2):(p*1.3).toFixed(2),isSell?(p*1.1).toFixed(2):(p*0.9).toFixed(2),o.pChange||'',o.signal||'HOLD',o.rsi||'',o.ema7||'',o.pivot||'',o.r1||'',o.r2||'',o.r3||'',o.s1||'',o.s2||'',o.s3||'',o.open?.toFixed(2)||0,o.high?.toFixed(2)||0,o.low?.toFixed(2)||0]
    })
    const csv = [headers,...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `options_${optionTypeTab}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const filteredOptions = optionsData
    .filter((option) => {
      const matchesSearch = option.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
      const indexSymbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
      const underlyingSymbol = option.symbol.match(/^([A-Z]+)/)?.[1];
      const isIndex = indexSymbols.includes(underlyingSymbol);
      const matchesType = (optionTypeTab === 'index' && isIndex) || (optionTypeTab === 'stocks' && !isIndex);
      const matchesSignal = signalTab === 'all' || (option.signal || 'HOLD') === signalTab.toUpperCase();
      return matchesSearch && matchesType && matchesSignal;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      const aValue = a[sortConfig.key] || 0;
      const bValue = b[sortConfig.key] || 0;
      return sortConfig.direction === "asc" ? (aValue > bValue ? 1 : -1) : (bValue > aValue ? 1 : -1);
    });

  const buyCount = filteredOptions.filter(o => o.signal === 'BUY').length;
  const sellCount = filteredOptions.filter(o => o.signal === 'SELL').length;
  const holdCount = filteredOptions.filter(o => (o.signal || 'HOLD') === 'HOLD').length;

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const fetchOptionsData = useCallback(async (showRefreshToast = false) => {
    if (showRefreshToast) setRefreshing(true);
    try {
      const response = await API.get(`/api/options/live?_=${Date.now()}`);
      setOptionsData(response.data);
      if (showRefreshToast) showToast('Data refreshed!', 'success');
    } catch (error) {
      if (showRefreshToast) showToast('Refresh failed', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleAddOption = () => {
    if (!newOption.trim()) { showToast('Symbol is required', 'error'); return; }
    API.post('/api/options', { symbol: newOption })
      .then(() => { setNewOption(''); setSuggestions([]); setShowAddModal(false); showToast('Option added successfully!', 'success'); fetchOptionsData(); })
      .catch(err => showToast(err.response?.data?.error || 'Error adding option', 'error'));
  };

  const searchSuggestions = useCallback(async (val) => {
    if (val.length < 2) { setSuggestions([]); return; }
    setSuggestLoading(true);
    try {
      const res = await API.get(`/api/options/search?q=${val}`);
      setSuggestions(res.data);
    } catch { setSuggestions([]); }
    finally { setSuggestLoading(false); }
  }, []);

  // Debounce search
  const searchTimerRef = React.useRef(null);
  const debouncedSearch = useCallback((val) => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchSuggestions(val), 300);
  }, [searchSuggestions]);

  const handleDeleteOption = () => {
    API.delete(`/api/options/${deleteSymbol}`)
      .then(() => { setOptionsData(optionsData.filter(o => o.symbol !== deleteSymbol)); setShowDeleteModal(false); setDeleteSymbol(''); showToast('Option deleted successfully!', 'success'); })
      .catch(err => showToast(err.response?.data?.error || 'Error deleting option', 'error'));
  };

  const openDeleteModal = (symbol) => { setDeleteSymbol(symbol); setShowDeleteModal(true); };

  useEffect(() => {
    fetchOptionsData();
    const interval = setInterval(fetchOptionsData, 30000);
    return () => clearInterval(interval);
  }, [fetchOptionsData]);

  if (loading) {
    return (
      <>
        <Helmet><title>Stock Signals Options</title></Helmet>
        <div>
          <div className="d-none d-md-flex justify-content-between align-items-center mb-4">
            <h4 className="mb-0">Options Data</h4>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>Add Option</button>
          </div>
          <div className="d-md-none mb-3"><h4 className="mb-0 fw-bold">Options</h4></div>
          <div className="d-none d-md-flex gap-2 mb-3">
            <button className={`btn btn-sm ${optionTypeTab === 'index' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setOptionTypeTab('index')} style={{fontSize: '13px', padding: '8px 16px'}}>Index Options</button>
            <button className={`btn btn-sm ${optionTypeTab === 'stocks' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setOptionTypeTab('stocks')} style={{fontSize: '13px', padding: '8px 16px'}}>Stock Options</button>
          </div>
          <div className="d-none d-md-flex justify-content-between align-items-center mb-3">
            <div className="d-flex gap-2 align-items-center">
              <div className="d-flex gap-1" role="group">
                <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
                <button className={`btn btn-sm ${signalTab === 'buy' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('buy')}>Buy</button>
                <button className={`btn btn-sm ${signalTab === 'sell' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('sell')}>Sell</button>
                <button className={`btn btn-sm ${signalTab === 'hold' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setSignalTab('hold')}>Hold</button>
              </div>
              <button className="btn btn-sm btn-outline-primary" onClick={() => fetchOptionsData(true)} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={exportCSV}>Export CSV</button>
            </div>
            <div className="d-flex align-items-center gap-2">
              <input type="text" className="form-control" placeholder="Search options..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ maxWidth: "300px" }} />
              <div className="d-flex gap-2">
                <span className="badge bg-success p-2">BUY: {buyCount}</span>
                <span className="badge bg-danger p-2">SELL: {sellCount}</span>
                <span className="badge bg-secondary p-2">HOLD: {holdCount}</span>
              </div>
            </div>
          </div>
          <SkeletonCards count={4} />
          <SkeletonTable rows={8} cols={14} />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Stock Signals Options</title></Helmet>
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
                  <button type="button" className="btn-close" onClick={() => { setShowAddModal(false); setSuggestions([]); setNewOption(''); }}></button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Option Symbol</label>
                  <div className="position-relative">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., NIFTY or BANKNIFTY25500CE"
                      value={newOption}
                      onChange={(e) => { const v = e.target.value.toUpperCase(); setNewOption(v); debouncedSearch(v); }}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                      autoComplete="off"
                    />
                    {suggestLoading && <small className="text-muted ms-1">Searching...</small>}
                    {suggestions.length > 0 && (
                      <ul className="list-group position-absolute w-100 shadow" style={{ zIndex: 9999, maxHeight: '220px', overflowY: 'auto', top: '100%' }}>
                        {suggestions.map((s, i) => (
                          <li key={i} className="list-group-item list-group-item-action py-2 px-3" style={{ cursor: 'pointer', fontSize: '13px' }}
                            onClick={() => { setNewOption(s.symbol); setSuggestions([]); }}>
                            <span className={`fw-bold ${s.symbol.endsWith('CE') ? 'text-success' : 'text-danger'}`}>{s.symbol}</span>
                            <span className="text-muted ms-2">Lot: {s.lotSize} | Exp: {s.expiry}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setSuggestions([]); setNewOption(''); }}>Cancel</button>
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
            <input type="text" className="form-control" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && (
              <button className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted p-0 me-3 text-decoration-none" onClick={() => setSearchTerm('')} style={{fontSize: '14px'}}>✕</button>
            )}
          </div>
          <button className="btn btn-primary w-100" onClick={() => setShowAddModal(true)}>Add Option</button>
        </div>

        <div className="overflow-auto mb-3 d-none d-md-block" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <style>{`.overflow-auto::-webkit-scrollbar { display: none; }`}</style>
          <div className="d-flex gap-2 pb-2">
            <button className={`btn btn-sm flex-shrink-0 ${optionTypeTab === 'index' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setOptionTypeTab('index')} style={{fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap'}}>Index Options</button>
            <button className={`btn btn-sm flex-shrink-0 ${optionTypeTab === 'stocks' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setOptionTypeTab('stocks')} style={{fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap'}}>Stock Options</button>
          </div>
        </div>

        {/* Desktop controls */}
        <div className="d-none d-md-flex justify-content-between align-items-center mb-3">
          <div className="d-flex gap-2 align-items-center">
            <div className="d-flex gap-1" role="group">
              <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
              <button className={`btn btn-sm ${signalTab === 'buy' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('buy')}>Buy</button>
              <button className={`btn btn-sm ${signalTab === 'sell' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('sell')}>Sell</button>
              <button className={`btn btn-sm ${signalTab === 'hold' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setSignalTab('hold')}>Hold</button>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={() => fetchOptionsData(true)} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
            <button className="btn btn-sm btn-outline-secondary" onClick={exportCSV}>Export CSV</button>
          </div>
          <div className="d-flex align-items-center gap-2">
            <input type="text" className="form-control" placeholder="Search options..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ minWidth: "150px" }} />
            <div className="d-flex gap-2">
              <span className="badge bg-success p-2">BUY: {buyCount}</span>
              <span className="badge bg-danger p-2">SELL: {sellCount}</span>
              <span className="badge bg-secondary p-2">HOLD: {holdCount}</span>
            </div>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="d-md-none d-flex flex-column gap-3 mb-3">
          <div className="d-flex gap-2 align-items-center">
            <div className="d-flex gap-1 flex-grow-1" role="group">
              <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
              <button className={`btn btn-sm ${signalTab === 'buy' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('buy')}>Buy</button>
              <button className={`btn btn-sm ${signalTab === 'sell' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('sell')}>Sell</button>
              <button className={`btn btn-sm ${signalTab === 'hold' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setSignalTab('hold')}>Hold</button>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={() => fetchOptionsData(true)} disabled={refreshing}>{refreshing ? 'Refreshing...' : 'Refresh'}</button>
          </div>
          <div className="d-flex gap-2 align-items-center">
            <button className="btn btn-sm btn-outline-secondary" onClick={exportCSV}>CSV</button>
          </div>
          <div className="d-flex gap-2">
            <span className="badge bg-success p-2">BUY: {buyCount}</span>
            <span className="badge bg-danger p-2">SELL: {sellCount}</span>
            <span className="badge bg-secondary p-2">HOLD: {holdCount}</span>
          </div>
        </div>

        <div className="d-md-none position-fixed bottom-0 start-0 end-0 bg-white border-top shadow-lg bottom-nav" style={{zIndex: 1000}}>
          <div className="d-flex">
            <button className={`btn flex-fill rounded-0 border-0 py-3 ${optionTypeTab === 'index' ? 'btn-primary' : 'btn-light'}`} onClick={() => setOptionTypeTab('index')} style={{fontSize: '14px', fontWeight: '600'}}>Index Options</button>
            <button className={`btn flex-fill rounded-0 border-0 py-3 ${optionTypeTab === 'stocks' ? 'btn-primary' : 'btn-light'}`} onClick={() => setOptionTypeTab('stocks')} style={{fontSize: '14px', fontWeight: '600'}}>Stock Options</button>
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
                      {option.pChange != null && (
                        <small className="fw-bold" style={{color: option.pChange >= 0 ? '#198754' : '#dc3545'}}>
                          {option.pChange >= 0 ? '▲' : '▼'} {Math.abs(option.pChange)}%
                        </small>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge rounded-pill px-3 py-2 ${option.signal === 'BUY' ? 'bg-success' : option.signal === 'SELL' ? 'bg-danger' : 'bg-secondary'}`}>{option.signal || 'HOLD'}</span>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => openDeleteModal(option.symbol)}>Delete</button>
                    </div>
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-6"><small className="text-muted d-block">Lot Size</small><strong>{option.lotSize}</strong></div>
                    <div className="col-6"><small className="text-muted d-block">RSI</small><strong>{option.rsi || '-'}</strong></div>
                    <div className="col-6"><small className="text-muted d-block">Open</small><strong>₹{option.open?.toFixed(2) || "0.00"}</strong></div>
                    <div className="col-6"><small className="text-muted d-block">High</small><strong>₹{option.high?.toFixed(2) || "0.00"}</strong></div>
                    <div className="col-6"><small className="text-muted d-block">Low</small><strong>₹{option.low?.toFixed(2) || "0.00"}</strong></div>
                  </div>
                  <div className="row g-3 border-top mt-3">
                    <div className="col-6"><small className="text-primary d-block">EMA7</small><strong className="text-primary">₹{option.ema7 || '-'}</strong></div>
                    <div className="col-6"><small className="text-muted d-block">Pivot</small><strong>₹{option.pivot || '-'}</strong></div>
                    <div className="col-4"><small style={{color:'#dc3545'}} className="d-block">R1</small><strong style={{color:'#dc3545'}}>₹{option.r1 || '-'}</strong></div>
                    <div className="col-4"><small style={{color:'#dc3545'}} className="d-block">R2</small><strong style={{color:'#dc3545'}}>₹{option.r2 || '-'}</strong></div>
                    <div className="col-4"><small style={{color:'#dc3545'}} className="d-block">R3</small><strong style={{color:'#dc3545'}}>₹{option.r3 || '-'}</strong></div>
                    <div className="col-4"><small style={{color:'#198754'}} className="d-block">S1</small><strong style={{color:'#198754'}}>₹{option.s1 || '-'}</strong></div>
                    <div className="col-4"><small style={{color:'#198754'}} className="d-block">S2</small><strong style={{color:'#198754'}}>₹{option.s2 || '-'}</strong></div>
                    <div className="col-4"><small style={{color:'#198754'}} className="d-block">S3</small><strong style={{color:'#198754'}}>₹{option.s3 || '-'}</strong></div>
                    <div className="col-6">
                      <small style={{color: '#198754'}} className="d-block">Target {(option.signal || 'HOLD') === 'SELL' ? '-' : '+'}30%</small>
                      <strong style={{color: '#198754'}}>₹{(option.signal || 'HOLD') === 'SELL' ? ((option.ltp || 0) * 0.7).toFixed(2) : ((option.ltp || 0) * 1.3).toFixed(2)}</strong>
                    </div>
                    <div className="col-6">
                      <small style={{color: '#dc3545'}} className="d-block">SL {(option.signal || 'HOLD') === 'SELL' ? '+' : '-'}10%</small>
                      <strong style={{color: '#dc3545'}}>₹{(option.signal || 'HOLD') === 'SELL' ? ((option.ltp || 0) * 1.1).toFixed(2) : ((option.ltp || 0) * 0.9).toFixed(2)}</strong>
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
                <th onClick={() => handleSort("symbol")} style={{ cursor: "pointer" }}>Symbol {sortConfig.key === "symbol" && (sortConfig.direction === "asc" ? "↑" : "↓")}</th>
                <th>Lot Size</th>
                <th onClick={() => handleSort("ltp")} style={{ cursor: "pointer" }}>LTP {sortConfig.key === "ltp" && (sortConfig.direction === "asc" ? "↑" : "↓")}</th>
                <th>Signal</th>
                <th>RSI</th>
                <th style={{color:'#2962FF'}}>EMA7</th>
                <th>Pivot</th>
                <th style={{color:'#dc3545'}}>R1</th>
                <th style={{color:'#dc3545'}}>R2</th>
                <th style={{color:'#dc3545'}}>R3</th>
                <th style={{color:'#198754'}}>S1</th>
                <th style={{color:'#198754'}}>S2</th>
                <th style={{color:'#198754'}}>S3</th>
                <th style={{color: '#198754'}}>Target</th>
                <th style={{color: '#dc3545'}}>SL</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>% Chg</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOptions.map((option, index) => {
                const isCE = option.symbol.includes('CE');
                const textColor = isCE ? '#198754' : '#dc3545';
                return (
                  <tr key={index} style={{verticalAlign: 'middle'}}>
                    <td style={{ color: textColor, fontSize: '14px', fontWeight: 600 }}>{option.symbol}</td>
                    <td>{option.lotSize}</td>
                    <td className="fw-bold">₹{option.ltp?.toFixed(2) || "0.00"}</td>
                    <td><span className={`badge ${option.signal === "BUY" ? "bg-success" : option.signal === "SELL" ? "bg-danger" : "bg-secondary"}`}>{option.signal || 'HOLD'}</span></td>
                    <td>{option.rsi || '-'}</td>
                    <td style={{color:'#2962FF'}}>₹{option.ema7 || '-'}</td>
                    <td>₹{option.pivot || '-'}</td>
                    <td style={{color:'#dc3545'}}>₹{option.r1 || '-'}</td>
                    <td style={{color:'#dc3545'}}>₹{option.r2 || '-'}</td>
                    <td style={{color:'#dc3545'}}>₹{option.r3 || '-'}</td>
                    <td style={{color:'#198754'}}>₹{option.s1 || '-'}</td>
                    <td style={{color:'#198754'}}>₹{option.s2 || '-'}</td>
                    <td style={{color:'#198754'}}>₹{option.s3 || '-'}</td>
                    <td style={{color: '#198754', fontWeight: 'bold'}}>₹{(option.signal || 'HOLD') === 'SELL' ? ((option.ltp || 0) * 0.7).toFixed(2) : ((option.ltp || 0) * 1.3).toFixed(2)}</td>
                    <td style={{color: '#dc3545', fontWeight: 'bold'}}>₹{(option.signal || 'HOLD') === 'SELL' ? ((option.ltp || 0) * 1.1).toFixed(2) : ((option.ltp || 0) * 0.9).toFixed(2)}</td>
                    <td>₹{option.open?.toFixed(2) || "0.00"}</td>
                    <td>₹{option.high?.toFixed(2) || "0.00"}</td>
                    <td>₹{option.low?.toFixed(2) || "0.00"}</td>
                    <td style={{color: option.pChange >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold'}}>
                      {option.pChange != null ? `${option.pChange >= 0 ? '+' : ''}${option.pChange}%` : '-'}
                    </td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => openDeleteModal(option.symbol)}>Delete</button></td>
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
