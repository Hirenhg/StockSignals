import { useEffect, useState, useRef, useCallback } from "react"
import { Helmet } from "react-helmet-async"
import API from "../../services/api"
import { useLanguage } from "../../context/LanguageContext"
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton/Skeleton"

const STORAGE_KEY = 'signal-tracker'
const CATEGORIES = ['indices', 'stocks', 'nifty50', 'niftynext50']

const isMarketOpen = () => {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const t = now.getHours() * 60 + now.getMinutes()
  return t >= 555 && t <= 930 // 9:15 AM - 3:30 PM IST
}

const loadState = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { hits: [] } }
  catch { return { hits: [] } }
}
const saveHits = (hits) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ hits })) } catch {}
}

function Tracker() {
  const { t } = useLanguage()
  const [active, setActive] = useState([])
  const [hits, setHits] = useState([])
  const [viewTab, setViewTab] = useState('active')
  const [filterTab, setFilterTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const targetPct = 1.2
  const slPct = 0.4
  const [searchTerm, setSearchTerm] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const audioRef = useRef(null)
  const activeRef = useRef([])

  useEffect(() => { activeRef.current = active }, [active])


  useEffect(() => {
    const saved = loadState()
    setHits(saved.hits || [])
  }, [])

  useEffect(() => { saveHits(hits) }, [hits])

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000)
  }

  const playAlert = () => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880; gain.gain.value = 0.3
      osc.start(); osc.stop(ctx.currentTime + 0.15)
    } catch {}
  }

  const fetchAllSignals = useCallback(async () => {
    setLoading(true)
    const tp = parseFloat(targetPct) || 1.2
    const sl = parseFloat(slPct) || 0.4
    const allTrades = []

    await Promise.all(CATEGORIES.map(async (cat) => {
      try {
        const res = await API.get(`/api/signals/${cat}`)
        res.data.forEach(s => {
          if (s.signal !== 'BUY' && s.signal !== 'SELL') return
          const price = parseFloat(s.price)
          const isBuy = s.signal === 'BUY'
          allTrades.push({
            symbol: s.symbol, signal: s.signal, category: cat,
            entry: price,
            target: parseFloat((isBuy ? price * (1 + tp / 100) : price * (1 - tp / 100)).toFixed(2)),
            sl: parseFloat((isBuy ? price * (1 - sl / 100) : price * (1 + sl / 100)).toFixed(2)),
            currentPrice: price, pChange: s.pChange, rsi: s.rsi,
            time: new Date().toISOString(),
            id: `${s.symbol}-${s.signal}-${cat}`
          })
        })
      } catch {}
    }))

    setActive(allTrades)
    setLastRefresh(new Date())
    setLoading(false)
  }, [targetPct, slPct])

  // Auto-fetch on mount + every 60s only during market hours
  useEffect(() => { fetchAllSignals() }, [fetchAllSignals])
  useEffect(() => {
    if (!isMarketOpen()) return
    const interval = setInterval(() => {
      if (!isMarketOpen()) return
      fetchAllSignals()
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchAllSignals])

  // Price check every 15s — only during market hours
  useEffect(() => {
    if (!isMarketOpen()) return
    const check = () => {
      if (!isMarketOpen()) return
      const current = activeRef.current
      if (!current.length) return
      const symbols = [...new Set(current.map(a => a.symbol))]
      API.post('/api/prices', { symbols })
        .then(res => {
          const priceMap = res.data
          const newHits = []
          const remaining = []

          current.forEach(trade => {
            const p = priceMap[trade.symbol]
            if (!p) { remaining.push(trade); return }
            const ltp = p.price
            const updated = { ...trade, currentPrice: ltp, pChange: p.pChange }

            if (trade.signal === 'BUY') {
              if (ltp >= trade.target) newHits.push({ ...updated, result: 'TARGET', hitTime: new Date().toISOString(), pnlPct: parseFloat(((trade.target - trade.entry) / trade.entry * 100).toFixed(2)) })
              else if (ltp <= trade.sl) newHits.push({ ...updated, result: 'SL', hitTime: new Date().toISOString(), pnlPct: parseFloat(((trade.sl - trade.entry) / trade.entry * 100).toFixed(2)) })
              else remaining.push(updated)
            } else {
              if (ltp <= trade.target) newHits.push({ ...updated, result: 'TARGET', hitTime: new Date().toISOString(), pnlPct: parseFloat(((trade.entry - trade.target) / trade.entry * 100).toFixed(2)) })
              else if (ltp >= trade.sl) newHits.push({ ...updated, result: 'SL', hitTime: new Date().toISOString(), pnlPct: parseFloat(((trade.entry - trade.sl) / trade.entry * 100).toFixed(2)) })
              else remaining.push(updated)
            }
          })

          if (newHits.length > 0) {
            playAlert()
            const targets = newHits.filter(h => h.result === 'TARGET')
            const sls = newHits.filter(h => h.result === 'SL')
            if (targets.length) showToast(`Target hit: ${targets.map(h => h.symbol).join(', ')}`, 'success')
            if (sls.length) showToast(`SL hit: ${sls.map(h => h.symbol).join(', ')}`, 'error')
            setHits(prev => [...newHits, ...prev])
            setViewTab('hits')
            setFilterTab('all')
          }
          setActive(remaining)
          setLastRefresh(new Date())
        })
        .catch(() => {})
    }
    check()
    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length])

  const clearHits = () => { setHits([]); showToast('History cleared', 'success') }

  const filteredHits = hits.filter(h => {
    const matchSearch = h.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    const matchFilter = filterTab === 'all' || h.result === filterTab.toUpperCase()
    return matchSearch && matchFilter
  })
  const filteredActive = active.filter(a => a.symbol.toLowerCase().includes(searchTerm.toLowerCase()))

  const targetCount = hits.filter(h => h.result === 'TARGET').length
  const slCount = hits.filter(h => h.result === 'SL').length
  const totalPnl = hits.reduce((sum, h) => sum + (h.pnlPct || 0), 0)

  const pnlColor = (val) => val > 0 ? '#198754' : val < 0 ? '#dc3545' : '#6c757d'

  const catLabel = (cat) => {
    const map = { stocks: t('watchlist'), indices: t('indices'), nifty50: t('nifty50'), niftynext50: t('next50'), commodities: t('commodities'), crypto: t('crypto') }
    return map[cat] || cat
  }

  // Progress: how far LTP is between SL and Target (0% = at SL, 100% = at Target)
  const getProgress = (trade) => {
    const range = Math.abs(trade.target - trade.sl)
    if (!range) return 50
    const fromSl = trade.signal === 'BUY'
      ? trade.currentPrice - trade.sl
      : trade.sl - trade.currentPrice
    return Math.max(0, Math.min(100, (fromSl / range) * 100))
  }

  return (
    <>
      <Helmet><title>{t('tracker')} - StockSignal</title></Helmet>
      <div className="p-1">
        {toast.show && (
          <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
            <div className={`alert alert-${toast.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show py-2`}>
              {toast.message}
              <button type="button" className="btn-close" onClick={() => setToast({ show: false, message: '', type: '' })}></button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h4 className="fw-bold mb-0">{t('Tracker')}</h4>
          <div className="d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
            {lastRefresh && <span className="text-muted">Updated {lastRefresh.toLocaleTimeString()}</span>}
            <span className={`badge ${isMarketOpen() ? 'bg-success' : 'bg-secondary'}`}>
              {isMarketOpen() ? '● Live 15s' : '● Market Closed'}
            </span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="d-flex gap-2 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { label: t('Active'), value: active.length, bg: '#0d6efd' },
            { label: `${t('Target')}`, value: targetCount, bg: '#198754' },
            { label: 'SL', value: slCount, bg: '#dc3545' },
            { label: 'P&L', value: `${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}%`, bg: pnlColor(totalPnl) },
          ].map((c, i) => (
            <div key={i} className="flex-shrink-0 text-center rounded px-3 py-2" style={{ background: c.bg, color: '#fff', minWidth: '80px' }}>
              <div style={{ fontSize: '13px', opacity: 0.85 }}>{c.label}</div>
              <div className="fw-bold" style={{ fontSize: '20px' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* View Tabs + Search */}
        <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
          <div className="d-flex gap-1">
            <button className={`btn btn-sm ${viewTab === 'active' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setViewTab('active')}>
              {t('Active')} ({active.length})
            </button>
            <button className={`btn btn-sm ${viewTab === 'hits' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setViewTab('hits')}>
              {t('History')} ({hits.length})
            </button>
            <button className="btn btn-sm btn-outline-primary" onClick={fetchAllSignals} disabled={loading}>
              {loading ? t('refreshing') : t('refresh')}
            </button>
          </div>
          {viewTab === 'hits' && (
            <div className="d-flex gap-1">
              <button className={`btn btn-sm ${filterTab === 'all' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setFilterTab('all')}>{t('all')}</button>
              <button className={`btn btn-sm ${filterTab === 'target' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setFilterTab('target')}>Target</button>
              <button className={`btn btn-sm ${filterTab === 'sl' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setFilterTab('sl')}>Stop Loss</button>
            </div>
          )}
          <div className="position-relative ms-auto" style={{ maxWidth: '180px' }}>
            <input className="form-control" placeholder={t('search')} value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && (
              <button className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-muted p-0 me-2 text-decoration-none"
                onClick={() => setSearchTerm('')} style={{ fontSize: '13px' }}>✕</button>
            )}
          </div>
          {viewTab === 'hits' && hits.length > 0 && (
            <button className="btn btn-sm btn-outline-danger" onClick={clearHits}>{t('trClearHistory')}</button>
          )}
        </div>

        {loading && <><SkeletonCards count={4} /><SkeletonTable rows={6} cols={9} /></>}

        {/* ========== ACTIVE TRADES ========== */}
        {viewTab === 'active' && !loading && (
          <>
            {filteredActive.length === 0 && (
              <div className="text-center text-muted py-5">
                <div style={{ fontSize: '48px' }}>📡</div>
                <h5 className="mt-2">No active BUY/SELL signals</h5>
                <p style={{ fontSize: '14px' }}>Signals auto-refresh every 60s. Tracking starts automatically.</p>
              </div>
            )}

            {/* Desktop Table */}
            {filteredActive.length > 0 && (
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover" style={{ fontSize: '13px' }}>
                  <thead className="table-dark">
                    <tr>
                      <th>{t('symbol')}</th><th>Category</th><th>{t('signal')}</th><th>{t('Entry')}</th>
                      <th style={{ color: '#198754' }}>{t('Target')}</th><th style={{ color: '#dc3545' }}>SL</th>
                      <th>LTP</th><th>P&L</th><th>RSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActive.map(trade => {
                      const diff = trade.signal === 'BUY'
                        ? ((trade.currentPrice - trade.entry) / trade.entry * 100)
                        : ((trade.entry - trade.currentPrice) / trade.entry * 100)
                      return (
                        <tr key={trade.id}>
                          <td className="fw-bold">{trade.symbol}</td>
                          <td><span className="badge bg-light text-dark" style={{ fontSize: '11px' }}>{catLabel(trade.category)}</span></td>
                          <td><span className={`badge ${trade.signal === 'BUY' ? 'bg-success' : 'bg-danger'}`}>{trade.signal}</span></td>
                          <td>₹{trade.entry.toFixed(2)}</td>
                          <td style={{ color: '#198754', fontWeight: 'bold' }}>₹{trade.target} <small className="text-muted">{trade.signal === 'BUY' ? '+' : '-'}{targetPct}%</small></td>
                          <td style={{ color: '#dc3545', fontWeight: 'bold' }}>₹{trade.sl} <small className="text-muted">{trade.signal === 'BUY' ? '-' : '+'}{slPct}%</small></td>
                          <td className="fw-bold">₹{trade.currentPrice?.toFixed(2) || '-'}</td>
                          <td style={{ color: pnlColor(diff), fontWeight: 'bold' }}>{diff >= 0 ? '+' : ''}{diff.toFixed(2)}%</td>
                          <td>{trade.rsi || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile Cards — Active */}
            {filteredActive.length > 0 && (
              <div className="d-md-none" style={{ paddingBottom: '80px' }}>
                {filteredActive.map(trade => {
                  const diff = trade.signal === 'BUY'
                    ? ((trade.currentPrice - trade.entry) / trade.entry * 100)
                    : ((trade.entry - trade.currentPrice) / trade.entry * 100)
                  const progress = getProgress(trade)
                  return (
                    <div key={trade.id} className="card mb-3 shadow-sm">
                      <div className="card-body px-3 py-3">
                        {/* Row 1: Symbol + Signal + P&L */}
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <h5 className="fw-bold mb-0" style={{ fontSize: '18px' }}>{trade.symbol}</h5>
                            <span className="text-muted" style={{ fontSize: '12px' }}>{catLabel(trade.category)}</span>
                          </div>
                          <div className="text-end">
                            <span className={`badge rounded-pill px-3 py-2 ${trade.signal === 'BUY' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '13px' }}>
                              {trade.signal}
                            </span>
                            <div className="fw-bold mt-1" style={{ fontSize: '16px', color: pnlColor(diff) }}>
                              {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Price large */}
                        <div className="mb-3">
                          <span className="text-muted" style={{ fontSize: '12px' }}>LTP</span>
                          <h4 className="fw-bold text-primary mb-0" style={{ fontSize: '22px' }}>₹{trade.currentPrice?.toFixed(2)}</h4>
                        </div>

                        {/* Row 3: Progress bar SL ← → Target */}
                        <div className="mb-3">
                          <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                            <span style={{ color: '#dc3545' }}>SL {trade.signal === 'BUY' ? '-' : '+'}{slPct}% · ₹{trade.sl}</span>
                            <span style={{ color: '#198754' }}>Target {trade.signal === 'BUY' ? '+' : '-'}{targetPct}% · ₹{trade.target}</span>
                          </div>
                          <div className="progress" style={{ height: '8px', borderRadius: '4px' }}>
                            <div className="progress-bar" role="progressbar"
                              style={{
                                width: `${progress}%`,
                                background: progress > 60 ? '#198754' : progress > 30 ? '#ffc107' : '#dc3545',
                                borderRadius: '4px', transition: 'width 0.5s ease'
                              }} />
                          </div>
                        </div>

                        {/* Row 4: Entry + RSI */}
                        <div className="row g-2">
                          <div className="col-6">
                            <small className="text-muted d-block" style={{ fontSize: '11px' }}>{t('btEntry')}</small>
                            <strong style={{ fontSize: '15px' }}>₹{trade.entry.toFixed(2)}</strong>
                          </div>
                          <div className="col-6">
                            <small className="text-muted d-block" style={{ fontSize: '11px' }}>RSI</small>
                            <strong style={{ fontSize: '15px' }}>{trade.rsi || '-'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ========== HIT HISTORY ========== */}
        {viewTab === 'hits' && !loading && (
          <>
            {filteredHits.length === 0 && (
              <div className="text-center text-muted py-5">
                <div style={{ fontSize: '48px' }}>📋</div>
                <h5 className="mt-2">No hits yet</h5>
                <p style={{ fontSize: '14px' }}>When trades hit target or SL, they appear here automatically</p>
              </div>
            )}

            {/* Desktop Table */}
            {filteredHits.length > 0 && (
              <div className="d-none d-md-block table-responsive">
                <table className="table table-hover" style={{ fontSize: '13px' }}>
                  <thead className="table-dark">
                    <tr>
                      <th>{t('symbol')}</th><th>Category</th><th>{t('signal')}</th><th>{t('btResult')}</th>
                      <th>{t('btEntry')}</th><th>{t('btTarget')}</th><th>SL</th>
                      <th>LTP</th><th>P&L %</th><th>{t('trHitTime')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHits.map((h, i) => (
                      <tr key={i} style={{ background: h.result === 'TARGET' ? 'rgba(25,135,84,0.05)' : 'rgba(220,53,69,0.05)' }}>
                        <td className="fw-bold">{h.symbol}</td>
                        <td><span className="badge bg-light text-dark" style={{ fontSize: '11px' }}>{catLabel(h.category)}</span></td>
                        <td><span className={`badge ${h.signal === 'BUY' ? 'bg-success' : 'bg-danger'}`}>{h.signal}</span></td>
                        <td><span className={`badge ${h.result === 'TARGET' ? 'bg-success' : 'bg-danger'}`}>{h.result === 'TARGET' ? 'Target' : 'SL'}</span></td>
                        <td>₹{h.entry.toFixed(2)}</td>
                        <td style={{ color: '#198754' }}>₹{h.target} <small className="text-muted">{h.signal === 'BUY' ? '+' : '-'}{targetPct}%</small></td>
                        <td style={{ color: '#dc3545' }}>₹{h.sl} <small className="text-muted">{h.signal === 'BUY' ? '-' : '+'}{slPct}%</small></td>
                        <td className="fw-bold">₹{h.currentPrice?.toFixed(2) || '-'}</td>
                        <td style={{ color: pnlColor(h.pnlPct), fontWeight: 'bold' }}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct}%</td>
                        <td>{h.hitTime ? new Date(h.hitTime).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile Cards — Hits */}
            {filteredHits.length > 0 && (
              <div className="d-md-none" style={{ paddingBottom: '80px' }}>
                {filteredHits.map((h, i) => (
                  <div key={i} className="card mb-3 shadow-sm" style={{ borderLeft: `5px solid ${h.result === 'TARGET' ? '#198754' : '#dc3545'}` }}>
                    <div className="card-body px-3 py-3">
                      {/* Row 1: Symbol + Result badge */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <h5 className="fw-bold mb-0" style={{ fontSize: '18px' }}>{h.symbol}</h5>
                          <span className="text-muted" style={{ fontSize: '12px' }}>{catLabel(h.category)}</span>
                        </div>
                        <div className="text-end">
                          <span className={`badge rounded-pill px-3 py-2 ${h.result === 'TARGET' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '13px' }}>
                            {h.result === 'TARGET' ? 'Target Hit' : 'SL Hit'}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: P&L large */}
                      <div className="mb-3 text-center py-2 rounded" style={{ background: h.result === 'TARGET' ? 'rgba(25,135,84,0.08)' : 'rgba(220,53,69,0.08)' }}>
                        <span className="text-muted" style={{ fontSize: '12px' }}>P&L</span>
                        <h3 className="fw-bold mb-0" style={{ color: pnlColor(h.pnlPct), fontSize: '26px' }}>
                          {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct}%
                        </h3>
                      </div>

                      {/* Row 3: Details grid */}
                      <div className="row g-2 mb-2">
                        <div className="col-4">
                          <small className="text-muted d-block" style={{ fontSize: '11px' }}>{t('signal')}</small>
                          <span className={`badge ${h.signal === 'BUY' ? 'bg-success' : 'bg-danger'}`}>{h.signal}</span>
                        </div>
                        <div className="col-4">
                          <small className="text-muted d-block" style={{ fontSize: '11px' }}>{t('btEntry')}</small>
                          <strong style={{ fontSize: '15px' }}>₹{h.entry.toFixed(2)}</strong>
                        </div>
                        <div className="col-4">
                          <small className="text-muted d-block" style={{ fontSize: '11px' }}>LTP</small>
                          <strong style={{ fontSize: '15px' }}>₹{h.currentPrice?.toFixed(2)}</strong>
                        </div>
                      </div>

                      <div className="row g-2 mb-2">
                        <div className="col-6">
                          <small style={{ color: '#198754', fontSize: '11px' }} className="d-block">Target {h.signal === 'BUY' ? '+' : '-'}{targetPct}%</small>
                          <strong style={{ fontSize: '15px', color: '#198754' }}>₹{h.target}</strong>
                        </div>
                        <div className="col-6">
                          <small style={{ color: '#dc3545', fontSize: '11px' }} className="d-block">SL {h.signal === 'BUY' ? '-' : '+'}{slPct}%</small>
                          <strong style={{ fontSize: '15px', color: '#dc3545' }}>₹{h.sl}</strong>
                        </div>
                      </div>

                      {/* Row 4: Time */}
                      <div className="text-muted text-end" style={{ fontSize: '11px' }}>
                        {h.hitTime ? new Date(h.hitTime).toLocaleString() : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

export default Tracker
