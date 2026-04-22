import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { useTheme } from '../../context/ThemeContext'

const EMPTY_TARGETS = ['', '']

const pct = (from, to) => from ? ((to - from) / from * 100).toFixed(2) : null
const PctBadge = ({ val }) => {
  if (val === null) return <span className="text-muted">-</span>
  const n = parseFloat(val)
  return <span style={{ color: n >= 0 ? '#198754' : '#dc3545', fontWeight: 600, fontSize: 12 }}>{n >= 0 ? '+' : ''}{val}%</span>
}

function LevelCard({ item, darkMode, onEdit, livePrice, livePChange }) {
  const cardBg = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#333' : '#e5e5e5'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const muted = darkMode ? '#888' : '#6c757d'
  const displayPrice = livePrice !== undefined ? livePrice : item.cmp

  return (
    <div className="card shadow-sm mb-3" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14 }}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h5 className="fw-bold mb-0" style={{ color: text }}>🔥 #{item.symbol} SPOT Key Levels</h5>
            <small style={{ color: muted }}>{item.date}</small>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold" style={{ color: text, fontSize: 17 }}>
              👉 CMP: <span style={{ color: '#2962FF' }}>{Number(displayPrice.toFixed ? displayPrice.toFixed(2) : displayPrice).toLocaleString('en-IN')}</span>
              {livePChange !== undefined && <span className="ms-1" style={{ fontSize: 13, color: livePChange >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}>{livePChange >= 0 ? '▲' : '▼'}{Math.abs(livePChange)}%</span>}
            </span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(item)}>Edit</button>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="p-3 rounded" style={{ background: darkMode ? '#1a2e1a' : '#f0fff4', border: '1px solid #198754' }}>
              <div className="fw-bold mb-1" style={{ color: '#198754', fontSize: 15 }}>
                🚀 Bullish Above: <span style={{ fontSize: 17 }}>{Number(item.bullishAbove).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ color: '#198754', fontSize: 14 }}>
                🎯 Targets:{' '}
                {item.bullishTargets.map((t, i) => (
                  <span key={i}><strong>{Number(t).toLocaleString('en-IN')}</strong>{i < item.bullishTargets.length - 1 ? ' » ' : ''}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="p-3 rounded" style={{ background: darkMode ? '#2e1a1a' : '#fff5f5', border: '1px solid #dc3545' }}>
              <div className="fw-bold mb-1" style={{ color: '#dc3545', fontSize: 15 }}>
                ⚡️ Bearish Below: <span style={{ fontSize: 17 }}>{Number(item.bearishBelow).toLocaleString('en-IN')}</span>
              </div>
              <div style={{ color: '#dc3545', fontSize: 14 }}>
                🎯 Targets:{' '}
                {item.bearishTargets.map((t, i) => (
                  <span key={i}><strong>{Number(t).toLocaleString('en-IN')}</strong>{i < item.bearishTargets.length - 1 ? ' » ' : ''}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {item.note && (
          <div className="mt-3 p-2 rounded" style={{ background: darkMode ? '#2a2a2a' : '#f8f9fa', fontSize: 13, color: muted }}>
            📝 {item.note}
          </div>
        )}
      </div>
    </div>
  )
}

function MobileTableCard({ item, darkMode, livePrice, livePChange }) {
  const cardBg = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#333' : '#e5e5e5'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const muted = darkMode ? '#888' : '#6c757d'
  const displayPrice = livePrice !== undefined ? livePrice : item.cmp

  const Row = ({ label, value, valueColor, pctVal }) => (
    <div className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: `1px solid ${darkMode ? '#2a2a2a' : '#f0f0f0'}` }}>
      <span style={{ fontSize: 14, color: muted }}>{label}</span>
      <div className="text-end">
        <span className="fw-bold" style={{ fontSize: 13, color: valueColor }}>{value}</span>
        {pctVal !== undefined && <span className="ms-1"><PctBadge val={pctVal} /></span>}
      </div>
    </div>
  )

  return (
    <div className="card mb-3 shadow-sm" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center px-3 py-2" style={{ background: darkMode ? '#262626' : '#f8f9fa', borderBottom: `1px solid ${border}` }}>
        <span className="fw-bold" style={{ fontSize: 16, color: text }}>{item.symbol}</span>
        <div className="text-end">
          <span className="fw-bold" style={{ color: '#2962FF', fontSize: 17 }}>
            {Number(displayPrice.toFixed ? displayPrice.toFixed(2) : displayPrice).toLocaleString('en-IN')}
          </span>
          {livePChange !== undefined && (
            <span className="ms-2 fw-bold" style={{ fontSize: 12, color: livePChange >= 0 ? '#198754' : '#dc3545' }}>
              {livePChange >= 0 ? '▲' : '▼'} {Math.abs(livePChange)}%
            </span>
          )}
        </div>
      </div>

      <div className="px-3 pt-2 pb-1">

        {/* Bullish Section */}
        <div className="mb-2">
          <div className="fw-bold mb-1" style={{ fontSize: 14, color: '#198754', textTransform: 'uppercase', letterSpacing: 0.5 }}>🚀 Bullish</div>
          <Row label="Buy Price" value={Number(item.bullishAbove).toLocaleString('en-IN')} valueColor="#198754" />
          <Row label="Target 1" value={Number(item.bullishTargets[0]).toLocaleString('en-IN')} valueColor="#198754" pctVal={pct(item.bullishAbove, item.bullishTargets[0])} />
          <Row label="Target 2" value={Number(item.bullishTargets[1]).toLocaleString('en-IN')} valueColor="#198754" pctVal={pct(item.bullishAbove, item.bullishTargets[1])} />
          <Row label="Stop Loss" value={Number(item.bearishBelow).toLocaleString('en-IN')} valueColor="#fd7e14" pctVal={pct(item.bullishAbove, item.bearishBelow)} />
        </div>

        {/* Bearish Section */}
        <div className="mb-2">
          <div className="fw-bold mb-1" style={{ fontSize: 14, color: '#dc3545', textTransform: 'uppercase', letterSpacing: 0.5 }}>⚡️ Bearish</div>
          <Row label="Sell Price" value={Number(item.bearishBelow).toLocaleString('en-IN')} valueColor="#dc3545" />
          <Row label="Target 1" value={Number(item.bearishTargets[0]).toLocaleString('en-IN')} valueColor="#dc3545" pctVal={pct(item.bearishBelow, item.bearishTargets[0])} />
          <Row label="Target 2" value={Number(item.bearishTargets[1]).toLocaleString('en-IN')} valueColor="#dc3545" pctVal={pct(item.bearishBelow, item.bearishTargets[1])} />
          <Row label="Stop Loss" value={Number(item.bullishAbove).toLocaleString('en-IN')} valueColor="#fd7e14" pctVal={pct(item.bearishBelow, item.bullishAbove)} />
        </div>

        {/* Date */}
        <div className="text-end pb-1" style={{ fontSize: 14, color: muted }}>{item.date}</div>
      </div>
    </div>
  )
}

function EditModal({ item, darkMode, onSave, onClose }) {
  const [form, setForm] = useState({
    date: item.date || '',
    cmp: item.cmp || '',
    bullishAbove: item.bullishAbove || '',
    bullishTargets: item.bullishTargets?.length ? [...item.bullishTargets] : [...EMPTY_TARGETS],
    bearishBelow: item.bearishBelow || '',
    bearishTargets: item.bearishTargets?.length ? [...item.bearishTargets] : [...EMPTY_TARGETS],
    note: item.note || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setTarget = (type, i, v) => setForm(f => {
    const arr = [...f[type]]
    arr[i] = v
    return { ...f, [type]: arr }
  })

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      ...form,
      cmp: parseFloat(form.cmp),
      bullishAbove: parseFloat(form.bullishAbove),
      bearishBelow: parseFloat(form.bearishBelow),
      bullishTargets: form.bullishTargets.map(t => parseFloat(t)).filter(t => !isNaN(t)),
      bearishTargets: form.bearishTargets.map(t => parseFloat(t)).filter(t => !isNaN(t)),
    })
    setSaving(false)
  }

  const inp = { background: darkMode ? '#2a2a2a' : '#fff', color: darkMode ? '#e0e0e0' : '#212529', border: `1px solid ${darkMode ? '#444' : '#ced4da'}` }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card shadow-lg" style={{ width: '100%', maxWidth: 480, background: darkMode ? '#1e1e1e' : '#fff', color: darkMode ? '#e0e0e0' : '#212529', borderRadius: 14 }}>
        <div className="card-header fw-bold d-flex justify-content-between align-items-center">
          <span>Edit {item.symbol} Levels</span>
          <button className="btn-close" onClick={onClose} style={{ filter: darkMode ? 'invert(1)' : 'none' }} />
        </div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label small mb-1">Date</label>
              <input className="form-control form-control-sm" style={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small mb-1">CMP</label>
              <input className="form-control form-control-sm" style={inp} type="number" value={form.cmp} onChange={e => set('cmp', e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small mb-1 text-success">Bullish Above (Buy)</label>
              <input className="form-control form-control-sm" style={inp} type="number" value={form.bullishAbove} onChange={e => set('bullishAbove', e.target.value)} />
            </div>
            <div className="col-3">
              <label className="form-label small mb-1 text-success">Bull T1</label>
              <input className="form-control form-control-sm" style={inp} type="number" value={form.bullishTargets[0]} onChange={e => setTarget('bullishTargets', 0, e.target.value)} />
            </div>
            <div className="col-3">
              <label className="form-label small mb-1 text-success">Bull T2</label>
              <input className="form-control form-control-sm" style={inp} type="number" value={form.bullishTargets[1]} onChange={e => setTarget('bullishTargets', 1, e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small mb-1 text-danger">Bearish Below (Sell)</label>
              <input className="form-control form-control-sm" style={inp} type="number" value={form.bearishBelow} onChange={e => set('bearishBelow', e.target.value)} />
            </div>
            <div className="col-3">
              <label className="form-label small mb-1 text-danger">Bear T1</label>
              <input className="form-control form-control-sm" style={inp} type="number" value={form.bearishTargets[0]} onChange={e => setTarget('bearishTargets', 0, e.target.value)} />
            </div>
            <div className="col-3">
              <label className="form-label small mb-1 text-danger">Bear T2</label>
              <input className="form-control form-control-sm" style={inp} type="number" value={form.bearishTargets[1]} onChange={e => setTarget('bearishTargets', 1, e.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label small mb-1">Note (optional)</label>
              <input className="form-control form-control-sm" style={inp} value={form.note} onChange={e => set('note', e.target.value)} placeholder="e.g. Watch for breakout..." />
            </div>
          </div>
        </div>
        <div className="card-footer d-flex justify-content-end gap-2">
          <button className="btn btn-sm btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// symbol → Yahoo Finance symbol mapping for live price
const LIVE_SYMBOL_MAP = { NIFTY: '^NSEI', SENSEX: '^BSESN' }

export default function IndexLevels() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [liveMap, setLiveMap] = useState({})  // { NIFTY: { price, pChange }, ... }
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')
  const { darkMode } = useTheme()

  useEffect(() => {
    API.get('/api/index-levels')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  // Fetch live prices on mount and every 15s
  useEffect(() => {
    const symbols = Object.values(LIVE_SYMBOL_MAP)
    const fetch = () =>
      API.post('/api/prices', { symbols })
        .then(r => {
          const map = {}
          Object.entries(LIVE_SYMBOL_MAP).forEach(([key, sym]) => {
            if (r.data[sym]) map[key] = r.data[sym]
          })
          setLiveMap(map)
        })
        .catch(() => {})
    fetch()
    const interval = setInterval(fetch, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleSave = async (payload) => {
    await API.put(`/api/index-levels/${editing.symbol}`, payload)
    setData(prev => prev.map(d => d.symbol === editing.symbol ? { ...d, ...payload } : d))
    setEditing(null)
    setToast('Saved successfully!')
    setTimeout(() => setToast(''), 2500)
  }

  const text = darkMode ? '#e0e0e0' : '#212529'
  const muted = darkMode ? '#888' : '#6c757d'

  return (
    <>
      <Helmet><title>Index Key Levels - TradingSignals</title></Helmet>
      <div className="p-1">
        <h5 className="fw-bold mb-1" style={{ color: text }}>📊 Index Key Levels</h5>
        <p className="mb-3" style={{ fontSize: 13, color: muted }}>
          Daily updated key levels for NIFTY & SENSEX — Bullish/Bearish zones with targets
        </p>

        {toast && <div className="alert alert-success py-2 px-3 mb-3" style={{ fontSize: 13 }}>{toast}</div>}

        {/* Live Index Ticker */}
        <div className="d-flex flex-wrap gap-3 mb-4">
          {Object.entries(LIVE_SYMBOL_MAP).map(([key]) => {
            const live = liveMap[key]
            const cardBg = darkMode ? '#1e1e1e' : '#fff'
            const border = darkMode ? '#333' : '#e5e5e5'
            return (
              <div key={key} className="card shadow-sm flex-grow-1" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, minWidth: 160 }}>
                <div className="card-body py-2 px-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold" style={{ color: text, fontSize: 13 }}>{key}</span>
                    {live
                      ? <span className="fw-bold" style={{ color: live.pChange >= 0 ? '#198754' : '#dc3545', fontSize: 11 }}>
                          {live.pChange >= 0 ? '▲' : '▼'} {Math.abs(live.pChange)}%
                        </span>
                      : <span className="text-muted" style={{ fontSize: 11 }}>Loading...</span>
                    }
                  </div>
                  <div className="fw-bold" style={{ color: '#2962FF', fontSize: 22, letterSpacing: 0.5 }}>
                    {live ? Number(live.price.toFixed(2)).toLocaleString('en-IN') : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: muted }}>
                    Prev: {live ? Number(live.prevClose.toFixed(2)).toLocaleString('en-IN') : '—'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center text-muted p-4">Loading...</div>
        ) : (
          <>
            {/* Level Cards */}
            {data.map(item => {
              const live = liveMap[item.symbol]
              return <LevelCard key={item.symbol} item={item} darkMode={darkMode} onEdit={setEditing} livePrice={live?.price} livePChange={live?.pChange} />
            })}

            {/* Desktop Table */}
            <h6 className="fw-bold mt-2 mb-3" style={{ color: text }}>📋 Quick Reference</h6>
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover" style={{ fontSize: 14 }}>
                <thead className="table-dark">
                  <tr style={{ verticalAlign: 'middle' }}>
                    <th>Symbol</th>
                    <th>CMP</th>
                    <th style={{ color: '#4ade80' }}>Buy Price</th>
                    <th style={{ color: '#4ade80' }}>Bull T1</th>
                    <th style={{ color: '#4ade80' }}>% T1</th>
                    <th style={{ color: '#4ade80' }}>Bull T2</th>
                    <th style={{ color: '#4ade80' }}>% T2</th>
                    <th style={{ color: '#f87171' }}>Sell Price</th>
                    <th style={{ color: '#f87171' }}>Bear T1</th>
                    <th style={{ color: '#f87171' }}>% T1</th>
                    <th style={{ color: '#f87171' }}>Bear T2</th>
                    <th style={{ color: '#f87171' }}>% T2</th>
                    <th style={{ color: '#fb923c' }}>Bull SL</th>
                    <th style={{ color: '#fb923c' }}>% SL</th>
                    <th style={{ color: '#fb923c' }}>Bear SL</th>
                    <th style={{ color: '#fb923c' }}>% SL</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, i) => {
                    const live = liveMap[item.symbol]
                    const livePrice = live ? live.price : item.cmp
                    return (
                    <tr key={i} style={{ verticalAlign: 'middle' }}>
                      <td className="fw-bold" style={{ color: text }}>{item.symbol}</td>
                      <td>
                        <span className="fw-bold" style={{ color: '#2962FF' }}>{Number(livePrice.toFixed ? livePrice.toFixed(2) : livePrice).toLocaleString('en-IN')}</span>
                        {live && <span className="ms-1" style={{ fontSize: 11, color: live.pChange >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}>{live.pChange >= 0 ? '▲' : '▼'}{Math.abs(live.pChange)}%</span>}
                      </td>
                      <td className="fw-bold" style={{ color: '#198754' }}>{Number(item.bullishAbove).toLocaleString('en-IN')}</td>
                      <td style={{ color: '#198754' }}>{Number(item.bullishTargets[0]).toLocaleString('en-IN')}</td>
                      <td><PctBadge val={pct(item.bullishAbove, item.bullishTargets[0])} /></td>
                      <td style={{ color: '#198754' }}>{Number(item.bullishTargets[1]).toLocaleString('en-IN')}</td>
                      <td><PctBadge val={pct(item.bullishAbove, item.bullishTargets[1])} /></td>
                      <td className="fw-bold" style={{ color: '#dc3545' }}>{Number(item.bearishBelow).toLocaleString('en-IN')}</td>
                      <td style={{ color: '#dc3545' }}>{Number(item.bearishTargets[0]).toLocaleString('en-IN')}</td>
                      <td><PctBadge val={pct(item.bearishBelow, item.bearishTargets[0])} /></td>
                      <td style={{ color: '#dc3545' }}>{Number(item.bearishTargets[1]).toLocaleString('en-IN')}</td>
                      <td><PctBadge val={pct(item.bearishBelow, item.bearishTargets[1])} /></td>
                      <td className="fw-bold" style={{ color: '#fd7e14' }}>{Number(item.bearishBelow).toLocaleString('en-IN')}</td>
                      <td><PctBadge val={pct(item.bullishAbove, item.bearishBelow)} /></td>
                      <td className="fw-bold" style={{ color: '#fd7e14' }}>{Number(item.bullishAbove).toLocaleString('en-IN')}</td>
                      <td><PctBadge val={pct(item.bearishBelow, item.bullishAbove)} /></td>
                      <td style={{ color: muted, fontSize: 12 }}>{item.date}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditing(item)}>Edit</button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Table Cards */}
            <div className="d-md-none" style={{ paddingBottom: 80 }}>
              {data.map(item => {
                const live = liveMap[item.symbol]
                return <MobileTableCard key={item.symbol} item={item} darkMode={darkMode} livePrice={live?.price} livePChange={live?.pChange} />
              })}
            </div>
          </>
        )}

        {editing && <EditModal item={editing} darkMode={darkMode} onSave={handleSave} onClose={() => setEditing(null)} />}
      </div>
    </>
  )
}
