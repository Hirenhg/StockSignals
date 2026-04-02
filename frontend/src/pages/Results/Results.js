import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable } from '../../components/Skeleton/Skeleton'
import { useTheme } from '../../context/ThemeContext'

const gold = '#dfb938'

const fmt = (val) => {
  if (val == null) return '-'
  const abs = Math.abs(val)
  if (abs >= 1e9) return `₹${(val / 1e9).toFixed(2)}B`
  if (abs >= 1e7) return `₹${(val / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `₹${(val / 1e5).toFixed(2)}L`
  return `₹${val.toLocaleString('en-IN')}`
}

const OverallBadge = ({ overall }) => {
  const map = { Strong: '#198754', Decent: '#0d6efd', Stable: '#f9a825', Neutral: '#6c757d', Weak: '#dc3545' }
  return <span className="fw-bold" style={{ color: map[overall] || '#6c757d' }}>{overall}</span>
}

const GrowthVal = ({ val, suffix = '%' }) => {
  if (val == null) return <span className="text-muted">-</span>
  return <span style={{ color: val > 0 ? '#198754' : val < 0 ? '#dc3545' : undefined, fontWeight: 600 }}>{val > 0 ? '+' : ''}{val}{suffix}</span>
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtDateShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export default function Results() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState({ key: 'earningsDate', direction: 'asc' })
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const { darkMode } = useTheme()

  const bg2 = darkMode ? '#262626' : '#f8f9fa'
  const border = darkMode ? '#3a3a3a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'

  useEffect(() => {
    setLoading(true)
    API.get('/api/results')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const arrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''

  const today = new Date().toISOString().slice(0, 10)

  // Only show future earnings dates
  const isFutureDate = (d) => d && d >= today

  const sorted = [...data]
    .filter(r => filter === 'All' || r.overall === filter)
    .filter(r => !search || r.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortConfig.key) return 0
      if (sortConfig.key === 'symbol') return sortConfig.direction === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol)
      if (sortConfig.key === 'earningsDate') {
        const av = isFutureDate(a.earningsDate) ? a.earningsDate : '9999-12-31'
        const bv = isFutureDate(b.earningsDate) ? b.earningsDate : '9999-12-31'
        return sortConfig.direction === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      if (sortConfig.key === 'overall') {
        const order = { Strong: 1, Decent: 2, Stable: 3, Neutral: 4, Weak: 5 }
        return sortConfig.direction === 'asc' ? (order[a.overall] || 6) - (order[b.overall] || 6) : (order[b.overall] || 6) - (order[a.overall] || 6)
      }
      const av = a[sortConfig.key] ?? -Infinity, bv = b[sortConfig.key] ?? -Infinity
      return sortConfig.direction === 'asc' ? av - bv : bv - av
    })

  const stats = data.reduce((acc, r) => { acc[r.overall] = (acc[r.overall] || 0) + 1; return acc }, {})

  // Upcoming results — only future dates
  const upcoming = data.filter(r => isFutureDate(r.earningsDate))
    .sort((a, b) => a.earningsDate.localeCompare(b.earningsDate))

  return (
    <>
      <Helmet><title>Quarterly Results - StockSignal</title></Helmet>
      <div className="p-1">
        <h5 className="fw-bold mb-0" style={{ color: text }}>Quarterly Results {data.length > 0 && <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: 600, verticalAlign: 'middle' }}>● LIVE</span>}</h5>
        <div className="mb-3" style={{ fontSize: '12px', color: textMuted }}>Revenue, Net Profit, Operating Margin, Dividend & Overall Assessment</div>

        {/* Summary Cards */}
        <div className="d-flex gap-2 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          {['Strong', 'Decent', 'Stable', 'Neutral', 'Weak'].map(s => {
            const colorMap = { Strong: '#198754', Decent: '#0d6efd', Stable: '#f9a825', Neutral: '#6c757d', Weak: '#dc3545' }
            return (
              <div key={s} className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
                <div style={{ fontSize: '12px', color: colorMap[s], fontWeight: 600 }}>{s}</div>
                <div className="fw-bold" style={{ fontSize: '20px', color: text }}>{stats[s] || 0}</div>
              </div>
            )
          })}
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '85px' }}>
            <div style={{ fontSize: '12px', color: gold, fontWeight: 600 }}>Upcoming</div>
            <div className="fw-bold" style={{ fontSize: '20px', color: text }}>{upcoming.length}</div>
          </div>
        </div>

        {/* Upcoming Results Banner */}
        {upcoming.length > 0 && (
          <div className="mb-3 rounded-3 p-3" style={{ background: darkMode ? '#2a2510' : '#fdf8e8', border: `1px solid ${darkMode ? '#4a3d10' : '#f0e4a8'}` }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span style={{ fontSize: '18px' }}>📅</span>
              <span className="fw-bold" style={{ fontSize: '15px', color: gold }}>Upcoming Results</span>
              <span className="rounded-pill px-2" style={{ fontSize: '11px', background: gold, color: '#171717', fontWeight: 700 }}>{upcoming.length}</span>
            </div>
            <div className="d-flex gap-2 overflow-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {upcoming.slice(0, 15).map(r => (
                <div key={r.symbol} className="flex-shrink-0 rounded-3 px-3 py-2 text-center" style={{ background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid ${border}`, minWidth: '100px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="fw-bold" style={{ fontSize: '14px', color: text }}>{r.symbol}</div>
                  <div className="fw-bold mt-1" style={{ fontSize: '13px', color: gold }}>{fmtDateShort(r.earningsDate)}</div>
                  {r.forwardEps && <div style={{ fontSize: '11px', color: textMuted, marginTop: '2px' }}>EPS: ₹{r.forwardEps.toFixed(2)}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="d-flex gap-2 mb-3">
          <input className="form-control" placeholder="Search symbol..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '200px' }} />
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="All">All ({data.length})</option>
            <option value="Strong">Strong ({stats.Strong || 0})</option>
            <option value="Decent">Decent ({stats.Decent || 0})</option>
            <option value="Stable">Stable ({stats.Stable || 0})</option>
            <option value="Weak">Weak ({stats.Weak || 0})</option>
          </select>
        </div>

        {loading ? <SkeletonTable rows={10} cols={9} /> : (
          <>
            {/* Desktop Table */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover" style={{ fontSize: '14px' }}>
                <thead className="table-dark">
                  <tr style={{ verticalAlign: 'middle' }}>
                    <th onClick={() => handleSort('symbol')} style={{ cursor: 'pointer' }}>Symbol{arrow('symbol')}</th>
                    <th onClick={() => handleSort('earningsDate')} style={{ cursor: 'pointer' }}>Next Result{arrow('earningsDate')}</th>
                    <th onClick={() => handleSort('revenue')} style={{ cursor: 'pointer' }}>Revenue{arrow('revenue')}</th>
                    <th onClick={() => handleSort('netProfit')} style={{ cursor: 'pointer' }}>Net Profit{arrow('netProfit')}</th>
                    <th onClick={() => handleSort('operatingMargin')} style={{ cursor: 'pointer' }}>Op. Margin{arrow('operatingMargin')}</th>
                    <th onClick={() => handleSort('profitMargin')} style={{ cursor: 'pointer' }}>Profit Margin{arrow('profitMargin')}</th>
                    <th onClick={() => handleSort('dividendYield')} style={{ cursor: 'pointer' }}>Div Yield{arrow('dividendYield')}</th>
                    <th onClick={() => handleSort('revenueGrowth')} style={{ cursor: 'pointer' }}>Rev Growth{arrow('revenueGrowth')}</th>
                    <th onClick={() => handleSort('earningsGrowth')} style={{ cursor: 'pointer' }}>Earn Growth{arrow('earningsGrowth')}</th>
                    <th onClick={() => handleSort('overall')} style={{ cursor: 'pointer' }}>Overall{arrow('overall')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={i} style={{ verticalAlign: 'middle' }}>
                      <td className="fw-bold">{r.symbol}</td>
                      <td>{isFutureDate(r.earningsDate) ? <span className="fw-bold" style={{ color: gold }}>{fmtDate(r.earningsDate)}</span> : <span className="text-muted">-</span>}</td>
                      <td>{fmt(r.revenue)}</td>
                      <td style={{ color: r.netProfit > 0 ? '#198754' : r.netProfit < 0 ? '#dc3545' : undefined }}>{fmt(r.netProfit)}</td>
                      <td><GrowthVal val={r.operatingMargin} /></td>
                      <td><GrowthVal val={r.profitMargin} /></td>
                      <td>{r.dividendYield != null ? <span style={{ color: gold }}>{r.dividendYield}%</span> : <span className="text-muted">-</span>}</td>
                      <td><GrowthVal val={r.revenueGrowth} /></td>
                      <td><GrowthVal val={r.earningsGrowth} /></td>
                      <td><OverallBadge overall={r.overall} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="d-md-none">
              {sorted.map((r, i) => (
                <div key={i} className="card mb-3 shadow-sm rounded-3" style={{ background: bg2, border: `1px solid ${border}` }}>
                  <div className="card-body p-3">
                    {/* Header */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="fw-bold" style={{ fontSize: '18px', color: text, letterSpacing: '0.5px' }}>{r.symbol}</div>
                      <span className="rounded-pill px-2 py-1" style={{ fontSize: '12px', fontWeight: 700, background: { Strong: '#19875420', Decent: '#0d6efd20', Stable: '#f9a82520', Neutral: '#6c757d20', Weak: '#dc354520' }[r.overall], color: { Strong: '#198754', Decent: '#0d6efd', Stable: '#f9a825', Neutral: '#6c757d', Weak: '#dc3545' }[r.overall] }}>{r.overall}</span>
                    </div>

                    {/* Next Result Date */}
                    {isFutureDate(r.earningsDate) && (
                      <div className="d-flex align-items-center gap-2 mb-3 rounded-3 px-3 py-2" style={{ background: darkMode ? '#2a2510' : '#fdf8e8', border: `1px solid ${darkMode ? '#4a3d10' : '#f0e4a8'}` }}>
                        <span style={{ fontSize: '16px' }}>📅</span>
                        <div>
                          <div style={{ fontSize: '11px', color: textMuted, lineHeight: 1 }}>Next Result</div>
                          <div className="fw-bold" style={{ fontSize: '15px', color: gold }}>{fmtDate(r.earningsDate)}</div>
                        </div>
                        {r.forwardEps && <div className="ms-auto text-end"><div style={{ fontSize: '10px', color: textMuted }}>Fwd EPS</div><div className="fw-bold" style={{ fontSize: '14px', color: text }}>₹{r.forwardEps.toFixed(2)}</div></div>}
                      </div>
                    )}

                    {/* Revenue & Net Profit */}
                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <div className="rounded-3 p-2 text-center" style={{ background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid ${border}` }}>
                          <div style={{ fontSize: '11px', color: textMuted, marginBottom: '2px' }}>Revenue</div>
                          <div className="fw-bold" style={{ fontSize: '17px', color: text }}>{fmt(r.revenue)}</div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="rounded-3 p-2 text-center" style={{ background: darkMode ? '#1a1a1a' : '#fff', border: `1px solid ${border}` }}>
                          <div style={{ fontSize: '11px', color: textMuted, marginBottom: '2px' }}>Net Profit</div>
                          <div className="fw-bold" style={{ fontSize: '17px', color: r.netProfit > 0 ? '#198754' : r.netProfit < 0 ? '#dc3545' : text }}>{fmt(r.netProfit)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="row g-2">
                      <div className="col-3 text-center">
                        <div style={{ fontSize: '11px', color: textMuted, marginBottom: '4px' }}>Op Margin</div>
                        <div style={{ fontSize: '15px' }}><GrowthVal val={r.operatingMargin} /></div>
                      </div>
                      <div className="col-3 text-center">
                        <div style={{ fontSize: '11px', color: textMuted, marginBottom: '4px' }}>Dividend</div>
                        <div style={{ fontSize: '15px', color: gold, fontWeight: 600 }}>{r.dividendYield != null ? `${r.dividendYield}%` : '-'}</div>
                      </div>
                      <div className="col-3 text-center">
                        <div style={{ fontSize: '11px', color: textMuted, marginBottom: '4px' }}>Rev Gr.</div>
                        <div style={{ fontSize: '15px' }}><GrowthVal val={r.revenueGrowth} /></div>
                      </div>
                      <div className="col-3 text-center">
                        <div style={{ fontSize: '11px', color: textMuted, marginBottom: '4px' }}>Earn Gr.</div>
                        <div style={{ fontSize: '15px' }}><GrowthVal val={r.earningsGrowth} /></div>
                      </div>
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
