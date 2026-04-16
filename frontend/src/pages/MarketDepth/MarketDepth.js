import React, { useEffect, useState, useCallback } from "react"
import { Helmet } from "react-helmet-async"
import API from "../../services/api"
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton/Skeleton"


function MarketDepth() {
  const [allStocks, setAllStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [tab, setTab] = useState('buyers')
  const [sortConfig, setSortConfig] = useState({ key: 'buyPct', direction: 'desc' })
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const [fetchTime, setFetchTime] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000)
  }

  const fetchData = useCallback((silent) => {
    if (!silent) setLoading(true)
    API.get('/api/buyers')
      .then(res => {
        setAllStocks(res.data)
        setFetchTime(new Date().toISOString())
      })
      .catch(() => showToast('Failed to load data', 'error'))
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    setSortConfig({ key: tab === 'buyers' ? 'buyPct' : 'sellPct', direction: 'desc' })
  }, [tab])

  const refresh = () => { setRefreshing(true); fetchData() }

  const stocks = allStocks.filter(s =>
    tab === 'buyers' ? s.buyPct >= 60 : s.sellPct >= 60
  )

  const filtered = stocks.filter(s => s.symbol.toLowerCase().includes(searchTerm.toLowerCase()))

  const sorted = [...filtered].sort((a, b) => {
    const { key, direction } = sortConfig
    if (key === 'symbol') return direction === 'asc' ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key])
    return direction === 'asc' ? (a[key] || 0) - (b[key] || 0) : (b[key] || 0) - (a[key] || 0)
  })

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }))
  }

  const isBuyers = tab === 'buyers'
  const pctKey = isBuyers ? 'buyPct' : 'sellPct'
  const pctLabel = isBuyers ? 'Buy %' : 'Sell %'

  const getPctColor = (pct) => {
    if (isBuyers) {
      if (pct >= 80) return '#0d6efd'
      if (pct >= 70) return '#198754'
      return '#6f42c1'
    }
    if (pct >= 80) return '#dc3545'
    if (pct >= 70) return '#fd7e14'
    return '#6f42c1'
  }

  const buyersCount = allStocks.filter(s => s.buyPct >= 60).length
  const sellersCount = allStocks.filter(s => s.sellPct >= 60).length

  const tabItems = [
    { key: 'buyers', label: 'Buyers', icon: 'arrow-up-circle', solidIcon: 'arrow-up-circle-fill', count: buyersCount, color: 'success' },
    { key: 'sellers', label: 'Sellers', icon: 'arrow-down-circle', solidIcon: 'arrow-down-circle-fill', count: sellersCount, color: 'danger' },
  ]

  return (
    <>
      <Helmet><title>{isBuyers ? 'Buyers' : 'Sellers'} 60%+ - Market Depth - TradingSignals</title></Helmet>
      <div className="p-1">
        {toast.show && (
          <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
            <div className={`alert alert-${toast.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`}>
              {toast.message}
              <button type="button" className="btn-close" onClick={() => setToast({ show: false, message: '', type: '' })}></button>
            </div>
          </div>
        )}

        {/* Desktop Tabs */}
        <div className="overflow-auto mb-3 d-none d-md-block" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="d-flex gap-2 pb-2">
            {tabItems.map(t => (
              <button
                key={t.key}
                className={`btn flex-shrink-0 d-flex align-items-center gap-1 buyers-tab ${tab === t.key ? (t.color === 'success' ? 'btn-success' : 'btn-danger') : (t.color === 'success' ? 'btn-outline-success' : 'btn-outline-danger')}`}
                onClick={() => setTab(t.key)}
                style={{ fontSize: '15px', padding: '8px 16px', whiteSpace: 'nowrap' }}
              >
                <span>{t.label}</span>
                <span className={`badge ${tab === t.key ? 'bg-white text-dark' : (t.color === 'success' ? 'bg-success' : 'bg-danger')} ms-1`}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile search */}
        <div className="d-md-none mb-3">
          <div className="position-relative">
            <input type="text" className="form-control" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && (
              <button className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted p-0 me-3 text-decoration-none" onClick={() => setSearchTerm('')} style={{ fontSize: '14px' }}>✕</button>
            )}
          </div>
        </div>

        {/* Desktop Filters */}
        <div className="d-none d-md-flex flex-row justify-content-between align-items-center mb-3 gap-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <button className="btn btn-sm btn-outline-primary" onClick={refresh} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <small className="text-muted">{sorted.length} stocks — NSE India live</small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <input type="text" className="form-control form-control-sm" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ minWidth: '150px' }} />
          </div>
        </div>

        {/* Mobile Filters */}
        <div className="d-md-none d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-sm btn-outline-primary" onClick={refresh} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <small className="text-muted">{sorted.length} stocks</small>
        </div>

        {/* Mobile Cards */}
        <div className="d-md-none" style={{ paddingBottom: '80px' }}>
          {loading ? <SkeletonCards count={4} /> : sorted.length === 0 ? (
            <div className="text-center text-muted py-4">No stocks with 60%+ {isBuyers ? 'buyer' : 'seller'} quantity found</div>
          ) : sorted.map((item, index) => (
            <div key={index} className="card mb-3 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h5 className="card-title mb-1 fw-bold">{item.symbol}</h5>
                    <h6 className="text-primary fw-bold mb-0">₹{item.price}</h6>
                    {item.pChange != null && (
                      <small className="fw-bold" style={{ color: item.pChange >= 0 ? '#198754' : '#dc3545' }}>
                        {item.pChange >= 0 ? '▲' : '▼'} {Math.abs(item.pChange)}%
                      </small>
                    )}
                  </div>
                  <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: getPctColor(item[pctKey]), color: '#fff', fontSize: '14px' }}>
                    {item[pctKey]}% {isBuyers ? 'Buyers' : 'Sellers'}
                  </span>
                </div>
                <div className="row g-3">
                  <div className="col-6">
                    <small className="text-muted d-block">Volume (L)</small>
                    <strong>{item.totalVolLakh}</strong>
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
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        {loading ? <SkeletonTable rows={8} cols={7} /> : (
          <div className="d-none d-md-block table-responsive">
            <table className="table table-hover" style={{ fontSize: '14px' }}>
              <thead className="table-dark">
                <tr style={{ verticalAlign: 'middle' }}>
                  <th onClick={() => handleSort('symbol')} style={{ cursor: 'pointer' }}>
                    Stock {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('price')} style={{ cursor: 'pointer' }}>
                    Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort(pctKey)} style={{ cursor: 'pointer' }}>
                    {pctLabel} {sortConfig.key === pctKey && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('totalVolLakh')} style={{ cursor: 'pointer' }}>
                    Vol (L) {sortConfig.key === 'totalVolLakh' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('pChange')} style={{ cursor: 'pointer' }}>
                    % Chg {sortConfig.key === 'pChange' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>52W High</th>
                  <th>52W Low</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan="7" className="text-center text-muted py-4">No stocks with 60%+ {isBuyers ? 'buyer' : 'seller'} quantity found</td></tr>
                ) : sorted.map((item, index) => (
                  <tr key={index} style={{ verticalAlign: 'middle' }}>
                    <td className="fw-bold">{item.symbol}</td>
                    <td>₹{item.price}</td>
                    <td>
                      <span className="badge rounded-pill px-2 py-1" style={{ backgroundColor: getPctColor(item[pctKey]), color: '#fff' }}>
                        {item[pctKey]}%
                      </span>
                    </td>
                    <td>{item.totalVolLakh}</td>
                    <td style={{ color: item.pChange >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold' }}>
                      {item.pChange != null ? `${item.pChange >= 0 ? '+' : ''}${item.pChange}%` : '-'}
                    </td>
                    <td>₹{item.week52High || '-'}</td>
                    <td>₹{item.week52Low || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="d-md-none position-fixed bottom-0 start-0 end-0 border-top buyers-bottom-nav" style={{ zIndex: 1000 }}>
        <div className="d-flex">
          {tabItems.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-fill d-flex flex-column align-items-center border-0 py-2 buyers-bottom-btn ${tab === t.key ? `active-${t.color}` : ''}`}
            >
              <i className={`bi bi-${tab === t.key ? t.solidIcon : t.icon}`} style={{ fontSize: '26px' }}></i>
              <span style={{ fontSize: '14px', fontWeight: tab === t.key ? 600 : 400 }}>{t.label}</span>
              <span className={`badge ${t.color === 'success' ? 'bg-success' : 'bg-danger'} rounded-pill`} style={{ fontSize: '11px', marginTop: '5px' }}>{t.count}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}

export default MarketDepth
