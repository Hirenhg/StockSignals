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
  const [watchlist, setWatchlist] = useState([])
  const [wlLoading, setWlLoading] = useState(true)
  const [wlSort, setWlSort] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('All')
  const [volumeFilter, setVolumeFilter] = useState('All')
  const navigate = useNavigate()

  useEffect(() => {
    API.get('/api/telegram/status').then(res => setTelegramEnabled(res.data.enabled)).catch(() => {})
    API.get('/api/watchlist-analysis')
      .then(r => setWatchlist(r.data))
      .catch(e => console.error('Watchlist analysis fetch error:', e))
      .finally(() => setWlLoading(false))
  }, [])

  const toggleTelegram = () => {
    const newVal = !telegramEnabled
    API.post('/api/telegram/toggle', { enabled: newVal })
      .then(res => { setTelegramEnabled(res.data.enabled); showToast(`Telegram ${res.data.enabled ? 'ON' : 'OFF'}`, 'success') })
      .catch(() => showToast('Failed to toggle', 'error'))
  }

  const exportCSV = () => {
    const headers = ['Symbol','Price','Signal','RSI','EMA Pro','Pivot Pro','R1','R2','R3','S1','S2','S3','%Chg','52W High','52W Low']
    const rows = filteredSignals.map(s => {
      return [s.symbol,s.price,s.signal,s.rsi,s.ema7,s.pivot,s.r1,s.r2,s.r3,s.s1,s.s2,s.s3,s.pChange||'',s.week52High||'',s.week52Low||'']
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
        <div className="d-md-none" style={{paddingBottom: '0px'}}>
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
                </div>

                <div className="row g-3 border-top mt-3">
                  <div className="col-6">
                    <small className="text-primary d-block">EMA Pro</small>
                    <strong className="text-primary">₹{item.ema7}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Pivot Pro</small>
                    <strong>₹{item.pivot || '-'}</strong>
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
                <th style={{color:'#2962FF'}}>EMA Pro</th>
                <th>Pivot Pro</th>
                <th style={{color:'#dc3545'}}>R1</th>
                <th style={{color:'#dc3545'}}>R2</th>
                <th style={{color:'#dc3545'}}>R3</th>
                <th style={{color:'#198754'}}>S1</th>
                <th style={{color:'#198754'}}>S2</th>
                <th style={{color:'#198754'}}>S3</th>
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
                  <td>₹{item.pivot || '-'}</td>
                  <td style={{color:'#dc3545'}}>₹{item.r1 || '-'}</td>
                  <td style={{color:'#dc3545'}}>₹{item.r2 || '-'}</td>
                  <td style={{color:'#dc3545'}}>₹{item.r3 || '-'}</td>
                  <td style={{color:'#198754'}}>₹{item.s1 || '-'}</td>
                  <td style={{color:'#198754'}}>₹{item.s2 || '-'}</td>
                  <td style={{color:'#198754'}}>₹{item.s3 || '-'}</td>
                  <td>₹{item.week52High || '-'}</td>
                  <td>₹{item.week52Low || '-'}</td>
                  <td style={{color: item.pChange >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold'}}>
                    {item.pChange != null ? `${item.pChange >= 0 ? '+' : ''}${item.pChange}%` : '-'}
                  </td>
                  <td>{fetchTime ? new Date(fetchTime).toLocaleTimeString() : new Date(item.timestamp).toLocaleTimeString()}</td>
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

        {/* ===== WATCHLIST STOCK ANALYSIS ===== */}
        {assetTab === 'stocks' && (() => {
          const cardBg = '#fff'
          const border = '#e5e5e5'
          const text = '#212529'
          const textMuted = '#6c757d'
          const sectionBg = '#f8f9fa'
          return (
            <>
              <h5 className="fw-bold mb-3 mt-4" style={{ color: text }}>Watchlist Stock Analysis</h5>
              <div className="mb-3" style={{ fontSize: '12px', color: textMuted }}>EMA Pro Daily/Weekly/Monthly · 50 & 200 EMA Cross · RSI · Volume · Status · Upside % · Target & Stop Loss</div>

              <div className="d-flex gap-2 mb-3 flex-wrap">
                <select className="form-select" style={{ width: 'auto', fontSize: '14px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="All">All Status</option>
                  <option value="Strong Buy">Strong Buy</option>
                  <option value="Momentum Buy">Momentum Buy</option>
                  <option value="Buy on Dip">Buy on Dip</option>
                  <option value="Strong Support">Strong Support</option>
                  <option value="Hold">Hold</option>
                  <option value="Weak">Weak</option>
                </select>
                <select className="form-select" style={{ width: 'auto', fontSize: '14px' }} value={volumeFilter} onChange={e => setVolumeFilter(e.target.value)}>
                  <option value="All">All Volume</option>
                  <option value="Good">Good</option>
                  <option value="Average">Average</option>
                  <option value="Bad">Bad</option>
                </select>
              </div>

              {wlLoading ? (
                <div className="d-none d-md-block"><SkeletonTable rows={5} cols={12} /></div>
              ) : watchlist.length === 0 ? (
                <div className="text-center text-muted p-4">No watchlist stocks found</div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="d-none d-md-block table-responsive mb-4">
                    <table className="table table-hover" style={{ fontSize: '14px' }}>
                      <thead className="table-dark">
                        <tr style={{ verticalAlign: 'middle' }}>
                          <th>Symbol</th>
                          <th>Price</th>
                          <th>EMA Pro Daily</th>
                          <th>EMA Pro Weekly</th>
                          <th>EMA Pro Monthly</th>
                          <th>50 EMA</th>
                          <th>200 EMA</th>
                          <th>RSI</th>
                          <th>Volume</th>
                          <th>Status</th>
                          <th>Up Chance <button onClick={() => setWlSort(s => s === 'desc' ? 'asc' : 'desc')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '13px', padding: '0 4px' }}>{wlSort === 'desc' ? '▼' : '▲'}</button></th>
                          <th>Target</th>
                          <th>Stop Loss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...watchlist].filter(r => (statusFilter === 'All' || r.status === statusFilter) && (volumeFilter === 'All' || r.volume === volumeFilter)).sort((a, b) => wlSort === 'desc' ? b.upChancePct - a.upChancePct : a.upChancePct - b.upChancePct).map((row, i) => {
                          const statusColor = {
                            'Strong Buy': '#198754', 'Momentum Buy': '#20c997',
                            'Buy on Dip': '#0d6efd', 'Strong Support': '#6f42c1',
                            'Hold': '#ffc107', 'Weak': '#dc3545'
                          }[row.status] || textMuted
                          const volColor = row.volume === 'Good' ? '#198754' : row.volume === 'Bad' ? '#dc3545' : '#ffc107'
                          const rsiColor = row.rsi > 70 ? '#dc3545' : row.rsi < 30 ? '#198754' : row.rsi > 55 ? '#20c997' : textMuted
                          return (
                            <tr key={i} style={{ verticalAlign: 'middle' }}>
                              <td className="fw-bold">{row.symbol}</td>
                              <td><div className="fw-bold">₹{row.price}</div></td>
                              <td style={{ color: row.ema7Daily && row.price >= row.ema7Daily ? '#198754' : '#dc3545' }}>{row.ema7Daily ?? '-'}</td>
                              <td style={{ color: row.ema7Weekly && row.price >= row.ema7Weekly ? '#198754' : '#dc3545' }}>{row.ema7Weekly ?? '-'}</td>
                              <td style={{ color: row.ema7Monthly && row.price >= row.ema7Monthly ? '#198754' : '#dc3545' }}>{row.ema7Monthly ?? '-'}</td>
                              <td>{row.ema50Above == null ? '-' : (<span className={`badge ${row.ema50Above ? 'bg-success' : 'bg-danger'}`}>{row.ema50Above ? 'YES ✓' : 'NO ✗'}</span>)}</td>
                              <td>{row.ema200Above == null ? '-' : (<span className={`badge ${row.ema200Above ? 'bg-success' : 'bg-danger'}`}>{row.ema200Above ? 'YES ✓' : 'NO ✗'}</span>)}</td>
                              <td style={{ color: rsiColor, fontWeight: 600 }}>{row.rsi ?? '-'}</td>
                              <td style={{ color: volColor, fontWeight: 600 }}>{row.volume}</td>
                              <td><span className="badge" style={{ background: statusColor, fontSize: '12px' }}>{row.status}</span></td>
                              <td><span style={{ fontWeight: 700, color: row.upChancePct >= 70 ? '#198754' : row.upChancePct >= 50 ? '#ffc107' : '#dc3545' }}>{row.upChancePct}%</span></td>
                              <td className="fw-bold" style={{ color: '#198754' }}>₹{row.target}<div style={{ fontSize: '11px', fontWeight: 400 }}>+{row.targetPct}%</div></td>
                              <td className="fw-bold" style={{ color: '#dc3545' }}>₹{row.stopLoss}<div style={{ fontSize: '11px', fontWeight: 400 }}>{row.stopLossPct}%</div></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="d-md-none" style={{ paddingBottom: 10 }}>
                    {watchlist.filter(r => (statusFilter === 'All' || r.status === statusFilter) && (volumeFilter === 'All' || r.volume === volumeFilter)).map((row, i) => {
                      const statusColor = {
                        'Strong Buy': '#198754', 'Momentum Buy': '#20c997',
                        'Buy on Dip': '#0d6efd', 'Strong Support': '#6f42c1',
                        'Hold': '#ffc107', 'Weak': '#dc3545'
                      }[row.status] || textMuted
                      const volColor = row.volume === 'Good' ? '#198754' : row.volume === 'Bad' ? '#dc3545' : '#ffc107'
                      const rsiColor = row.rsi > 70 ? '#dc3545' : row.rsi < 30 ? '#198754' : row.rsi > 55 ? '#20c997' : textMuted

                      return (
                        <div key={i} className="card mb-3 shadow" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>
                          <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                            <div>
                              <div className="fw-bold" style={{ fontSize: '22px', color: text, letterSpacing: '0.3px' }}>{row.symbol}</div>
                              <span className="badge mt-1" style={{ background: statusColor, fontSize: '13px', padding: '4px 12px', borderRadius: 20 }}>{row.status}</span>
                            </div>
                            <div className="text-end">
                              <div className="fw-bold" style={{ fontSize: '24px', color: text }}>₹{row.price}</div>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between align-items-center px-3 py-3" style={{ background: sectionBg, borderBottom: `1px solid ${border}` }}>
                            {[['EMA Pro D', row.ema7Daily, row.price >= row.ema7Daily], ['EMA Pro W', row.ema7Weekly, row.price >= row.ema7Weekly], ['EMA Pro M', row.ema7Monthly, row.price >= row.ema7Monthly]].map(([lbl, val, up]) => (
                              <div key={lbl} className="text-center">
                                <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lbl}</div>
                                <div className="fw-bold" style={{ fontSize: '18px', color: val ? (up ? '#198754' : '#dc3545') : textMuted }}>{val ?? '-'}</div>
                              </div>
                            ))}
                          </div>
                          <div className="px-3 pt-3 pb-2">
                            <div className="row g-0">
                              <div className="col-6 pe-2">
                                <div className="mb-2" style={{ fontSize: '13px', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>EMA Cross</div>
                                {[['50 EMA', row.ema50Above], ['200 EMA', row.ema200Above]].map(([lbl, above]) => (
                                  <div key={lbl} className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: `1px solid #f0f0f0` }}>
                                    <span style={{ fontSize: '14px', color: textMuted }}>{lbl}</span>
                                    <span className={`badge ${above ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '13px' }}>
                                      {above == null ? '-' : above ? 'YES ✓' : 'NO ✗'}
                                    </span>
                                  </div>
                                ))}
                                <div className="d-flex justify-content-between align-items-center py-1">
                                  <span style={{ fontSize: '14px', color: textMuted }}>Volume</span>
                                  <span className="fw-bold" style={{ fontSize: '16px', color: volColor }}>{row.volume}</span>
                                </div>
                              </div>
                              <div className="col-6 ps-2" style={{ borderLeft: `1px solid ${border}` }}>
                                <div className="mb-2" style={{ fontSize: '13px', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Signals</div>
                                <div className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: `1px solid #f0f0f0` }}>
                                  <span style={{ fontSize: '14px', color: textMuted }}>RSI</span>
                                  <span className="fw-bold" style={{ fontSize: '16px', color: rsiColor }}>{row.rsi ?? '-'}</span>
                                </div>
                                <div className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: `1px solid #f0f0f0` }}>
                                  <span style={{ fontSize: '14px', color: textMuted }}>Up Chance</span>
                                  <span className="fw-bold" style={{ fontSize: '16px', color: row.upChancePct >= 70 ? '#198754' : row.upChancePct >= 50 ? '#ffc107' : '#dc3545' }}>{row.upChancePct}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="d-flex justify-content-between align-items-center px-3 py-3" style={{ background: sectionBg, borderTop: `1px solid ${border}` }}>
                            <div className="text-center">
                              <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target</div>
                              <div className="fw-bold" style={{ fontSize: '18px', color: '#198754' }}>₹{row.target}</div>
                              <div style={{ fontSize: '13px', color: '#198754' }}>+{row.targetPct}%</div>
                            </div>
                            <div className="text-center">
                              <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Risk:Reward</div>
                              <div className="fw-bold" style={{ fontSize: '18px', color: text }}>1 : 2</div>
                            </div>
                            <div className="text-center">
                              <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stop Loss</div>
                              <div className="fw-bold" style={{ fontSize: '18px', color: '#dc3545' }}>₹{row.stopLoss}</div>
                              <div style={{ fontSize: '13px', color: '#dc3545' }}>{row.stopLossPct}%</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )
        })()}
      </div>
    </>
  )
}

export default Dashboard