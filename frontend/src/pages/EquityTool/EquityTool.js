import React, { useEffect, useState, useCallback } from "react"
import { Helmet } from "react-helmet-async"
import API from "../../services/api"
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton/Skeleton"
import { useNavigate } from 'react-router-dom'
import TradingViewModal from "../../components/Chart/TradingViewModal"

const TREND_COLORS = {
  green: '#006400', greenLight: '#388e3c',
  red: '#8B0000', redLight: '#b71c1c',
  orange: '#f57f17'
}
const TREND_LABELS = { 1: 'Bullish', '-1': 'Bearish', 0: 'Range' }

function EquityTool() {
  const [signals, setSignals] = useState([])
  const [assetTab, setAssetTab] = useState('indices')
  const [signalTab, setSignalTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [refreshing, setRefreshing] = useState(false)
  const [fetchTime, setFetchTime] = useState(null)
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const [loading, setLoading] = useState(true)
  const [tvSymbol, setTvSymbol] = useState(null)
  const navigate = useNavigate()

  const cacheRef = React.useRef({})

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000)
  }

  const fetchData = useCallback((tab) => {
    const t = tab || assetTab
    const cached = cacheRef.current[t]
    if (cached && Date.now() - cached.time < 60000) {
      setSignals(cached.data)
      setFetchTime(new Date(cached.time).toISOString())
      setLoading(false)
      return
    }
    setLoading(true)
    API.get(`/api/equity-signals/${t}`)
      .then(res => {
        cacheRef.current[t] = { data: res.data, time: Date.now() }
        setSignals(res.data)
        setFetchTime(new Date().toISOString())
      })
      .catch((err) => { console.error('Equity fetch error:', err) })
      .finally(() => setLoading(false))
  }, [assetTab])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      cacheRef.current[assetTab] = null
      API.get(`/api/equity-signals/${assetTab}`)
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

  const refresh = () => {
    setRefreshing(true)
    cacheRef.current[assetTab] = null
    API.get(`/api/equity-signals/${assetTab}`)
      .then(res => {
        cacheRef.current[assetTab] = { data: res.data, time: Date.now() }
        setSignals(res.data)
        setFetchTime(new Date().toISOString())
        showToast('Data refreshed!', 'success')
      })
      .catch(() => showToast('Refresh failed', 'error'))
      .finally(() => setRefreshing(false))
  }

  const filtered = signals.filter(s => {
    const matchSearch = s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    const matchSignal = signalTab === 'all' || s.signal === signalTab.toUpperCase()
    return matchSearch && matchSignal
  })

  const entryCount = filtered.filter(s => s.signal === 'ENTRY').length
  const exitCount = filtered.filter(s => s.signal === 'EXIT').length
  const holdCount = filtered.filter(s => s.signal === 'HOLD').length

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    setSortConfig({ key, direction })
    const sorted = [...filtered].sort((a, b) => {
      if (key === 'signal' || key === 'symbol') return direction === 'asc' ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key])
      return direction === 'asc' ? parseFloat(a[key]) - parseFloat(b[key]) : parseFloat(b[key]) - parseFloat(a[key])
    })
    setSignals(sorted)
  }

  const exportCSV = () => {
    const headers = ['Symbol','Price','Target','SL','%Chg','Signal','EMA10','EMA20','SMA40','Ch Top','Ch Bot','Trend','52W High','52W Low']
    const rows = filtered.map(s => {
      const p = parseFloat(s.price)
      const isExit = s.signal === 'EXIT'
      return [s.symbol,s.price,isExit ? (p*0.988).toFixed(2) : (p*1.012).toFixed(2),isExit ? (p*1.004).toFixed(2) : (p*0.996).toFixed(2),s.pChange||'',s.signal,s.ema10,s.ema20,s.sma40,s.channelTop,s.channelBot,s.dirTrend,s.week52High||'',s.week52Low||'']
    })
    const csv = [headers,...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `equity_${assetTab}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  const SignalBadge = ({ signal }) => {
    const cls = signal === 'ENTRY' ? 'bg-success' : signal === 'EXIT' ? 'bg-danger' : 'bg-secondary'
    return <span className={`badge ${cls}`}>{signal}</span>
  }

  const TrendText = ({ dirTrend, barColor }) => {
    const color = TREND_COLORS[barColor] || TREND_COLORS.orange
    return <span style={{ color, fontWeight: 'bold' }}>{TREND_LABELS[dirTrend] || 'Range'}</span>
  }

  const CrossBadge = ({ item }) => {
    if (item.goldenCross) return <span className="badge bg-success">LB ↑</span>
    if (item.deathCross) return <span className="badge bg-warning text-dark">LS ↓</span>
    return <span className="text-muted">-</span>
  }

  return (
    <>
      <Helmet><title>TradingSignals Equity Tool</title></Helmet>
      <div className="p-1">
        {toast.show && (
          <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
            <div className={`alert alert-${toast.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`}>
              {toast.message}
              <button type="button" className="btn-close" onClick={() => setToast({ show: false, message: '', type: '' })}></button>
            </div>
          </div>
        )}

        <h4 className="mb-3 fw-bold">📈 Equity Tool <small className="text-muted fs-6">(EMA 10/20 + SMA 40 + ATR Channel)</small></h4>

        {/* Asset Tabs */}
        <div className="overflow-auto mb-3" style={{scrollbarWidth: 'none'}}>
          <div className="d-flex gap-2 pb-2">
            {[
              { key: 'indices', label: 'Indices' },
              { key: 'stocks', label: 'Watchlist' },
              { key: 'nifty50', label: 'Nifty 50' },
              { key: 'niftynext50', label: 'Next 50' },
              { key: 'commodities', label: 'Commodities' },
              { key: 'crypto', label: 'Crypto' }
            ].map(tab => (
              <button
                key={tab.key}
                className={`btn btn-sm flex-shrink-0 ${assetTab === tab.key ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setAssetTab(tab.key)}
                style={{fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap'}}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="d-md-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
          <div className="d-flex gap-1" role="group">
            <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
            <button className={`btn btn-sm ${signalTab === 'entry' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('entry')}>Buy</button>
            <button className={`btn btn-sm ${signalTab === 'exit' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('exit')}>Exit</button>
            <button className={`btn btn-sm ${signalTab === 'hold' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setSignalTab('hold')}>Hold</button>
          </div>
          <button className="btn btn-sm btn-outline-primary" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={exportCSV}>CSV</button>
          </div>
         <div className="d-flex align-items-center gap-2 mb-3">
          <input type="text" className="form-control flex-grow-1" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{minWidth: '150px'}} />
          <div className="d-flex gap-2">
            <span className="badge bg-success p-2">BUY: {entryCount}</span>
            <span className="badge bg-danger p-2">EXIT: {exitCount}</span>
            <span className="badge bg-secondary p-2">HOLD: {holdCount}</span>
            </div>
            </div>
        </div>

        {/* Mobile Cards */}
        <div className="d-md-none" style={{paddingBottom: '80px'}}>
          {loading ? <SkeletonCards count={4} /> : filtered.map((item, i) => (
            <div key={i} className="card mb-3 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h5 className="card-title mb-1 fw-bold">
                      <span style={{cursor:'pointer',textDecoration:'underline'}} onClick={() => setTvSymbol(item.symbol)}>{item.symbol}</span>
                      <i className="bi bi-graph-up ms-2" style={{cursor:'pointer',fontSize:'14px',color:'#2962FF'}} onClick={() => navigate(`/chart/${item.symbol}?mode=equity`)}></i>
                    </h5>
                    <h6 className="text-primary fw-bold mb-0">₹{item.price}</h6>
                    {item.pChange != null && (
                      <small className="fw-bold" style={{color: item.pChange >= 0 ? '#198754' : '#dc3545'}}>
                        {item.pChange >= 0 ? '▲' : '▼'} {Math.abs(item.pChange)}%
                      </small>
                    )}
                  </div>
                  <div className="d-flex flex-column gap-1 align-items-end">
                    <SignalBadge signal={item.signal} />
                    <TrendText dirTrend={item.dirTrend} barColor={item.barColor} />
                    <CrossBadge item={item} />
                  </div>
                </div>
                <div className="row g-2">
                  <div className="col-4"><small className="text-muted d-block">EMA 10</small><strong>₹{item.ema10}</strong></div>
                  <div className="col-4"><small className="text-muted d-block">EMA 20</small><strong>₹{item.ema20}</strong></div>
                  <div className="col-4"><small className="text-muted d-block">SMA 40</small><strong>₹{item.sma40}</strong></div>
                  <div className="col-4"><small className="text-muted d-block">Ch Top</small><strong>₹{item.channelTop}</strong></div>
                  <div className="col-4"><small className="text-muted d-block">Ch Bot</small><strong>₹{item.channelBot}</strong></div>
                  <div className="col-4"><small className="text-muted d-block">52W H/L</small><strong>₹{item.week52High || '-'} / ₹{item.week52Low || '-'}</strong></div>
                  <div className="col-6"><small style={{color: '#198754'}} className="d-block">Target {item.signal === 'EXIT' ? '-' : '+'}1.20%</small><strong style={{color: '#198754'}}>₹{item.signal === 'EXIT' ? (parseFloat(item.price) * 0.988).toFixed(2) : (parseFloat(item.price) * 1.012).toFixed(2)}</strong></div>
                  <div className="col-6"><small style={{color: '#dc3545'}} className="d-block">SL {item.signal === 'EXIT' ? '+' : '-'}0.40%</small><strong style={{color: '#dc3545'}}>₹{item.signal === 'EXIT' ? (parseFloat(item.price) * 1.004).toFixed(2) : (parseFloat(item.price) * 0.996).toFixed(2)}</strong></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        {loading ? <SkeletonTable rows={8} cols={14} /> : (
        <div className="d-none d-md-block table-responsive">
          <table className="table table-hover" style={{fontSize: '14px'}}>
            <thead className="table-dark">
              <tr style={{verticalAlign: 'middle'}}>
                <th onClick={() => handleSort('symbol')} style={{cursor: 'pointer'}}>Symbol {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th onClick={() => handleSort('price')} style={{cursor: 'pointer'}}>Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th onClick={() => handleSort('signal')} style={{cursor: 'pointer'}}>Signal {sortConfig.key === 'signal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th>Trend</th>
                <th>Cross</th>
                <th style={{color: '#4fc3f7'}}>EMA 10</th>
                <th style={{color: '#81c784'}}>EMA 20</th>
                <th style={{color: '#ffb74d'}}>SMA 40</th>
                <th style={{color: '#198754'}}>Target</th>
                <th style={{color: '#dc3545'}}>SL</th>
                <th>Ch Top</th>
                <th>Ch Bot</th>
                <th>52W High</th>
                <th>52W Low</th>
                <th onClick={() => handleSort('pChange')} style={{cursor: 'pointer'}}>% Chg {sortConfig.key === 'pChange' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={i} style={{verticalAlign: 'middle'}}>
                  <td className="fw-bold">
                    <span style={{cursor:'pointer',textDecoration:'underline'}} onClick={() => setTvSymbol(item.symbol)}>{item.symbol}</span>
                    <i className="bi bi-graph-up ms-2" style={{cursor:'pointer',fontSize:'13px',color:'#2962FF'}} onClick={() => navigate(`/chart/${item.symbol}?mode=equity`)}></i>
                  </td>
                  <td>₹{item.price}</td>
                  <td><SignalBadge signal={item.signal} /></td>
                  <td><TrendText dirTrend={item.dirTrend} barColor={item.barColor} /></td>
                  <td><CrossBadge item={item} /></td>
                  <td style={{color: '#4fc3f7'}}>₹{item.ema10}</td>
                  <td style={{color: '#81c784'}}>₹{item.ema20}</td>
                  <td style={{color: '#ffb74d'}}>₹{item.sma40}</td>
                  <td style={{color: '#198754', fontWeight: 'bold'}}>₹{item.signal === 'EXIT' ? (parseFloat(item.price) * 0.988).toFixed(2) : (parseFloat(item.price) * 1.012).toFixed(2)}</td>
                  <td style={{color: '#dc3545', fontWeight: 'bold'}}>₹{item.signal === 'EXIT' ? (parseFloat(item.price) * 1.004).toFixed(2) : (parseFloat(item.price) * 0.996).toFixed(2)}</td>
                  <td>₹{item.channelTop}</td>
                  <td>₹{item.channelBot}</td>
                  <td>₹{item.week52High || '-'}</td>
                  <td>₹{item.week52Low || '-'}</td>
                  <td style={{color: item.pChange >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold'}}>
                    {item.pChange != null ? `${item.pChange >= 0 ? '+' : ''}${item.pChange}%` : '-'}
                  </td>
                  <td>{fetchTime ? new Date(fetchTime).toLocaleString() : '-'}</td>
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

export default EquityTool