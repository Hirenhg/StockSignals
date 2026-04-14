import { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import API from '../../services/api'
import { SkeletonTable, SkeletonCards } from '../../components/Skeleton/Skeleton'

const ASSET_TABS = [
  { key: 'indices', label: 'Indices' },
  { key: 'stocks', label: 'Watchlist' },
  { key: 'nifty50', label: 'Nifty 50' },
  { key: 'niftynext50', label: 'Next 50' },
  { key: 'commodities', label: 'Commodities' },
  { key: 'crypto', label: 'Crypto' },
]
const empty = { name: '', condition: '' }

// Evaluate script — supports both `return 'BUY'` and boolean expression styles
function evalCondition(condition, row) {
  if (!condition) return row.signal
  try {
    const { price, ema7, pivot, rsi, macdLine, macdSignal, macdHist, r1, r2, r3, s1, s2, s3 } = row
    // eslint-disable-next-line no-new-func
    const result = new Function(
      'price','ema7','pivot','rsi','macdLine','macdSignal','macdHist','r1','r2','r3','s1','s2','s3',
      `try { ${condition} } catch(e) { return null }`
    )(
      parseFloat(price), parseFloat(ema7), parseFloat(pivot), parseFloat(rsi),
      parseFloat(macdLine), parseFloat(macdSignal), parseFloat(macdHist),
      parseFloat(r1), parseFloat(r2), parseFloat(r3),
      parseFloat(s1), parseFloat(s2), parseFloat(s3)
    )
    if (result === 'BUY' || result === 'SELL' || result === 'HOLD') return result
    return row.signal
  } catch { return row.signal }
}

// Derive signal from condition script only
function deriveSignal(strategy, row) {
  if (!strategy?.condition) return row.signal
  return evalCondition(strategy.condition, row)
}

const Strategy = () => {
  const navigate = useNavigate()
  const [strategies, setStrategies] = useState([])
  const [stratLoading, setStratLoading] = useState(true)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState({ msg: '', type: 'success' })

  const [signals, setSignals] = useState([])
  const [sigLoading, setSigLoading] = useState(false)
  const [assetTab, setAssetTab] = useState('indices')
  const [signalFilter, setSignalFilter] = useState('all')
  const [search, setSearch] = useState('')

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: 'success' }), 3000) }

  const activeStrategy = strategies.find(s => s.active) || null

  // Load strategies
  useEffect(() => {
    API.get('/api/auth/strategies')
      .then(res => setStrategies(res.data))
      .catch(() => {})
      .finally(() => setStratLoading(false))
  }, [])

  // Load signals when tab changes
  const fetchSignals = useCallback((tab) => {
    setSigLoading(true)
    API.get(`/api/signals/${tab}`)
      .then(res => setSignals(res.data))
      .catch(() => setSignals([]))
      .finally(() => setSigLoading(false))
  }, [])

  useEffect(() => { fetchSignals(assetTab) }, [assetTab, fetchSignals])

  // Strategy CRUD
  const openAdd  = () => { setForm(empty); setEditId(null); setShowForm(true) }
  const openEdit = (s) => { setForm({ name: s.name, condition: s.condition || '' }); setEditId(s.id); setShowForm(true) }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editId) {
      API.put(`/api/auth/strategies/${editId}`, form)
        .then(res => { setStrategies(prev => prev.map(s => s.id === editId ? res.data : s)); setShowForm(false); showToast('Strategy updated') })
        .catch(() => showToast('Failed', 'danger'))
    } else {
      API.post('/api/auth/strategies', form)
        .then(res => { setStrategies(prev => [...prev, res.data]); setShowForm(false); showToast('Strategy added') })
        .catch(() => showToast('Failed', 'danger'))
    }
  }

  const handleDelete = (id) => {
    API.delete(`/api/auth/strategies/${id}`)
      .then(() => { setStrategies(prev => prev.filter(s => s.id !== id)); showToast('Deleted') })
      .catch(() => showToast('Failed', 'danger'))
  }

  const toggleActive = (s) => {
    // Only one active at a time
    const updated = strategies.map(x => ({ ...x, active: x.id === s.id ? !s.active : false }))
    const target = updated.find(x => x.id === s.id)
    API.put(`/api/auth/strategies/${s.id}`, target)
      .then(res => {
        // deactivate others
        const others = strategies.filter(x => x.id !== s.id && x.active)
        Promise.all(others.map(o => API.put(`/api/auth/strategies/${o.id}`, { ...o, active: false })))
          .catch(() => {})
        setStrategies(updated)
      })
      .catch(() => {})
  }

  const ind = activeStrategy?.indicators || ['ema7', 'pivot']
  const showEma7  = ind.includes('ema7')
  const showPivot = ind.includes('pivot')
  const showRsi   = ind.includes('rsi')
  const showMacd  = ind.includes('macd')
  const showSR    = ind.includes('sr')

  // Compute derived signals
  const enriched = signals.map(row => ({ ...row, derivedSignal: deriveSignal(activeStrategy, row) }))
  const filtered = enriched.filter(row => {
    const matchSearch = row.symbol.toLowerCase().includes(search.toLowerCase())
    const matchSignal = signalFilter === 'all' || row.derivedSignal === signalFilter.toUpperCase()
    return matchSearch && matchSignal
  })
  const buyCount  = enriched.filter(r => r.derivedSignal === 'BUY').length
  const sellCount = enriched.filter(r => r.derivedSignal === 'SELL').length
  const holdCount = enriched.filter(r => r.derivedSignal === 'HOLD').length

  return (
    <>
      <Helmet><title>Strategy - TradingSignals</title></Helmet>

      {toast.msg && (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
          <div className={`alert alert-${toast.type} py-2 mb-0`}>{toast.msg}</div>
        </div>
      )}

      <div className="p-2">

        {/* ── Strategy Cards ── */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="fw-bold mb-0">My Strategies</h5>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Strategy</button>
        </div>

        {stratLoading ? (
          <div className="text-muted py-2" style={{ fontSize: 13 }}>Loading strategies...</div>
        ) : strategies.length === 0 ? (
          <div className="alert alert-warning py-2" style={{ fontSize: 13 }}>No strategies yet. Add one to filter the table below.</div>
        ) : (
          <div className="d-flex flex-wrap gap-2 mb-3">
            {strategies.map(s => (
              <div key={s.id} className={`card shadow-sm flex-shrink-0 ${s.active ? 'border-primary' : ''}`} style={{ minWidth: 200, maxWidth: 280 }}>
                <div className="card-body p-2">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <div>
                      <span className="fw-bold" style={{ fontSize: 13 }}>{s.name}</span>
                      {s.condition && <div className="text-muted mt-1" style={{ fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{s.condition.slice(0, 80)}{s.condition.length > 80 ? '…' : ''}</div>}
                    </div>
                    <span className={`badge ms-1 ${s.active ? 'bg-primary' : 'bg-light text-dark border'}`} style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                      {s.active ? '● Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="d-flex gap-1 mt-2">
                    <button className={`btn btn-sm ${s.active ? 'btn-primary' : 'btn-outline-primary'}`} style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => toggleActive(s)}>
                      {s.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleDelete(s.id)}>✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Active Strategy Info Bar ── */}
        {activeStrategy && (
          <div className="alert alert-primary py-2 mb-3" style={{ fontSize: 13 }}>
            <strong>Active:</strong> {activeStrategy.name}
            {activeStrategy.condition && <code className="ms-2" style={{ fontSize: 11 }}>{activeStrategy.condition.slice(0, 100)}{activeStrategy.condition.length > 100 ? '…' : ''}</code>}
          </div>
        )}

        {/* ── Asset Tabs ── */}
        <div className="d-flex gap-2 mb-2 overflow-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {ASSET_TABS.map(t => (
            <button key={t.key} className={`btn btn-sm flex-shrink-0 ${assetTab === t.key ? 'btn-primary' : 'btn-outline-primary'}`}
              style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => setAssetTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <div className="d-flex gap-1">
            {['all','buy','sell','hold'].map(f => (
              <button key={f} className={`btn btn-sm ${signalFilter === f ? (f === 'buy' ? 'btn-success' : f === 'sell' ? 'btn-danger' : f === 'hold' ? 'btn-secondary' : 'btn-dark') : (f === 'buy' ? 'btn-outline-success' : f === 'sell' ? 'btn-outline-danger' : f === 'hold' ? 'btn-outline-secondary' : 'btn-outline-dark')}`}
                onClick={() => setSignalFilter(f)} style={{ fontSize: 12 }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input className="form-control form-control-sm" style={{ maxWidth: 160, fontSize: 12 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: 12 }} onClick={() => fetchSignals(assetTab)}>↻ Refresh</button>
          <div className="d-flex gap-1 ms-auto">
            <span className="badge bg-success p-2">BUY {buyCount}</span>
            <span className="badge bg-danger p-2">SELL {sellCount}</span>
            <span className="badge bg-secondary p-2">HOLD {holdCount}</span>
          </div>
        </div>

        {/* ── Mobile Cards ── */}
        <div className="d-md-none" style={{ paddingBottom: 80 }}>
          {sigLoading ? <SkeletonCards count={4} /> : filtered.map((item, i) => (
            <div key={i} className="card mb-2 shadow-sm">
              <div className="card-body p-2">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <span className="fw-bold" style={{ cursor: 'pointer', textDecoration: 'underline', fontSize: 14 }}
                      onClick={() => navigate(`/chart/${item.symbol}?mode=dashboard`)}>{item.symbol}</span>
                    <div className="fw-bold text-primary" style={{ fontSize: 13 }}>₹{item.price}
                      {item.pChange != null && <span className="ms-1 fw-bold" style={{ fontSize: 11, color: item.pChange >= 0 ? '#198754' : '#dc3545' }}>
                        {item.pChange >= 0 ? '▲' : '▼'}{Math.abs(item.pChange)}%
                      </span>}
                    </div>
                  </div>
                  <span className={`badge rounded-pill px-2 py-1 ${item.derivedSignal === 'BUY' ? 'bg-success' : item.derivedSignal === 'SELL' ? 'bg-danger' : 'bg-secondary'}`}>
                    {item.derivedSignal}
                    {item.derivedSignal !== item.signal && <span style={{ fontSize: 9, opacity: 0.8 }}> (was {item.signal})</span>}
                  </span>
                </div>
                <div className="row g-2" style={{ fontSize: 12 }}>
                  {showRsi && <div className="col-6"><small className="text-muted d-block">RSI</small><strong style={{ color: '#fd7e14' }}>{item.rsi}</strong></div>}
                  {showEma7 && <div className="col-6"><small className="text-muted d-block">EMA7</small><strong style={{ color: '#2962FF' }}>₹{item.ema7}</strong></div>}
                  {showPivot && <div className="col-6"><small className="text-muted d-block">Pivot</small><strong style={{ color: '#6f42c1' }}>₹{item.pivot || '-'}</strong></div>}
                  {showMacd && <>
                    <div className="col-4"><small className="text-muted d-block">MACD</small><strong style={{ color: '#20c997', fontSize: 11 }}>{item.macdLine || '-'}</strong></div>
                    <div className="col-4"><small className="text-muted d-block">Signal</small><strong style={{ color: '#20c997', fontSize: 11 }}>{item.macdSignal || '-'}</strong></div>
                    <div className="col-4"><small className="text-muted d-block">Hist</small>
                      <strong style={{ fontSize: 11, color: parseFloat(item.macdHist) >= 0 ? '#198754' : '#dc3545' }}>{item.macdHist || '-'}</strong>
                    </div>
                  </>}
                  {showSR && <>
                    <div className="col-4"><small style={{ color: '#dc3545' }} className="d-block">R1</small><strong style={{ color: '#dc3545', fontSize: 11 }}>₹{item.r1 || '-'}</strong></div>
                    <div className="col-4"><small style={{ color: '#dc3545' }} className="d-block">R2</small><strong style={{ color: '#dc3545', fontSize: 11 }}>₹{item.r2 || '-'}</strong></div>
                    <div className="col-4"><small style={{ color: '#198754' }} className="d-block">S1</small><strong style={{ color: '#198754', fontSize: 11 }}>₹{item.s1 || '-'}</strong></div>
                  </>}
                  <div className="col-6"><small style={{ color: '#198754' }} className="d-block">Target +1.2%</small><strong style={{ color: '#198754', fontSize: 11 }}>₹{(parseFloat(item.price) * 1.012).toFixed(2)}</strong></div>
                  <div className="col-6"><small style={{ color: '#dc3545' }} className="d-block">SL -0.4%</small><strong style={{ color: '#dc3545', fontSize: 11 }}>₹{(parseFloat(item.price) * 0.996).toFixed(2)}</strong></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop Table ── */}
        {sigLoading ? <SkeletonTable rows={8} cols={6} /> : (
          <div className="d-none d-md-block table-responsive">
            <table className="table table-hover" style={{ fontSize: 13 }}>
              <thead className="table-dark">
                <tr>
                  <th>Symbol</th>
                  <th>Price</th>
                  <th>Signal</th>
                  {showRsi   && <th style={{ color: '#fd7e14' }}>RSI</th>}
                  {showEma7  && <th style={{ color: '#2962FF' }}>EMA7</th>}
                  {showPivot && <th style={{ color: '#6f42c1' }}>Pivot</th>}
                  {showMacd  && <><th style={{ color: '#20c997' }}>MACD</th><th style={{ color: '#20c997' }}>Signal</th><th style={{ color: '#20c997' }}>Hist</th></>}
                  {showSR    && <><th style={{ color: '#dc3545' }}>R1</th><th style={{ color: '#dc3545' }}>R2</th><th style={{ color: '#198754' }}>S1</th><th style={{ color: '#198754' }}>S2</th></>}
                  <th style={{ color: '#198754' }}>Target</th>
                  <th style={{ color: '#dc3545' }}>SL</th>
                  <th>% Chg</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={i} style={{ verticalAlign: 'middle' }}>
                    <td className="fw-bold">
                      <span style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigate(`/chart/${item.symbol}?mode=dashboard`)}>{item.symbol}</span>
                    </td>
                    <td>₹{item.price}</td>
                    <td>
                      <span className={`badge ${item.derivedSignal === 'BUY' ? 'bg-success' : item.derivedSignal === 'SELL' ? 'bg-danger' : 'bg-secondary'}`}>
                        {item.derivedSignal}
                      </span>
                      {item.derivedSignal !== item.signal && (
                        <span className="text-muted ms-1" style={{ fontSize: 10 }}>(was {item.signal})</span>
                      )}
                    </td>
                    {showRsi   && <td style={{ color: '#fd7e14' }}>{item.rsi}</td>}
                    {showEma7  && <td style={{ color: '#2962FF' }}>₹{item.ema7}</td>}
                    {showPivot && <td style={{ color: '#6f42c1' }}>₹{item.pivot || '-'}</td>}
                    {showMacd  && <>
                      <td style={{ color: '#20c997' }}>{item.macdLine || '-'}</td>
                      <td style={{ color: '#20c997' }}>{item.macdSignal || '-'}</td>
                      <td style={{ color: parseFloat(item.macdHist) >= 0 ? '#198754' : '#dc3545' }}>{item.macdHist || '-'}</td>
                    </>}
                    {showSR    && <>
                      <td style={{ color: '#dc3545' }}>₹{item.r1 || '-'}</td>
                      <td style={{ color: '#dc3545' }}>₹{item.r2 || '-'}</td>
                      <td style={{ color: '#198754' }}>₹{item.s1 || '-'}</td>
                      <td style={{ color: '#198754' }}>₹{item.s2 || '-'}</td>
                    </>}
                    <td style={{ color: '#198754', fontWeight: 'bold' }}>₹{(parseFloat(item.price) * 1.012).toFixed(2)}</td>
                    <td style={{ color: '#dc3545', fontWeight: 'bold' }}>₹{(parseFloat(item.price) * 0.996).toFixed(2)}</td>
                    <td style={{ color: item.pChange >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold' }}>
                      {item.pChange != null ? `${item.pChange >= 0 ? '+' : ''}${item.pChange}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal — script only ── */}
      {showForm && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editId ? 'Edit Strategy' : 'Add Strategy'}</h5>
                <button className="btn-close" onClick={() => setShowForm(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Strategy Name</label>
                  <input className="form-control" value={form.name} autoFocus
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. EMA7 & Pivot" />
                </div>
                <div className="mb-1">
                  <label className="form-label fw-semibold">Script <span className="text-muted fw-normal" style={{ fontSize: 12 }}>(condition that returns BUY / SELL / HOLD)</span></label>
                  <textarea className="form-control font-monospace" rows={5} value={form.condition}
                    onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                    placeholder={`// Return 'BUY', 'SELL', or 'HOLD'\nif (price > ema7 && price > pivot && rsi > 50) return 'BUY'\nif (price < ema7 && price < pivot && rsi < 50) return 'SELL'\nreturn 'HOLD'`}
                    style={{ fontSize: 12, fontFamily: 'monospace', minHeight: 120 }} />
                </div>
                <small className="text-muted" style={{ fontSize: 11 }}>
                  Variables: <code>price</code> <code>ema7</code> <code>pivot</code> <code>rsi</code> <code>macdLine</code> <code>macdSignal</code> <code>macdHist</code> <code>r1</code> <code>r2</code> <code>r3</code> <code>s1</code> <code>s2</code> <code>s3</code>
                </small>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Strategy
