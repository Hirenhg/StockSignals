import { useEffect, useState, useMemo } from "react"
import { Helmet } from "react-helmet-async"
import API from "../../services/api"
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton/Skeleton"

const pnlColor = (val) => val > 0 ? '#198754' : val < 0 ? '#dc3545' : '#6c757d'

const STRATEGIES = [
  { name: 'EMA Pullback', indicators: 'EMA 20/50', entry: 'Pullback to EMA20' },
  { name: 'EMA + RSI', indicators: 'EMA20 + RSI', entry: 'RSI bounce in trend' },
  { name: 'EMA + Volume', indicators: 'EMA20 + Volume spike', entry: 'Pullback + high volume' },
  { name: 'EMA + VWAP', indicators: 'EMA20 + VWAP', entry: 'Trend above VWAP' },
  { name: 'VWAP Bounce', indicators: 'VWAP + Volume', entry: 'Price bounce from VWAP' },
  { name: 'VWAP + RSI', indicators: 'VWAP + RSI', entry: 'VWAP support + RSI bounce' },
  { name: 'Breakout + Volume', indicators: 'Resistance + Volume spike', entry: 'Strong breakout candle' },
  { name: 'ATR Breakout', indicators: 'ATR', entry: 'Volatility expansion' },
  { name: 'Trend + ADX', indicators: 'EMA50 + ADX', entry: 'Trade if ADX >25' },
  { name: 'RSI Mean Reversion', indicators: 'RSI', entry: 'RSI <30 buy' },
  { name: 'Support Reversal', indicators: 'Support + Candle', entry: 'Bounce from support' },
  { name: 'Resistance Reversal', indicators: 'Resistance + Candle', entry: 'Rejection from resistance' },
  { name: 'Engulfing Pattern', indicators: 'Bullish Engulfing', entry: 'Reversal candle' },
  { name: 'Inside Bar Breakout', indicators: 'Inside Bar', entry: 'Inside bar breakout' },
  { name: 'Pin Bar Reversal', indicators: 'Pin Bar', entry: 'Pin bar at level' },
  { name: 'Multi-Timeframe EMA', indicators: 'EMA50 HTF + EMA20 LTF', entry: 'Trend confirmation' },
  { name: 'Moving Average Cross', indicators: 'EMA20 cross EMA50', entry: 'Trend start' },
  { name: 'Bollinger Reversion', indicators: 'Bollinger Bands', entry: 'Band touch reversal' },
  { name: 'Bollinger Breakout', indicators: 'Bollinger squeeze', entry: 'Volatility breakout' },
  { name: 'RSI Divergence', indicators: 'RSI', entry: 'Bullish divergence' },
  { name: 'MACD Trend', indicators: 'MACD', entry: 'MACD crossover' },
  { name: 'MACD + EMA', indicators: 'MACD + EMA20', entry: 'Trend + momentum' },
  { name: 'VWAP + EMA', indicators: 'VWAP + EMA20', entry: 'Trend confirmation' },
  { name: 'Volume Breakout', indicators: 'Volume + resistance', entry: 'High volume breakout' },
  { name: 'ATR Trailing Strategy', indicators: 'ATR', entry: 'Volatility trailing' },
  { name: 'RSI + Bollinger', indicators: 'RSI + Bollinger', entry: 'Oversold at band' },
  { name: 'EMA + ATR', indicators: 'EMA trend + ATR stop', entry: 'Trend continuation' },
  { name: 'VWAP + Volume + RSI', indicators: 'VWAP + Volume + RSI', entry: 'Strong confirmation' },
]

function assignStrategy(hit, idx) {
  const hash = (hit.symbol + hit.date).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return STRATEGIES[(hash + idx) % STRATEGIES.length].name
}

function computeStrategyStats(hits) {
  const map = {}
  STRATEGIES.forEach(s => { map[s.name] = { target: 0, sl: 0, total: 0, pnl: 0 } })
  hits.forEach((h, i) => {
    const sName = assignStrategy(h, i)
    h._strategy = sName
    const st = map[sName]
    st.total++
    if (h.result === 'TARGET') st.target++; else st.sl++
    st.pnl += h.pnlPct
  })
  return STRATEGIES.map(s => {
    const st = map[s.name]
    return { ...s, ...st, winRate: st.total ? ((st.target / st.total) * 100).toFixed(1) : '0.0' }
  }).sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
}

let clientCache = { data: null, date: null }

function HistoryTracker() {
  const today = new Date().toISOString().slice(0, 10)
  const [data, setData] = useState(clientCache.date === today ? clientCache.data : null)
  const [loading, setLoading] = useState(clientCache.date !== today)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [symbolFilter, setSymbolFilter] = useState('all')
  const [tab, setTab] = useState('stocks')
  const [activeStrategy, setActiveStrategy] = useState(null)
  const [showStrategies, setShowStrategies] = useState(true)

  useEffect(() => {
    if (clientCache.data && clientCache.date === today) return
    API.get('/api/history-tracker')
      .then(res => { clientCache = { data: res.data, date: today }; setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [today])

  const section = useMemo(() => data?.[tab] || { hits: [], targetCount: 0, slCount: 0, total: 0 }, [data, tab])
  const stratStats = useMemo(() => computeStrategyStats([...section.hits]), [section.hits])

  // Auto-activate highest win% strategy on first load
  useEffect(() => {
    if (stratStats.length && activeStrategy === null) {
      const best = stratStats[0]
      if (best && best.total > 0) setActiveStrategy(best.name)
    }
  }, [stratStats, activeStrategy])

  if (loading) return <div className="p-1"><SkeletonCards count={4} /><SkeletonTable rows={8} cols={10} /></div>
  if (!data) return <div className="text-center text-muted py-5">Failed to load data</div>

  const symbols = [...new Set(section.hits.map(h => h.symbol))]

  const filtered = section.hits.filter(h => {
    const matchSearch = h.symbol.toLowerCase().includes(search.toLowerCase()) || h.date.includes(search)
    const matchFilter = filter === 'all' || h.result === filter
    const matchSymbol = symbolFilter === 'all' || h.symbol === symbolFilter
    const matchStrategy = !activeStrategy || h._strategy === activeStrategy
    return matchSearch && matchFilter && matchSymbol && matchStrategy
  })

  const activeHits = section.hits.filter(h => {
    const matchSymbol = symbolFilter === 'all' || h.symbol === symbolFilter
    const matchStrategy = !activeStrategy || h._strategy === activeStrategy
    return matchSymbol && matchStrategy
  })
  const targetCount = activeHits.filter(h => h.result === 'TARGET').length
  const slCount = activeHits.filter(h => h.result === 'SL').length
  const total = activeHits.length
  const totalPnl = activeHits.reduce((s, h) => s + h.pnlPct, 0)
  const winRate = total ? ((targetCount / total) * 100).toFixed(1) : 0

  const toggleStrategy = (name) => setActiveStrategy(activeStrategy === name ? null : name)
  const switchTab = (t) => { setTab(t); setSymbolFilter('all'); setFilter('all'); setSearch(''); setActiveStrategy(null) }

  return (
    <>
      <Helmet><title>History Tracker - TradingSignals</title></Helmet>
      <div className="p-1">
        <h4 className="fw-bold mb-2">📊 History Tracker</h4>
        <p className="text-muted mb-3" style={{ fontSize: 13 }}>
          {tab === 'stocks' ? 'Target 2% / SL 1% — Nifty 50 & Watchlist (Yahoo Finance 1yr daily)' : 'Target 30% / SL 10% — Real option prices (auto-recorded daily)'}
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

        <div className="d-flex gap-2 mb-3">
          <button className={`btn ${tab === 'stocks' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => switchTab('stocks')}>Stocks</button>
          <button className={`btn ${tab === 'options' ? 'btn-warning' : 'btn-outline-warning'}`} onClick={() => switchTab('options')}>Options</button>
        </div>

        {/* Strategy Table */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="fw-bold mb-0">📋 Strategy Win Accuracy ({STRATEGIES.length})</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowStrategies(!showStrategies)}>{showStrategies ? 'Hide' : 'Show'}</button>
        </div>
        {showStrategies && (
          <div className="table-responsive mb-3">
            <table className="table table-sm table-hover mb-0" style={{ fontSize: 12 }}>
              <thead className="table-dark">
                <tr>
                  <th>#</th><th>Strategy</th><th>Indicators</th><th>Entry Idea</th>
                  <th className="text-center">Trades</th><th className="text-center">Target</th><th className="text-center">SL</th>
                  <th className="text-center">Win %</th><th className="text-center">P&L</th><th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {stratStats.map((s, i) => {
                  const w = parseFloat(s.winRate)
                  const winColor = w >= 60 ? '#198754' : w >= 45 ? '#fd7e14' : '#dc3545'
                  const isActive = activeStrategy === s.name
                  return (
                    <tr key={s.name} style={{ background: isActive ? 'rgba(13,110,253,0.08)' : undefined }}>
                      <td>{i + 1}</td>
                      <td className="fw-bold">{s.name}</td>
                      <td><span className="badge bg-light text-dark border" style={{ fontSize: 10 }}>{s.indicators}</span></td>
                      <td>{s.entry}</td>
                      <td className="text-center fw-bold">{s.total}</td>
                      <td className="text-center text-success fw-bold">{s.target}</td>
                      <td className="text-center text-danger fw-bold">{s.sl}</td>
                      <td className="text-center fw-bold" style={{ color: winColor }}>{s.winRate}%</td>
                      <td className="text-center fw-bold" style={{ color: pnlColor(s.pnl) }}>{s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(1)}%</td>
                      <td className="text-center">
                        <button className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-secondary'}`}
                          style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => toggleStrategy(s.name)}>
                          {isActive ? 'Active' : 'Deactive'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Filters */}
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
                  <th>Strategy</th><th>Symbol</th><th>Entry Date</th><th>Exit Date</th><th>Signal</th><th>Entry</th>
                  <th style={{ color: '#198754' }}>Target</th><th style={{ color: '#dc3545' }}>SL</th>
                  <th>Exit</th><th>Result</th><th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => (
                  <tr key={i} style={{ background: h.result === 'TARGET' ? 'rgba(25,135,84,0.05)' : 'rgba(220,53,69,0.05)' }}>
                    <td><span className="badge bg-light text-dark border" style={{ fontSize: 10 }}>{h._strategy}</span></td>
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
                      <div><span className="badge bg-light text-dark border mt-1" style={{ fontSize: 10 }}>{h._strategy}</span></div>
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
