import React, { useEffect, useState, useCallback } from "react"
import { Helmet } from "react-helmet-async"
import API from "../../services/api"
import { useLanguage } from "../../context/LanguageContext"
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton/Skeleton"
import { useNavigate } from 'react-router-dom'
import TradingViewModal from "../../components/Chart/TradingViewModal"

function Dashboard({ assetTab: assetTabProp, setAssetTab: setAssetTabProp }) {
  const { t } = useLanguage()
  const [signals, setSignals] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [searchTerm, setSearchTerm] = useState('')
  const [newStock, setNewStock] = useState('')
  const [assetTab, setAssetTab] = useState(assetTabProp || 'indices')
  const [signalTab, setSignalTab] = useState('all')
  const [fetchTime, setFetchTime] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteSymbol, setDeleteSymbol] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const [refreshing, setRefreshing] = useState(false)
  const [telegramEnabled, setTelegramEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [tvSymbol, setTvSymbol] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    API.get('/api/telegram/status').then(res => setTelegramEnabled(res.data.enabled)).catch(() => {})
  }, [])

  const toggleTelegram = () => {
    const newVal = !telegramEnabled
    API.post('/api/telegram/toggle', { enabled: newVal })
      .then(res => { setTelegramEnabled(res.data.enabled); showToast(`Telegram ${res.data.enabled ? 'ON' : 'OFF'}`, 'success') })
      .catch(() => showToast('Failed to toggle', 'error'))
  }

  const exportCSV = () => {
    const headers = ['Symbol','Price','Signal','RSI','7 EMA','R1','R2','R3','S1','S2','S3','Target','SL','%Chg','52W High','52W Low']
    const rows = filteredSignals.map(s => {
      const p = parseFloat(s.price)
      const isSell = s.signal === 'SELL'
      return [s.symbol,s.price,s.signal,s.rsi,s.ema7,s.r1,s.r2,s.r3,s.s1,s.s2,s.s3,s.targetPrice||'',s.slPrice||'',s.pChange||'',s.week52High||'',s.week52Low||'']
    })
    const csv = [headers,...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${assetTab}_signals_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }
  // Sync with prop changes
  useEffect(() => {
    if (assetTabProp) {
      setAssetTab(assetTabProp)
    }
  }, [assetTabProp])

  // Update parent when local state changes
  useEffect(() => {
    if (setAssetTabProp) {
      setAssetTabProp(assetTab)
    }
  }, [assetTab, setAssetTabProp])

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000)
  }

  const filteredSignals = signals.filter(s => {
    const matchesSearch = s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSignal = signalTab === 'all' || s.signal === signalTab.toUpperCase()
    return matchesSearch && matchesSignal
  })

  const buyCount = filteredSignals.filter(s => s.signal === 'BUY').length
  const sellCount = filteredSignals.filter(s => s.signal === 'SELL').length
  const holdCount = filteredSignals.filter(s => s.signal === 'HOLD').length

  const cacheRef = React.useRef({})

  const fetchTabData = useCallback((tab) => {
    const t = tab || assetTab
    const cached = cacheRef.current[t]
    if (cached && Date.now() - cached.time < 60000) {
      setSignals(cached.data)
      setFetchTime(new Date(cached.time).toISOString())
      setLoading(false)
      return
    }
    setLoading(true)
    API.get(`/api/signals/${t}`)
      .then(res => {
        cacheRef.current[t] = { data: res.data, time: Date.now() }
        setSignals(res.data)
        setFetchTime(new Date().toISOString())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [assetTab])

  useEffect(() => {
    fetchTabData()
  }, [fetchTabData])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      cacheRef.current[assetTab] = null
      API.get(`/api/signals/${assetTab}`)
        .then(res => {
          cacheRef.current[assetTab] = { data: res.data, time: Date.now() }
          setSignals(res.data)
          setFetchTime(new Date().toISOString())
        })
        .catch(() => {})
    }, 60000)
    return () => clearInterval(interval)
  }, [assetTab])

  // Fast price-only refresh every 15s during market hours
  useEffect(() => {
    const isMarketOpen = () => {
      const now = new Date()
      const day = now.getDay()
      if (day === 0 || day === 6) return false
      const t = now.getHours() * 60 + now.getMinutes()
      return t >= 555 && t <= 930
    }
    if (!isMarketOpen()) return
    const interval = setInterval(() => {
      if (!isMarketOpen() || !signals.length) return
      const symbols = signals.map(s => s.symbol)
      API.post('/api/prices', { symbols })
        .then(res => {
          const priceMap = res.data
          setSignals(prev => prev.map(s => {
            const p = priceMap[s.symbol]
            if (!p) return s
            return { ...s, price: p.price.toFixed(2), pChange: p.pChange }
          }))
          setFetchTime(new Date().toISOString())
        })
        .catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTab, signals.length])

  const refreshCurrentTab = () => {
    setRefreshing(true)
    cacheRef.current[assetTab] = null
    API.get(`/api/signals/${assetTab}`)
      .then(res => {
        cacheRef.current[assetTab] = { data: res.data, time: Date.now() }
        setSignals(res.data)
        setFetchTime(new Date().toISOString())
        showToast('Data refreshed!', 'success')
      })
      .catch(err => showToast('Refresh failed', 'error'))
      .finally(() => setRefreshing(false))
  }

  const searchSuggestions = useCallback(async (val) => {
    if (val.length < 1) { setSuggestions([]); return; }
    setSuggestLoading(true);
    try {
      const res = await API.get(`/api/search?q=${val}&type=${assetTab}`)
      setSuggestions(res.data)
    } catch { setSuggestions([]) }
    finally { setSuggestLoading(false) }
  }, [assetTab])

  // Debounce search
  const searchTimerRef = React.useRef(null)
  const debouncedSearch = useCallback((val) => {
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => searchSuggestions(val), 300)
  }, [searchSuggestions])

  const handleAddStock = () => {
    if (!newStock.trim()) {
      showToast('Symbol is required', 'error')
      return
    }
    const assetType = assetTab;
    API.post(`/api/${assetType}`, { symbol: newStock })
      .then(() => {
        setNewStock('')
        setSuggestions([])
        setShowAddModal(false)
        const displayName = assetType === 'nifty50' ? 'Nifty50 stock' : assetType === 'niftynext50' ? 'NiftyNext50 stock' : assetType === 'commodities' ? 'commodity' : assetType.slice(0, -1);
        showToast(`${displayName} added successfully!`, 'success')
        fetchTabData()
      })
      .catch(err => {
        const displayName = assetType === 'nifty50' ? 'Nifty50 stock' : assetType === 'niftynext50' ? 'NiftyNext50 stock' : assetType === 'commodities' ? 'commodity' : assetType.slice(0, -1);
        showToast(err.response?.data?.error || `Error adding ${displayName}`, 'error')
      })
  }

  const handleDeleteStock = () => {
    const assetType = assetTab;
    API.delete(`/api/${assetType}/${deleteSymbol}`)
      .then(() => {
        setSignals(signals.filter(s => s.symbol !== deleteSymbol))
        setShowDeleteModal(false)
        setDeleteSymbol('')
        const displayName = assetType === 'nifty50' ? 'Nifty50 stock' : assetType === 'niftynext50' ? 'NiftyNext50 stock' : assetType === 'commodities' ? 'commodity' : assetType.slice(0, -1);
        showToast(`${displayName} deleted successfully!`, 'success')
      })
      .catch(err => {
        const displayName = assetType === 'nifty50' ? 'Nifty50 stock' : assetType === 'niftynext50' ? 'NiftyNext50 stock' : assetType === 'commodities' ? 'commodity' : assetType.slice(0, -1);
        showToast(err.response?.data?.error || `Error deleting ${displayName}`, 'error')
      })
  }

  const openDeleteModal = (symbol) => {
    setDeleteSymbol(symbol)
    setShowDeleteModal(true)
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })

    const sorted = [...filteredSignals].sort((a, b) => {
      if (key === 'signal' || key === 'symbol') {
        return direction === 'asc' ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key])
      }
      return direction === 'asc' ? parseFloat(a[key]) - parseFloat(b[key]) : parseFloat(b[key]) - parseFloat(a[key])
    })
    setSignals(sorted)
  }

  return (
    <>
      <Helmet>
        <title>TradingSignals Dashboard</title>
      </Helmet>
      
      <div className="p-1">
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
                  <h5 className="modal-title">Add {assetTab === 'stocks' ? 'Stock' : assetTab === 'indices' ? 'Index' : assetTab}</h5>
                  <button type="button" className="btn-close" onClick={() => { setShowAddModal(false); setSuggestions([]); setNewStock(''); }}></button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Symbol</label>
                  <div className="position-relative">
                    <input
                      type="text"
                      className="form-control"
                      placeholder={`Search ${assetTab === 'stocks' ? 'Stock' : assetTab === 'indices' ? 'Index' : assetTab} symbol`}
                      value={newStock}
                      onChange={(e) => { setNewStock(e.target.value.toUpperCase()); debouncedSearch(e.target.value.toUpperCase()); }}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddStock()}
                      autoComplete="off"
                    />
                    {suggestLoading && <small className="text-muted ms-1">Searching...</small>}
                    {suggestions.length > 0 && (
                      <ul className="list-group position-absolute w-100 shadow" style={{ zIndex: 9999, maxHeight: '220px', overflowY: 'auto', top: '100%' }}>
                        {suggestions.map((s, i) => (
                          <li key={i} className="list-group-item list-group-item-action py-2 px-3" style={{ cursor: 'pointer', fontSize: '13px' }}
                            onClick={() => { setNewStock(s.symbol); setSuggestions([]); }}>
                            <span className="fw-bold">{s.symbol}</span>
                            {s.name && s.name !== s.symbol && <span className="text-muted ms-2">{s.name}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setSuggestions([]); setNewStock(''); }}>Cancel</button>
                  <button type="button" className="btn btn-primary" onClick={handleAddStock}>Add</button>
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
                  <h5 className="modal-title">Delete {assetTab === 'stocks' ? 'Stock' : assetTab === 'indices' ? 'Index' : assetTab}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDeleteModal(false)}></button>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to delete <strong>{deleteSymbol}</strong>?</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={handleDeleteStock}>Delete</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="d-none d-md-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2">
          <h4 className="mb-0 fw-bold">Trading Signals</h4>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>Add {assetTab === 'stocks' ? 'Stock' : assetTab === 'indices' ? 'Index' : assetTab}</button>
        </div>
        <div className="d-md-none mb-3">
          <div className="d-flex gap-2 mb-2">
            <h4 className="mb-0 fw-bold flex-grow-1">Trading Signals</h4>
          </div>
          <button className="btn btn-primary btn-sm w-100" onClick={() => setShowAddModal(true)}>Add {assetTab === 'stocks' ? 'Stock' : assetTab === 'indices' ? 'Index' : assetTab}</button>
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
        </div>
        <div className="overflow-auto mb-3 d-none d-md-block" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <style>{`.overflow-auto::-webkit-scrollbar { display: none; }`}</style>
          <div className="d-flex gap-2 pb-2">
            {[
              { key: 'indices', label: t('indices') },
              { key: 'stocks', label: t('watchlist') },
              { key: 'nifty50', label: t('nifty50') },
              { key: 'niftynext50', label: t('next50')},
              { key: 'commodities', label: t('commodities')},
              { key: 'crypto', label: t('crypto') }
            ].map(tab => (
              <button 
                key={tab.key}
                className={`btn btn-sm flex-shrink-0 d-flex align-items-center gap-1 ${
                  assetTab === tab.key ? 'btn-primary' : 'btn-outline-primary'
                }`}
                onClick={() => setAssetTab(tab.key)}
                style={{fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap'}}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="d-none d-md-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <div className="d-flex gap-1" role="group">
              <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
              <button className={`btn btn-sm ${signalTab === 'buy' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('buy')}>Buy</button>
              <button className={`btn btn-sm ${signalTab === 'sell' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('sell')}>Sell</button>
              <button className={`btn btn-sm ${signalTab === 'hold' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setSignalTab('hold')}>Hold</button>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={refreshCurrentTab} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={exportCSV}>Export CSV</button>
            <button className={`btn btn-sm ${telegramEnabled ? 'btn-success' : 'btn-outline-secondary'}`} onClick={toggleTelegram} title="Toggle Telegram notifications">
              {telegramEnabled ? '🔔 TG ON' : '🔕 TG OFF'}
            </button>
          </div>
          <div className="d-flex align-items-center gap-2">
            <input 
              type="text" 
              className="form-control flex-grow-1" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{minWidth: '150px'}}
            />
            <div className="d-flex gap-2">
              <span className="badge bg-success p-2">BUY: {buyCount}</span>
              <span className="badge bg-danger p-2">SELL: {sellCount}</span>
              <span className="badge bg-secondary p-2">HOLD: {holdCount}</span>
            </div>
          </div>
        </div>
        <div className="d-md-none d-flex flex-column gap-3 mb-3">
          <div className="d-flex gap-2 align-items-center">
            <div className="d-flex gap-1 flex-grow-1" role="group">
              <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
              <button className={`btn btn-sm ${signalTab === 'buy' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('buy')}>Buy</button>
              <button className={`btn btn-sm ${signalTab === 'sell' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('sell')}>Sell</button>
              <button className={`btn btn-sm ${signalTab === 'hold' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setSignalTab('hold')}>Hold</button>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={refreshCurrentTab} disabled={refreshing}>
                {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={exportCSV}>CSV</button>
            <button className={`btn btn-sm ${telegramEnabled ? 'btn-success' : 'btn-outline-secondary'}`} onClick={toggleTelegram}>
              {telegramEnabled ? '🔔' : '🔕'}
            </button>
          </div>
          <div className="d-flex gap-2">
            <span className="badge bg-success p-2">BUY: {buyCount}</span>
            <span className="badge bg-danger p-2">SELL: {sellCount}</span>
            <span className="badge bg-secondary p-2">HOLD: {holdCount}</span>
          </div>
        </div>
        <div className="d-md-none" style={{paddingBottom: '80px'}}>
          {loading ? <SkeletonCards count={4} /> : filteredSignals.map((item, index) => (
            <div key={index} className="card mb-3 shadow-sm position-relative">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h5 className="card-title mb-1 fw-bold">
                      <span style={{cursor:'pointer',textDecoration:'underline'}} onClick={() => setTvSymbol(item.symbol)}>{item.symbol}</span>
                      <i className="bi bi-graph-up ms-2" style={{cursor:'pointer',fontSize:'14px',color:'#2962FF'}} onClick={() => navigate(`/chart/${item.symbol}?mode=dashboard`)}></i>
                    </h5>
                    <h6 className="text-primary fw-bold mb-0">₹{item.price}</h6>
                    {item.pChange != null && (
                      <small className="fw-bold" style={{color: item.pChange >= 0 ? '#198754' : '#dc3545'}}>
                        {item.pChange >= 0 ? '▲' : '▼'} {Math.abs(item.pChange)}%
                      </small>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                  <span className={`badge rounded-pill px-3 py-2 ${item.signal === 'BUY' ? 'bg-success' : item.signal === 'SELL' ? 'bg-danger' : 'bg-secondary'}`}>
                    {item.signal}
                  </span>
                   <button 
                    className="btn btn-outline-danger btn-sm" 
                    onClick={() => openDeleteModal(item.symbol)}
                  >
                    Delete
                  </button>
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <small className="text-muted d-block">RSI</small>
                    <strong>{item.rsi}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">52W High</small>
                    <strong>₹{item.week52High || '-'}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">52W Low</small>
                    <strong>₹{item.week52Low || '-'}</strong>
                  </div>
                  <div className="col-6">
                    <small style={{color: '#198754'}} className="d-block">Target {item.signal === 'SELL' ? '-' : '+'}1.20%</small>
                    <strong style={{color: '#198754'}}>₹{item.targetPrice || (item.signal === 'SELL' ? (parseFloat(item.price) * 0.988).toFixed(2) : (parseFloat(item.price) * 1.012).toFixed(2))}</strong>
                  </div>
                  <div className="col-6">
                    <small style={{color: '#dc3545'}} className="d-block">SL</small>
                    <strong style={{color: '#dc3545'}}>₹{item.slPrice || (item.signal === 'SELL' ? (parseFloat(item.price) * 1.004).toFixed(2) : (parseFloat(item.price) * 0.996).toFixed(2))}</strong>
                  </div>
                </div>

                <div className="row g-3 border-top mt-3">
                  <div className="col-6">
                    <small className="text-primary d-block">7 EMA</small>
                    <strong className="text-primary">₹{item.ema7}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">R1</small>
                    <strong>₹{item.r1 || '-'}</strong>
                  </div>
                  <div className="col-4">
                    <small style={{color:'#dc3545'}} className="d-block">R1</small>
                    <strong style={{color:'#dc3545'}}>₹{item.r1 || '-'}</strong>
                  </div>
                  <div className="col-4">
                    <small style={{color:'#dc3545'}} className="d-block">R2</small>
                    <strong style={{color:'#dc3545'}}>₹{item.r2 || '-'}</strong>
                  </div>
                  <div className="col-4">
                    <small style={{color:'#dc3545'}} className="d-block">R3</small>
                    <strong style={{color:'#dc3545'}}>₹{item.r3 || '-'}</strong>
                  </div>
                  <div className="col-4">
                    <small style={{color:'#198754'}} className="d-block">S1</small>
                    <strong style={{color:'#198754'}}>₹{item.s1 || '-'}</strong>
                  </div>
                  <div className="col-4">
                    <small style={{color:'#198754'}} className="d-block">S2</small>
                    <strong style={{color:'#198754'}}>₹{item.s2 || '-'}</strong>
                  </div>
                  <div className="col-4">
                    <small style={{color:'#198754'}} className="d-block">S3</small>
                    <strong style={{color:'#198754'}}>₹{item.s3 || '-'}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {loading ? <SkeletonTable rows={8} cols={16} /> : (
        <div className="d-none d-md-block table-responsive">
          <table className="table table-hover" style={{fontSize: '14px'}}>
            <thead className="table-dark">
              <tr style={{verticalAlign: 'middle'}}>
                <th onClick={() => handleSort('symbol')} style={{cursor: 'pointer'}}>
                  Stock {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('price')} style={{cursor: 'pointer'}}>
                  Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('signal')} style={{cursor: 'pointer'}}>
                  Signal {sortConfig.key === 'signal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('rsi')} style={{cursor: 'pointer'}}>
                  RSI {sortConfig.key === 'rsi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{color:'#2962FF'}}>7 EMA</th>
                <th style={{color:'#dc3545'}}>R1</th>
                <th style={{color:'#dc3545'}}>R2</th>
                <th style={{color:'#dc3545'}}>R3</th>
                <th style={{color:'#198754'}}>S1</th>
                <th style={{color:'#198754'}}>S2</th>
                <th style={{color:'#198754'}}>S3</th>
                <th style={{color: '#198754'}}>Target</th>
                <th style={{color: '#dc3545'}}>SL</th>
                <th>52W High</th>
                <th>52W Low</th>
                <th onClick={() => handleSort('pChange')} style={{cursor: 'pointer'}}>
                  % Chg {sortConfig.key === 'pChange' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignals.map((item, index) => (
                <tr key={index} style={{verticalAlign: 'middle'}}>
                  <td className="fw-bold">
                    <span style={{cursor:'pointer',textDecoration:'underline'}} onClick={() => setTvSymbol(item.symbol)}>{item.symbol}</span>
                    <i className="bi bi-graph-up ms-2" style={{cursor:'pointer',fontSize:'13px',color:'#2962FF'}} onClick={() => navigate(`/chart/${item.symbol}?mode=dashboard`)}></i>
                  </td>
                  <td>₹{item.price}</td>
                  <td>
                    <span className={`badge ${item.signal === "BUY" ? "bg-success" : item.signal === "SELL" ? "bg-danger" : "bg-secondary"}`}>
                      {item.signal}
                    </span>
                  </td>
                  <td>{item.rsi}</td>
                  <td style={{color:'#2962FF'}}>₹{item.ema7}</td>
                  <td style={{color:'#dc3545'}}>₹{item.r1 || '-'}</td>
                  <td style={{color:'#dc3545'}}>₹{item.r2 || '-'}</td>
                  <td style={{color:'#dc3545'}}>₹{item.r3 || '-'}</td>
                  <td style={{color:'#198754'}}>₹{item.s1 || '-'}</td>
                  <td style={{color:'#198754'}}>₹{item.s2 || '-'}</td>
                  <td style={{color:'#198754'}}>₹{item.s3 || '-'}</td>
                  <td style={{color: '#198754', fontWeight: 'bold'}}>₹{item.targetPrice || (item.signal === 'SELL' ? (parseFloat(item.price) * 0.988).toFixed(2) : (parseFloat(item.price) * 1.012).toFixed(2))}</td>
                  <td style={{color: '#dc3545', fontWeight: 'bold'}}>₹{item.slPrice || (item.signal === 'SELL' ? (parseFloat(item.price) * 1.004).toFixed(2) : (parseFloat(item.price) * 0.996).toFixed(2))}</td>
                  <td>₹{item.week52High || '-'}</td>
                  <td>₹{item.week52Low || '-'}</td>
                  <td style={{color: item.pChange >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold'}}>
                    {item.pChange != null ? `${item.pChange >= 0 ? '+' : ''}${item.pChange}%` : '-'}
                  </td>
                  <td>{fetchTime ? new Date(fetchTime).toLocaleString() : new Date(item.timestamp).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => openDeleteModal(item.symbol)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        {tvSymbol && <TradingViewModal symbol={tvSymbol} onClose={() => setTvSymbol(null)} />}
      </div>
    </>
  )
}

export default Dashboard