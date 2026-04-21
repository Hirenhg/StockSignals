import { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import API from "../../services/api"
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton/Skeleton"

const pnlColor = (val) => val > 0 ? '#198754' : val < 0 ? '#dc3545' : '#6c757d'

let clientCache = { data: null, date: null }

function HistoryTracker() {
  const today = new Date().toISOString().slice(0, 10)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [symbolFilter, setSymbolFilter] = useState('all')
  const [tab, setTab] = useState('stocks')

  useEffect(() => {
    if (clientCache.data && clientCache.date === today) { setData(clientCache.data); setLoading(false); return }
    API.get('/api/history-tracker?refresh=1')
      .then(res => { clientCache = { data: res.data, date: today }; setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [today])

  if (loading) return <div className="p-1"><SkeletonCards count={4} /><SkeletonTable rows={8} cols={10} /></div>
  if (!data) return <div className="text-center text-muted py-5">Failed to load data</div>

  const section = data[tab] || { hits: [], targetCount: 0, slCount: 0, total: 0 }
  const symbols = [...new Set(section.hits.map(h => h.symbol))]

  const filtered = section.hits.filter(h => {
    const matchSearch = h.symbol.toLowerCase().includes(search.toLowerCase()) || h.date.includes(search)
    const matchFilter = filter === 'all' || h.result === filter
    const matchSymbol = symbolFilter === 'all' || h.symbol === symbolFilter
    return matchSearch && matchFilter && matchSymbol
  })

  const activeHits = symbolFilter === 'all' ? section.hits : section.hits.filter(h => h.symbol === symbolFilter)
  const targetCount = activeHits.filter(h => h.result === 'TARGET').length
  const slCount = activeHits.filter(h => h.result === 'SL').length
  const total = activeHits.length
  const totalPnl = activeHits.reduce((s, h) => s + h.pnlPct, 0)
  const winRate = total ? ((targetCount / total) * 100).toFixed(1) : 0

  const switchTab = (t) => { setTab(t); setSymbolFilter('all'); setFilter('all'); setSearch('') }

  return (
    <>
      <Helmet><title>History Tracker - TradingSignals</title></Helmet>
      <div className="p-1">
        <h4 className="fw-bold mb-2">📊 History Tracker</h4>

        <p className="text-muted mb-3" style={{ fontSize: 13 }}>
          {tab === 'stocks' ? 'Target 2% / SL 1% — CSV + Nifty 50, Next 50 & Watchlist (3mo)' : 'Target 30% / SL 10% — Real option prices (auto-recorded daily)'}
        </p>

        <div className="d-flex gap-2 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: 'Total', value: total, bg: '#0d6efd' },
            { label: 'Target', value: targetCount, bg: '#198754' },
            { label: 'SL', value: slCount, bg: '#dc3545' },
            { label: 'Win %', value: `${winRate}%`, bg: '#6f42c1' },
            { label: 'P&L', value: `${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(1)}%`, bg: pnlColor(totalPnl) },
          ].map((c, i) => (
            <div key={i} className="flex-shrink-0 text-center rounded px-3 py-2" style={{ background: c.bg, color: '#fff', minWidth: '80px' }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{c.label}</div>
              <div className="fw-bold" style={{ fontSize: 20 }}>{c.value}</div>
            </div>
          ))}
        </div>
        {/* Stocks / Options Tabs */}
        <div className="d-flex gap-2 mb-3">
          <button className={`btn ${tab === 'stocks' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => switchTab('stocks')}>
             Stocks 
          </button>
          <button className={`btn ${tab === 'options' ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => switchTab('options')}>
             Options
          </button>
        </div>
        {/* Filters Row */}
        <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
          <select className="form-select" style={{ width: 'auto', minWidth: 150, paddingRight: 32 }} value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)}>
            <option value="all">All ({symbols.length})</option>
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="position-relative" style={{ maxWidth: 180 }}>
            <input className="form-control" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted p-0 me-2 text-decoration-none" onClick={() => setSearch('')} style={{ fontSize: 13, lineHeight: 1 }}>✕</button>}
          </div>
          {['all', 'TARGET', 'SL'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? `All (${total})` : f === 'TARGET' ? `Target (${targetCount})` : `SL (${slCount})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 && <div className="text-center text-muted py-5"><div style={{ fontSize: 48 }}>📋</div><h5 className="mt-2">No {tab} history found</h5></div>}

        {/* Desktop Table */}
        {filtered.length > 0 && (
          <div className="d-none d-md-block table-responsive">
            <table className="table table-hover" style={{ fontSize: 13 }}>
              <thead className="table-dark">
                <tr>
                  <th>Symbol</th><th>Entry Date</th><th>Exit Date</th><th>Signal</th><th>Entry</th>
                  <th style={{ color: '#198754' }}>Target</th><th style={{ color: '#dc3545' }}>SL</th>
                  <th>Exit</th><th>Result</th><th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => (
                  <tr key={i} style={{ background: h.result === 'TARGET' ? 'rgba(25,135,84,0.05)' : 'rgba(220,53,69,0.05)' }}>
                    <td className="fw-bold">{h.symbol}</td>
                    <td>{h.date}</td>
                    <td>{h.exitDate}</td>
                    <td><span className={`badge ${h.signal === 'BUY' ? 'bg-success' : 'bg-danger'}`}>{h.signal}</span></td>
                    <td>₹{h.entry.toFixed(2)}</td>
                    <td style={{ color: '#198754', fontWeight: 'bold' }}>₹{h.target}</td>
                    <td style={{ color: '#dc3545', fontWeight: 'bold' }}>₹{h.sl}</td>
                    <td className="fw-bold">₹{h.exitPrice}</td>
                    <td><span className={h.result === 'TARGET' ? 'text-success' : 'text-danger'}>{h.result === 'TARGET' ? 'Target' : 'SL'}</span></td>
                    <td style={{ color: pnlColor(h.pnlPct), fontWeight: 'bold' }}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Cards */}
        {filtered.length > 0 && (
          <div className="d-md-none" style={{ paddingBottom: 80 }}>
            {filtered.map((h, i) => (
              <div key={i} className="card mb-3 shadow-sm" style={{ borderLeft: `5px solid ${h.result === 'TARGET' ? '#198754' : '#dc3545'}` }}>
                <div className="card-body px-3 py-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h6 className="fw-bold mb-0">{h.symbol}</h6>
                      <small className="text-muted">{h.date} → {h.exitDate}</small>
                    </div>
                    <span className={`badge rounded-pill px-3 py-2 ${h.result === 'TARGET' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: 13 }}>
                      {h.result === 'TARGET' ? 'Target' : 'SL'}
                    </span>
                  </div>
                  <div className="mb-2 text-center py-2 rounded" style={{ background: h.result === 'TARGET' ? 'rgba(25,135,84,0.08)' : 'rgba(220,53,69,0.08)' }}>
                    <span className="text-muted" style={{ fontSize: 14 }}>P&L</span>
                    <h4 className="fw-bold mb-0" style={{ color: pnlColor(h.pnlPct) }}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct}%</h4>
                  </div>
                  <div className="row g-2">
                    <div className="col-4"><small className="text-muted d-block">Signal</small><span className={`badge ${h.signal === 'BUY' ? 'bg-success' : 'bg-danger'}`}>{h.signal}</span></div>
                    <div className="col-4"><small className="text-muted d-block">Entry</small><strong>₹{h.entry.toFixed(2)}</strong></div>
                    <div className="col-4"><small className="text-muted d-block">Exit</small><strong>₹{h.exitPrice}</strong></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default HistoryTracker
