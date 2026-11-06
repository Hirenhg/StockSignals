import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable } from '../../components/Skeleton/Skeleton'
import { useTheme } from '../../context/ThemeContext'

const PAGE_SIZE = 50
const LS_KEY = 'allstocks_holdings'

function AllStocks({ darkMode }) {
  const [allList, setAllList] = useState([])
  const [prices, setPrices] = useState({})
  const [loadingList, setLoadingList] = useState(true)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'companyName', direction: 'asc' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pctFilter, setPctFilter] = useState(0)
  const [holdings, setHoldings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
  })
  const [editing, setEditing] = useState({}) // { symbol: { buy, qty } }

  const bg2 = darkMode ? '#16213e' : '#f8f9fa'
  const border = darkMode ? '#2a2a4a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'

  useEffect(() => {
    API.get('/api/allstocks/list')
      .then(r => setAllList(r.data))
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [])

  const pf = PCT_OPTIONS[pctFilter]
  const filtered = allList.filter(r => {
    if (search && !r.symbol.toLowerCase().includes(search.toLowerCase()) && !(prices[r.symbol]?.companyName || '').toLowerCase().includes(search.toLowerCase())) return false
    if (pf.min != null || pf.max != null) {
      const h = holdings[r.symbol]
      if (!h || !prices[r.symbol]?.price) return false
      const holding = h.buy * h.qty
      const portfolioToday = prices[r.symbol].price * h.qty
      const pnlPct = holding ? ((portfolioToday - holding) / holding) * 100 : 0
      if (pf.min != null && pnlPct < pf.min) return false
      if (pf.max != null && pnlPct > pf.max) return false
    }
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, pctFilter])

  useEffect(() => {
    if (!pageItems.length) return
    const missing = pageItems.filter(r => !prices[r.symbol])
    if (!missing.length) return
    setLoadingPrices(true)
    API.post('/api/allstocks/prices', { stocks: missing })
      .then(r => setPrices(prev => {
        const next = { ...prev }
        r.data.forEach(d => { next[d.symbol] = d })
        return next
      }))
      .catch(() => {})
      .finally(() => setLoadingPrices(false))
  }, [page, search]) // eslint-disable-line

  const saveHolding = (symbol) => {
    const e = editing[symbol]
    if (!e) return
    const buy = parseFloat(e.buy), qty = parseInt(e.qty)
    const next = { ...holdings }
    if (!buy || !qty) { delete next[symbol] } else { next[symbol] = { buy, qty } }
    setHoldings(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    setEditing(prev => { const n = { ...prev }; delete n[symbol]; return n })
  }

  const startEdit = (symbol) => {
    const h = holdings[symbol] || {}
    setEditing(prev => ({ ...prev, [symbol]: { buy: h.buy || '', qty: h.qty || '' } }))
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }
  const arrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''

  const enriched = pageItems.map(r => ({ ...r, ...(prices[r.symbol] || {}) }))
  const sorted = [...enriched].sort((a, b) => {
    if (sortConfig.key === 'companyName') {
      const an = a.companyName || a.symbol, bn = b.companyName || b.symbol
      return sortConfig.direction === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an)
    }
    const av = a[sortConfig.key] ?? -Infinity, bv = b[sortConfig.key] ?? -Infinity
    return sortConfig.direction === 'asc' ? av - bv : bv - av
  })

  const fmt = (n) => n != null ? n.toLocaleString('en-IN') : '0'

  const calcPnl = (symbol, price) => {
    const h = holdings[symbol]
    if (!h || !price) return {}
    const holding = parseFloat((h.buy * h.qty).toFixed(2))
    const portfolioToday = parseFloat((price * h.qty).toFixed(2))
    const pnl = parseFloat((portfolioToday - holding).toFixed(2))
    const pnlPct = parseFloat(((pnl / holding) * 100).toFixed(2))
    return { holding, portfolioToday, pnl, pnlPct }
  }

  // Summary across ALL held stocks — only count symbols where price is already cached
  const allHeldSymbols = Object.keys(holdings)
  const heldCount = allHeldSymbols.length
  const heldWithPrice = allHeldSymbols.filter(sym => prices[sym]?.price)
  const totalHolding = allHeldSymbols.reduce((s, sym) => s + (holdings[sym].buy * holdings[sym].qty), 0)
  const totalPortfolio = heldWithPrice.reduce((s, sym) => s + (prices[sym].price * holdings[sym].qty), 0)
  const pricesLoaded = heldWithPrice.length
  const totalPnl = totalPortfolio - (heldWithPrice.reduce((s, sym) => s + (holdings[sym].buy * holdings[sym].qty), 0))
  const totalPnlPct = totalHolding ? ((totalPnl / totalHolding) * 100).toFixed(2) : 0

  const inputStyle = { width: 100, fontSize: '14px', padding: '6px 12px', background: bg2, border: `1px solid ${border}`, color: text, borderRadius: 4 }

  const Pagination = () => totalPages <= 1 ? null : (
    <div className="d-flex align-items-center justify-content-between mt-3" style={{ fontSize: '13px' }}>
      <span style={{ color: textMuted }}>Page {page} of {totalPages}</span>
      <div className="d-flex gap-1">
        <button className="btn btn-outline-secondary" disabled={page === 1} onClick={() => setPage(1)}>«</button>
        <button className="btn btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
        {[...Array(Math.min(5, totalPages))].map((_, i) => {
          const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
          return p <= totalPages ? (
            <button key={p} className={`btn ${p === page ? 'btn-warning' : 'btn-outline-secondary'}`} onClick={() => setPage(p)}>{p}</button>
          ) : null
        })}
        <button className="btn btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
        <button className="btn btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <h5 className="fw-bold mb-0" style={{ color: text }}>
          <span>{filtered.length.toLocaleString()} Stocks</span>
        </h5>
          <div className="d-flex gap-2 ms-auto">
          <input
            className="form-control bg-white"
            style={{ width: 230, background: bg2, border: `1px solid ${border}`, color: text}}
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-select bg-white"
            style={{ width: 230, background: bg2, border: `1px solid ${border}`, color: text }}
            value={pctFilter}
            onChange={e => setPctFilter(Number(e.target.value))}
          >
            {PCT_OPTIONS.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {heldCount > 0 && (
        <div className="d-flex gap-2 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: 'Stocks', value: `${heldCount}`, color: text, size: '18px' },
            { label: 'Invested', value: `₹${fmt(Math.round(totalHolding))}`, color: text },
            { label: 'Current', value: pricesLoaded ? `₹${fmt(Math.round(totalPortfolio))}` : '...', color: text },
            { label: 'P&L', value: pricesLoaded ? `${totalPnl >= 0 ? '+' : ''}₹${fmt(Math.round(totalPnl))}` : '...', color: totalPnl >= 0 ? '#198754' : '#dc3545' },
            { label: 'Returns', value: pricesLoaded ? `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct}%` : '...', color: totalPnl >= 0 ? '#198754' : '#dc3545' },
          ].map(({ label, value, color, size }) => (
            <div key={label} className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '85px' }}>
              <div style={{ fontSize: '12px', color: textMuted }}>{label}</div>
              <div className="fw-bold" style={{ fontSize: size || '18px', color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {loadingList ? <SkeletonTable rows={10} cols={7} /> : (
        <>
          <div className="d-none d-md-block table-responsive">
            <table className="table table-hover">
              <thead className="table-dark">
                <tr>
                  <th onClick={() => handleSort('companyName')} style={{ cursor: 'pointer' }}>Company{arrow('companyName')}</th>
                  <th onClick={() => handleSort('price')} style={{ cursor: 'pointer' }} className="text-end">CMP{arrow('price')}</th>
                  <th onClick={() => handleSort('pChange')} style={{ cursor: 'pointer' }} className="text-end">Change%{arrow('pChange')}</th>
                  <th className="text-end">Buy</th>
                  <th className="text-end">Qty</th>
                  <th className="text-end">Holding</th>
                  <th className="text-end">Portfolio Today</th>
                  <th className="text-end">P&L</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const h = holdings[row.symbol]
                  const e = editing[row.symbol]
                  const { holding, portfolioToday, pnl, pnlPct } = calcPnl(row.symbol, row.price)
                  return (
                    <tr key={i} style={{ verticalAlign: 'middle', opacity: loadingPrices && !prices[row.symbol] ? 0.4 : 1 }}>
                      <td>
                        <div className="fw-bold">{row.companyName || row.symbol}</div>
                        <div style={{ fontSize: '11px', color: textMuted }}>{row.symbol}</div>
                      </td>
                      <td className="text-end fw-bold">{row.price ? `₹${fmt(row.price)}` : '0'}</td>
                      <td className="text-end fw-bold" style={{ color: row.pChange > 0 ? '#198754' : row.pChange < 0 ? '#dc3545' : undefined }}>
                        {row.pChange != null ? `${row.pChange >= 0 ? '+' : ''}${row.pChange}%` : '0'}
                      </td>
                      {e ? (
                        <>
                          <td className="text-end">
                            <input style={inputStyle} type="number" placeholder="Buy" value={e.buy}
                              onChange={ev => setEditing(prev => ({ ...prev, [row.symbol]: { ...prev[row.symbol], buy: ev.target.value } }))} />
                          </td>
                          <td className="text-end">
                            <input style={inputStyle} type="number" placeholder="Qty" value={e.qty}
                              onChange={ev => setEditing(prev => ({ ...prev, [row.symbol]: { ...prev[row.symbol], qty: ev.target.value } }))}
                              onKeyDown={ev => ev.key === 'Enter' && saveHolding(row.symbol)} />
                          </td>
                          <td colSpan={3} className="text-end">
                            <button className="btn btn-success me-1" style={{ padding: '2px 8px' }} onClick={() => saveHolding(row.symbol)}>Save</button>
                            <button className="btn btn-outline-secondary" style={{ padding: '2px 8px' }} onClick={() => setEditing(prev => { const n={...prev}; delete n[row.symbol]; return n })}>✕</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="text-end" style={{ cursor: 'pointer', color: h ? text : textMuted }} onClick={() => startEdit(row.symbol)}>
                            {h ? `₹${h.buy}` : <span>+ Add</span>}
                          </td>
                          <td className="text-end" style={{ cursor: 'pointer', color: h ? text : textMuted }} onClick={() => startEdit(row.symbol)}>
                            {h ? h.qty : '0'}
                          </td>
                          <td className="text-end">{holding != null ? `₹${fmt(holding)}` : '0'}</td>
                          <td className="text-end fw-bold">{portfolioToday != null ? `₹${fmt(portfolioToday)}` : '0'}</td>
                          <td className="text-end fw-bold" style={{ color: pnl >= 0 ? '#198754' : pnl < 0 ? '#dc3545' : undefined }}>
                            {pnl != null ? <>{pnl >= 0 ? '+' : ''}₹{fmt(pnl)}<small className="ms-1">({pnlPct >= 0 ? '+' : ''}{pnlPct}%)</small></> : '0'}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="d-md-none">
            {sorted.map((row, i) => {
              const h = holdings[row.symbol]
              const e = editing[row.symbol]
              const { holding, portfolioToday, pnl, pnlPct } = calcPnl(row.symbol, row.price)
              return (
                <div key={i} className="card mb-2 shadow-sm" style={{ background: bg2, border: `1px solid ${border}`, opacity: loadingPrices && !prices[row.symbol] ? 0.4 : 1 }}>
                  <div className="card-body py-2 px-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <div>
                        <div className="fw-bold" style={{ color: text, fontSize: '13px' }}>{row.companyName || row.symbol}</div>
                        <div style={{ fontSize: '11px', color: textMuted }}>{row.symbol}</div>
                      </div>
                      <div className="text-end">
                        <div className="fw-bold">{row.price ? `₹${fmt(row.price)}` : '0'}</div>
                        <div style={{ fontSize: '12px', color: row.pChange > 0 ? '#198754' : row.pChange < 0 ? '#dc3545' : textMuted }}>
                          {row.pChange != null ? `${row.pChange >= 0 ? '+' : ''}${row.pChange}%` : '0'}
                        </div>
                      </div>
                    </div>
                    {e ? (
                      <div className="d-flex gap-2 align-items-center mt-1">
                        <input style={{ ...inputStyle, width: 80 }} type="number" placeholder="Buy ₹" value={e.buy}
                          onChange={ev => setEditing(prev => ({ ...prev, [row.symbol]: { ...prev[row.symbol], buy: ev.target.value } }))} />
                        <input style={{ ...inputStyle, width: 70 }} type="number" placeholder="Qty" value={e.qty}
                          onChange={ev => setEditing(prev => ({ ...prev, [row.symbol]: { ...prev[row.symbol], qty: ev.target.value } }))} />
                        <button className="btn btn-success" onClick={() => saveHolding(row.symbol)}>Save</button>
                        <button className="btn btn-outline-secondary" onClick={() => setEditing(prev => { const n={...prev}; delete n[row.symbol]; return n })}>✕</button>
                      </div>
                    ) : (
                      <div className="row g-1 mt-1" style={{ fontSize: '12px' }}>
                        <div className="col-4" onClick={() => startEdit(row.symbol)} style={{ cursor: 'pointer' }}>
                          <small style={{ color: textMuted }}>Buy</small>
                          <div style={{ color: h ? text : '#ff6c00' }}>{h ? `₹${h.buy}` : '+ Add'}</div>
                        </div>
                        <div className="col-4"><small style={{ color: textMuted }}>Qty</small><div>{h ? h.qty : '0'}</div></div>
                        <div className="col-4"><small style={{ color: textMuted }}>Holding</small><div>{holding != null ? `₹${fmt(holding)}` : '0'}</div></div>
                        <div className="col-4"><small style={{ color: textMuted }}>Today</small><div className="fw-bold">{portfolioToday != null ? `₹${fmt(portfolioToday)}` : '0'}</div></div>
                        <div className="col-8"><small style={{ color: textMuted }}>P&L</small>
                          <div className="fw-bold" style={{ color: pnl >= 0 ? '#198754' : pnl < 0 ? '#dc3545' : undefined }}>
                            {pnl != null ? `${pnl >= 0 ? '+' : ''}₹${fmt(pnl)} (${pnlPct >= 0 ? '+' : ''}${pnlPct}%)` : '0'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination />
        </>
      )}
    </div>
  )
}

const PCT_OPTIONS = [
  { label: 'All Returns',   min: null, max: null },
  { label: '-100% – -1%',     min: -100,    max: -1   },
  { label: '0% – 50%',     min: 0,    max: 50   },
  { label: '51% – 100%',   min: 51,   max: 100  },
  { label: '101% – 200%',  min: 101,  max: 200  },
  { label: '201% – 300%',  min: 201,  max: 300  },
  { label: '301% – 400%',  min: 301,  max: 400  },
  { label: '401% – 500%',  min: 401,  max: 500  },
  { label: '501% – 600%',  min: 501,  max: 600  },
  { label: '601% – 700%',  min: 601,  max: 700  },
  { label: '701% – 800%',  min: 701,  max: 800  },
  { label: '801% – 900%',  min: 801,  max: 900  },
  { label: '901% – 1000%', min: 901,  max: 1000 },
  { label: '1001% – 10000%', min: 1001,  max: 10000 },
  { label: '10001% – 20000%', min: 10001,  max: 20000 },
]

function CovidPortfolio({ darkMode }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [stockSymbols, setStockSymbols] = useState(new Set())
  const [search, setSearch] = useState('')
  const [pctFilter, setPctFilter] = useState(0)

  const bg2 = darkMode ? '#16213e' : '#f8f9fa'
  const border = darkMode ? '#2a2a4a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'

  useEffect(() => {
    API.get('/api/stocks').then(r => setStockSymbols(new Set(r.data.map(s => s.symbol)))).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    API.get('/api/portfolio/live')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading || !data.length) return
    const isMarketOpen = () => {
      const now = new Date()
      const h = now.getHours(), m = now.getMinutes(), day = now.getDay()
      if (day === 0 || day === 6) return false
      const t = h * 60 + m
      return t >= 555 && t <= 930
    }
    if (!isMarketOpen()) return
    const interval = setInterval(() => {
      if (!isMarketOpen()) return
      API.get('/api/portfolio/prices')
        .then(r => {
          const priceMap = r.data
          setData(prev => prev.map(row => {
            const p = priceMap[row.name]
            if (!p || !p.price) return row
            const portfolioToday = parseFloat((p.price * row.qty).toFixed(2))
            const pnl = parseFloat((portfolioToday - row.holding).toFixed(2))
            const pnlPct = row.holding ? parseFloat(((pnl / row.holding) * 100).toFixed(2)) : 0
            return { ...row, lastPrice: p.price, pChange: p.pChange, portfolioToday, pnl, pnlPct }
          }))
        })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [loading, data.length])

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const pf = PCT_OPTIONS[pctFilter]
  const displayed = data.filter(row => {
    if (search && !row.name.toLowerCase().includes(search.toLowerCase())) return false
    const pnl = parseFloat(row.pnlPct)
    if (pf.min != null && (isNaN(pnl) || pnl < pf.min)) return false
    if (pf.max != null && (isNaN(pnl) || pnl > pf.max)) return false
    return true
  })

  const sorted = [...displayed].sort((a, b) => {
    if (!sortConfig.key) return 0
    if (sortConfig.key === 'name') return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    const av = a[sortConfig.key] ?? 0, bv = b[sortConfig.key] ?? 0
    return sortConfig.direction === 'asc' ? av - bv : bv - av
  })

  const arrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''

  const totalHolding = displayed.reduce((s, r) => s + (r.holding || 0), 0)
  const totalPortfolio = displayed.reduce((s, r) => s + (r.portfolioToday || 0), 0)
  const totalPnl = totalPortfolio - totalHolding
  const totalPnlPct = totalHolding ? ((totalPnl / totalHolding) * 100).toFixed(2) : 0

  const fmt = (n) => n != null ? n.toLocaleString('en-IN') : '-'

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
        <h5 className="fw-bold mb-0" style={{ color: text }}>
          Watchlist
        </h5>
        <div className="d-flex gap-2 ms-auto">
          <input
            className="form-control bg-white"
            style={{ width: 230, background: bg2, border: `1px solid ${border}`, color: text}}
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-select bg-white"
            style={{ width: 230, background: bg2, border: `1px solid ${border}`, color: text }}
            value={pctFilter}
            onChange={e => setPctFilter(Number(e.target.value))}
          >
            {PCT_OPTIONS.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {/* Summary cards for held stocks */}
      <div className="d-flex gap-2 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
        {[
          { label: 'Stocks', value: `${displayed.length}${displayed.length !== data.length ? `/${data.length}` : ''}`, color: text, size: '18px' },
          { label: 'Invested', value: `₹${fmt(Math.round(totalHolding))}`, color: text },
          { label: 'Current', value: `₹${fmt(Math.round(totalPortfolio))}`, color: text },
          { label: 'P&L', value: `${totalPnl >= 0 ? '+' : ''}₹${fmt(Math.round(totalPnl))}`, color: totalPnl >= 0 ? '#198754' : '#dc3545' },
          { label: 'Returns', value: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct}%`, color: totalPnl >= 0 ? '#198754' : '#dc3545' },
        ].map(({ label, value, color, size }) => (
          <div key={label} className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '85px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>{label}</div>
            <div className="fw-bold" style={{ fontSize: size || '18px', color }}>{value}</div>
          </div>
        ))}
      </div>

      {loading ? <SkeletonTable rows={8} cols={7} /> : (
        <>
          <div className="d-none d-md-block table-responsive">
            <table className="table table-hover" style={{ fontSize: '14px' }}>
              <thead className="table-dark">
                <tr style={{ verticalAlign: 'middle' }}>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Name{arrow('name')}</th>
                  <th onClick={() => handleSort('buy')} style={{ cursor: 'pointer' }} className="text-end">Buy{arrow('buy')}</th>
                  <th onClick={() => handleSort('qty')} style={{ cursor: 'pointer' }} className="text-end">Qty{arrow('qty')}</th>
                  <th onClick={() => handleSort('lastPrice')} style={{ cursor: 'pointer' }} className="text-end">Last Price{arrow('lastPrice')}</th>
                  <th onClick={() => handleSort('holding')} style={{ cursor: 'pointer' }} className="text-end">Holding{arrow('holding')}</th>
                  <th onClick={() => handleSort('portfolioToday')} style={{ cursor: 'pointer' }} className="text-end">Portfolio Today{arrow('portfolioToday')}</th>
                  <th onClick={() => handleSort('pnlPct')} style={{ cursor: 'pointer' }} className="text-end">P&L{arrow('pnlPct')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => (
                  <tr key={i} style={{ verticalAlign: 'middle' }}>
                    <td className="fw-bold" style={{ color: stockSymbols.has(row.name) ? '#ff6c00' : undefined }}>{row.name}</td>
                    <td className="text-end">₹{row.buy}</td>
                    <td className="text-end">{row.qty}</td>
                    <td className="text-end fw-bold" style={{ color: row.pChange >= 0 ? '#198754' : '#dc3545' }}>
                      ₹{row.lastPrice || '-'}
                      {row.pChange != null && <small className="ms-1">({row.pChange >= 0 ? '+' : ''}{row.pChange}%)</small>}
                    </td>
                    <td className="text-end">₹{fmt(row.holding)}</td>
                    <td className="text-end fw-bold">₹{fmt(row.portfolioToday)}</td>
                    <td className="text-end fw-bold" style={{ color: row.pnl >= 0 ? '#198754' : '#dc3545' }}>
                      {row.pnl >= 0 ? '+' : ''}₹{fmt(row.pnl)}
                      <small className="ms-1">({row.pnlPct >= 0 ? '+' : ''}{row.pnlPct}%)</small>
                    </td>
                  </tr>
                ))}
                <tr className="table-active fw-bold" style={{ verticalAlign: 'middle' }}>
                  <td>TOTAL</td><td></td><td></td><td></td>
                  <td className="text-end">₹{fmt(Math.round(totalHolding))}</td>
                  <td className="text-end">₹{fmt(Math.round(totalPortfolio))}</td>
                  <td className="text-end" style={{ color: totalPnl >= 0 ? '#198754' : '#dc3545' }}>
                    {totalPnl >= 0 ? '+' : ''}₹{fmt(Math.round(totalPnl))}
                    <small className="ms-1">({totalPnlPct >= 0 ? '+' : ''}{totalPnlPct}%)</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="d-md-none">
            {sorted.map((row, i) => (
              <div key={i} className="card mb-2 shadow-sm" style={{ background: bg2, border: `1px solid ${border}` }}>
                <div className="card-body py-2 px-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-bold" style={{ color: stockSymbols.has(row.name) ? '#ff6c00' : text }}>{row.name}</span>
                    <span className="fw-bold" style={{ color: row.pnl >= 0 ? '#198754' : '#dc3545', fontSize: '13px' }}>
                      {row.pnl >= 0 ? '+' : ''}{row.pnlPct}%
                    </span>
                  </div>
                  <div className="row g-1" style={{ fontSize: '13px' }}>
                    <div className="col-4"><small style={{ color: textMuted }}>Buy</small><div>₹{row.buy}</div></div>
                    <div className="col-4"><small style={{ color: textMuted }}>Qty</small><div>{row.qty}</div></div>
                    <div className="col-4"><small style={{ color: textMuted }}>LTP</small><div className="fw-bold" style={{ color: row.pChange >= 0 ? '#198754' : '#dc3545' }}>₹{row.lastPrice}</div></div>
                    <div className="col-4"><small style={{ color: textMuted }}>Holding</small><div>₹{fmt(row.holding)}</div></div>
                    <div className="col-4"><small style={{ color: textMuted }}>Today</small><div className="fw-bold">₹{fmt(row.portfolioToday)}</div></div>
                    <div className="col-4"><small style={{ color: textMuted }}>P&L</small><div className="fw-bold" style={{ color: row.pnl >= 0 ? '#198754' : '#dc3545' }}>{row.pnl >= 0 ? '+' : ''}₹{fmt(row.pnl)}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState('allstocks')
  const { darkMode } = useTheme()

  const border = darkMode ? '#2a2a4a' : '#e9ecef'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'

  const tabs = [
    { key: 'allstocks', label: 'All Stocks Covid' },
    { key: 'covid', label: 'Portfolio' },
  ]

  return (
    <>
      <Helmet><title>Portfolio - TradingSignals</title></Helmet>
      <div className="p-1">
        <div className="d-flex mb-3" style={{ borderBottom: `2px solid ${border}` }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #ff6c00' : '2px solid transparent',
                marginBottom: '-2px',
                padding: '6px 16px',
                fontWeight: activeTab === tab.key ? 700 : 400,
                color: activeTab === tab.key ? '#ff6c00' : textMuted,
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'allstocks' && <AllStocks darkMode={darkMode} />}
        {activeTab === 'covid' && <CovidPortfolio darkMode={darkMode} />}
      </div>
    </>
  )
}
