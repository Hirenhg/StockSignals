import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable } from '../../components/Skeleton/Skeleton'
import { useTheme } from '../../context/ThemeContext'

export default function Portfolio() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const { darkMode } = useTheme()

  const bg2 = darkMode ? '#16213e' : '#f8f9fa'
  const border = darkMode ? '#2a2a4a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'

  useEffect(() => {
    setLoading(true)
    API.get('/api/portfolio/live')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Auto-refresh prices every 30s during market hours
  useEffect(() => {
    if (loading || !data.length) return
    const isMarketOpen = () => {
      const now = new Date()
      const h = now.getHours(), m = now.getMinutes()
      const day = now.getDay()
      if (day === 0 || day === 6) return false
      const t = h * 60 + m
      return t >= 555 && t <= 930 // 9:15 AM - 3:30 PM
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

  const sorted = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0
    if (sortConfig.key === 'name') return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    const av = a[sortConfig.key] ?? 0, bv = b[sortConfig.key] ?? 0
    return sortConfig.direction === 'asc' ? av - bv : bv - av
  })

  const arrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''

  const totalHolding = data.reduce((s, r) => s + (r.holding || 0), 0)
  const totalPortfolio = data.reduce((s, r) => s + (r.portfolioToday || 0), 0)
  const totalPnl = totalPortfolio - totalHolding
  const totalPnlPct = totalHolding ? ((totalPnl / totalHolding) * 100).toFixed(2) : 0

  const fmt = (n) => n != null ? n.toLocaleString('en-IN') : '-'

  return (
    <>
      <Helmet><title>COVID Portfolio - StockSignal</title></Helmet>
      <div className="p-1">
        <h5 className="fw-bold mb-0" style={{ color: text }}>COVID Portfolio {data.length > 0 && <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: 600, verticalAlign: 'middle' }}>● LIVE</span>}</h5>
        <div className="mb-3" style={{ fontSize: '12px', color: textMuted }}>Stocks bought during COVID period · Live prices from Google Finance</div>

        <div className="d-flex gap-2 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '85px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>Stocks</div>
            <div className="fw-bold" style={{ fontSize: '20px', color: text }}>{data.length}</div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '100px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>Invested</div>
            <div className="fw-bold" style={{ fontSize: '18px', color: text }}>₹{fmt(Math.round(totalHolding))}</div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '100px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>Current</div>
            <div className="fw-bold" style={{ fontSize: '18px', color: text }}>₹{fmt(Math.round(totalPortfolio))}</div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '100px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>P&L</div>
            <div className="fw-bold" style={{ fontSize: '18px', color: totalPnl >= 0 ? '#198754' : '#dc3545' }}>
              {totalPnl >= 0 ? '+' : ''}₹{fmt(Math.round(totalPnl))}
            </div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '85px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>Returns</div>
            <div className="fw-bold" style={{ fontSize: '18px', color: totalPnl >= 0 ? '#198754' : '#dc3545' }}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct}%
            </div>
          </div>
        </div>

        {loading ? <SkeletonTable rows={8} cols={7} /> : (
          <>
            {/* Desktop Table */}
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
                      <td className="fw-bold">{row.name}</td>
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
                  {/* Totals Row */}
                  <tr className="table-active fw-bold" style={{ verticalAlign: 'middle' }}>
                    <td>TOTAL</td>
                    <td></td>
                    <td></td>
                    <td></td>
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

            {/* Mobile Cards */}
            <div className="d-md-none">
              {sorted.map((row, i) => (
                <div key={i} className="card mb-2 shadow-sm" style={{ background: bg2, border: `1px solid ${border}` }}>
                  <div className="card-body py-2 px-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-bold" style={{ color: text }}>{row.name}</span>
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
    </>
  )
}
