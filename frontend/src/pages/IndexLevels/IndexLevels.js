import React, { useEffect, useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable, SkeletonCards } from '../../components/Skeleton/Skeleton'
import { useTheme } from '../../context/ThemeContext'

const MOOD_ZONES = [
  { label: 'Extreme Fear', color: '#198754', range: [0, 20] },
  { label: 'Fear', color: '#20c997', range: [20, 40] },
  { label: 'Neutral', color: '#ffc107', range: [40, 60] },
  { label: 'Greed', color: '#fd7e14', range: [60, 80] },
  { label: 'Extreme Greed', color: '#dc3545', range: [80, 100] },
]

const getMoodColor = (score) => {
  const zone = MOOD_ZONES.find(z => score >= z.range[0] && score < z.range[1]) || MOOD_ZONES[4]
  return zone.color
}

const MoodGauge = ({ score, mood, darkMode }) => {
  const radius = 90
  const strokeWidth = 22
  const cx = 120, cy = 110
  const clampedScore = Math.max(0, Math.min(100, score))
  const needleAngle = Math.PI - (clampedScore / 100) * Math.PI
  const needleLen = radius - 10
  const nx = cx + needleLen * Math.cos(needleAngle)
  const ny = cy - needleLen * Math.sin(needleAngle)
  const moodColor = getMoodColor(score)

  const arcSegments = useMemo(() => {
    const segments = []
    const colors = ['#198754', '#20c997', '#ffc107', '#fd7e14', '#dc3545']
    const total = 5
    for (let i = 0; i < total; i++) {
      const a1 = Math.PI - (i / total) * Math.PI
      const a2 = Math.PI - ((i + 1) / total) * Math.PI
      const x1 = cx + radius * Math.cos(a1)
      const y1 = cy - radius * Math.sin(a1)
      const x2 = cx + radius * Math.cos(a2)
      const y2 = cy - radius * Math.sin(a2)
      segments.push(
        <path key={i} d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
          fill="none" stroke={colors[i]} strokeWidth={strokeWidth} strokeLinecap="butt" opacity={0.85} />
      )
    }
    return segments
  }, [cx, cy, radius, strokeWidth])

  return (
    <div className="text-center">
      <svg width="240" height="140" viewBox="0 0 240 140">
        {arcSegments}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={darkMode ? '#e0e0e0' : '#212529'} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={darkMode ? '#e0e0e0' : '#212529'} />
        <text x={cx} y={cy + 28} textAnchor="middle" fontSize="28" fontWeight="800" fill={moodColor}>{score}</text>
      </svg>
      <div className="fw-bold mt-1" style={{ fontSize: '17px', color: moodColor, letterSpacing: '0.5px' }}>{mood}</div>
    </div>
  )
}

const IndicatorBar = ({ label, value, score, detail, darkMode }) => {
  const color = getMoodColor(score)
  const bg = darkMode ? '#333' : '#e9ecef'
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '12px', color: darkMode ? '#aaa' : '#6c757d' }}>
          {value != null ? value : '-'}{detail ? ` · ${detail}` : ''}
        </span>
      </div>
      <div style={{ height: '8px', borderRadius: '4px', background: bg, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', borderRadius: '4px', background: color, transition: 'width 0.6s ease' }} />
      </div>
      <div className="d-flex justify-content-between mt-1" style={{ fontSize: '10px', color: darkMode ? '#666' : '#aaa' }}>
        <span>Fear</span>
        <span style={{ fontWeight: 600, color, fontSize: '11px' }}>{score}</span>
        <span>Greed</span>
      </div>
    </div>
  )
}

// Price position bar showing where price sits between S3 and R3
const PricePositionBar = ({ price, s3, r3, pp, darkMode }) => {
  if (!s3 || !r3 || r3 === s3) return null
  const pct2 = Math.max(0, Math.min(100, ((price - s3) / (r3 - s3)) * 100))
  const ppPct = ((pp - s3) / (r3 - s3)) * 100
  return (
    <div style={{ position: 'relative', height: 8, borderRadius: 4, background: darkMode ? '#333' : '#e9ecef', overflow: 'visible', marginTop: 4, marginBottom: 2 }}>
      <div style={{ position: 'absolute', left: `${ppPct}%`, top: -2, width: 2, height: 12, background: '#6f42c1', borderRadius: 1, zIndex: 1 }} />
      <div style={{
        width: `${pct2}%`, height: '100%', borderRadius: 4,
        background: pct2 > 50 ? 'linear-gradient(90deg, #ffc107, #198754)' : 'linear-gradient(90deg, #dc3545, #ffc107)',
        transition: 'width 0.4s ease'
      }} />
      <div style={{
        position: 'absolute', left: `${pct2}%`, top: -3, width: 14, height: 14,
        borderRadius: '50%', background: darkMode ? '#e0e0e0' : '#212529',
        border: `2px solid ${darkMode ? '#262626' : '#fff'}`,
        transform: 'translateX(-7px)', zIndex: 2
      }} />
    </div>
  )
}

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
  const [liveMap, setLiveMap] = useState({})
  const [editing, setEditing] = useState(null)
  const [toast, setToast] = useState('')
  const [mood, setMood] = useState(null)
  const [moodLoading, setMoodLoading] = useState(true)
  const [levels, setLevels] = useState([])
  const [levelsLoading, setLevelsLoading] = useState(true)
  const [tf, setTf] = useState('daily')
  const { darkMode } = useTheme()

  useEffect(() => {
    API.get('/api/index-levels')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))

    API.get('/api/market-mood')
      .then(r => setMood(r.data))
      .catch(e => console.error('Mood fetch error:', e))
      .finally(() => setMoodLoading(false))

    API.get('/api/levels')
      .then(r => setLevels(r.data))
      .catch(e => console.error('Levels fetch error:', e))
      .finally(() => setLevelsLoading(false))
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
  const cardBg = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#333' : '#e5e5e5'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'

  return (
    <>
      <Helmet><title>Index Key Levels - TradingSignals</title></Helmet>
      <div className="p-1">

        {/* ===== MARKET MOOD INDEX ===== */}
        <h5 className="fw-bold mb-1" style={{ color: text }}>Market Mood Index</h5>
        <div className="mb-3" style={{ fontSize: '12px', color: textMuted }}>Composite sentiment from VIX · Breadth · Momentum · 52W Range</div>

        {moodLoading ? <div className="text-center text-muted p-4">Loading mood...</div> : mood ? (
          <>
            {/* Desktop Mood */}
            <div className="d-none d-md-block card shadow-sm mb-4" style={{ background: cardBg, border: `1px solid ${border}` }}>
              <div className="card-body py-3">
                <div className="row align-items-center">
                  <div className="col-md-5 text-center mb-3 mb-md-0">
                    <MoodGauge score={mood.score} mood={mood.mood} darkMode={darkMode} />
                    <div className="d-flex justify-content-center gap-2 mt-2 flex-wrap">
                      {MOOD_ZONES.map(z => (
                        <span key={z.label} style={{ fontSize: '10px', color: z.color, fontWeight: mood.mood === z.label ? 700 : 400, opacity: mood.mood === z.label ? 1 : 0.6 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: z.color, marginRight: 3 }} />
                          {z.label}
                        </span>
                      ))}
                    </div>
                    {mood.niftyChange != null && (
                      <div className="mt-2" style={{ fontSize: '12px', color: textMuted }}>
                        Nifty: <span style={{ color: mood.niftyChange >= 0 ? '#198754' : '#dc3545', fontWeight: 600 }}>{mood.niftyChange > 0 ? '+' : ''}{mood.niftyChange}%</span>
                      </div>
                    )}
                  </div>
                  <div className="col-md-7">
                    {mood.indicators && Object.values(mood.indicators).map((ind, i) => (
                      <IndicatorBar key={i} label={ind.label} value={ind.value} score={ind.score} detail={ind.detail} darkMode={darkMode} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Mood */}
            <div className="d-md-none card shadow-sm mb-4" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16 }}>
              <div className="card-body px-3 py-3">
                <div className="text-center mb-3">
                  <MoodGauge score={mood.score} mood={mood.mood} darkMode={darkMode} />
                </div>
                <div className="d-flex justify-content-center gap-1 mb-3 flex-wrap">
                  {MOOD_ZONES.map(z => (
                    <span key={z.label} className="d-flex align-items-center" style={{
                      fontSize: '11px', color: z.color,
                      fontWeight: mood.mood === z.label ? 700 : 400,
                      opacity: mood.mood === z.label ? 1 : 0.5,
                      background: mood.mood === z.label ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                      padding: '3px 8px', borderRadius: 20
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: z.color, marginRight: 4, flexShrink: 0 }} />
                      {z.label}
                    </span>
                  ))}
                </div>
                {mood.niftyChange != null && (
                  <div className="text-center mb-3" style={{ fontSize: '14px', color: textMuted }}>
                    Nifty Today: <span style={{ color: mood.niftyChange >= 0 ? '#198754' : '#dc3545', fontWeight: 700, fontSize: '15px' }}>{mood.niftyChange > 0 ? '+' : ''}{mood.niftyChange}%</span>
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16 }}>
                  {mood.indicators && Object.values(mood.indicators).map((ind, i) => (
                    <IndicatorBar key={i} label={ind.label} value={ind.value} score={ind.score} detail={ind.detail} darkMode={darkMode} />
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-muted p-4 mb-4">Could not load Market Mood data</div>
        )}

        {/* ===== INDEX KEY LEVELS ===== */}
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

        {/* ===== SUPPORT & RESISTANCE ===== */}
        <h5 className="fw-bold mb-0 mt-4" style={{ color: text }}>Support & Resistance</h5>
        <div className="fw-bold mb-3" style={{ fontSize: '12px', color: textMuted }}>Fibonacci Pivot Points · EMA Pro Strategy · S3–R3 levels</div>

        <div className="d-flex gap-2 mb-3 align-items-center">
          {['daily', 'weekly', 'monthly'].map(t => (
            <button key={t} className={`btn btn-sm ${tf === t ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTf(t)} style={{ fontSize: '13px', padding: '8px 16px', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {levelsLoading ? (
          <>
            <div className="d-none d-md-block"><SkeletonTable rows={8} cols={14} /></div>
            <div className="d-md-none"><SkeletonCards count={4} /></div>
          </>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover" style={{ fontSize: '14px' }}>
                <thead className="table-dark">
                  <tr style={{ verticalAlign: 'middle' }}>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>Prev Low</th>
                    <th>S3</th>
                    <th>S2</th>
                    <th>S1</th>
                    <th>Pivot</th>
                    <th>Pivot Point %</th>
                    <th>R1</th>
                    <th>R2</th>
                    <th>R3</th>
                    <th>EMA Pro</th>
                    <th>Signal</th>
                    <th>Prev High</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.map((row, i) => {
                    const lv = row[tf]
                    const getProximity = (price, level) => {
                      const p = Math.abs((price - level) / price * 100)
                      if (p <= 0.5) return { label: 'At Level', color: '#f9a825' }
                      if (p <= 1.5) return { label: 'Near', color: '#ff9800' }
                      return null
                    }
                    return (
                      <tr key={i} style={{ verticalAlign: 'middle' }}>
                        <td className="fw-bold">{row.symbol}</td>
                        <td>
                          ₹{row.price}
                          {row.pChange != null && <span style={{ fontSize: '11px', color: row.pChange >= 0 ? '#198754' : '#dc3545', marginLeft: 4 }}>({row.pChange > 0 ? '+' : ''}{row.pChange}%)</span>}
                        </td>
                        <td className="level-support fw-bold">{lv.prevLow}</td>
                        {[lv.s3, lv.s2, lv.s1].map((v, j) => {
                          const prox = getProximity(row.price, v)
                          return (
                            <td key={j} className={`level-support ${prox ? 'fw-bold' : ''}`}>
                              {v}{prox && <span className="level-near-dot">●</span>}
                            </td>
                          )
                        })}
                        <td className="fw-bold level-pivot">{lv.pp}</td>
                        <td className="fw-bold" style={{ color: row.price >= lv.pp ? '#198754' : '#dc3545', fontSize: '12px' }}>
                          {((row.price - lv.pp) / lv.pp * 100).toFixed(2)}%
                        </td>
                        {[lv.r1, lv.r2, lv.r3].map((v, j) => {
                          const prox = getProximity(row.price, v)
                          return (
                            <td key={j} className={`level-resistance ${prox ? 'fw-bold' : ''}`}>
                              {v}{prox && <span className="level-near-dot">●</span>}
                            </td>
                          )
                        })}
                        <td className="fw-bold" style={{ color: row.price >= lv.ema7 ? '#198754' : '#dc3545' }}>{lv.ema7 || '-'}</td>
                        <td>
                          {lv.signal && <span className={`badge ${lv.signal === 'Bullish' ? 'bg-success' : lv.signal === 'Bearish' ? 'bg-danger' : lv.signal === 'Above' ? 'text-success' : 'text-danger'}`} style={{ fontSize: '14px' }}>{lv.signal}</span>}
                        </td>
                        <td className="level-resistance fw-bold">{lv.prevHigh}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="d-md-none" style={{ paddingBottom: 10 }}>
              {levels.map((row, i) => {
                const lv = row[tf]
                const ppPct2 = ((row.price - lv.pp) / lv.pp * 100).toFixed(2)
                const isAbovePP = row.price >= lv.pp
                const signalBg = lv.signal === 'Bullish' ? '#198754' : lv.signal === 'Bearish' ? '#dc3545' : lv.signal === 'Above' ? '#20c997' : '#fd7e14'
                const sectionBg = darkMode ? '#262626' : '#f8f9fa'
                const getProximity = (price, level) => {
                  const p = Math.abs((price - level) / price * 100)
                  if (p <= 0.5) return { label: 'At Level', color: '#f9a825' }
                  if (p <= 1.5) return { label: 'Near', color: '#ff9800' }
                  return null
                }

                return (
                  <div key={i} className="card mb-3 shadow" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>
                    <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '22px', color: text, letterSpacing: '0.3px' }}>{row.symbol}</div>
                        {lv.signal && (
                          <span className="badge mt-1" style={{ background: signalBg, fontSize: '13px', padding: '4px 12px', borderRadius: 20 }}>
                            {lv.signal}
                          </span>
                        )}
                      </div>
                      <div className="text-end">
                        <div className="fw-bold" style={{ fontSize: '24px', color: text }}>₹{row.price}</div>
                        {row.pChange != null && (
                          <div style={{ fontSize: '16px', color: row.pChange >= 0 ? '#198754' : '#dc3545', fontWeight: 700 }}>
                            {row.pChange >= 0 ? '▲' : '▼'} {Math.abs(row.pChange)}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="d-flex justify-content-between align-items-center px-3 py-3" style={{ background: sectionBg, borderBottom: `1px solid ${border}` }}>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pivot</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: '#6f42c1' }}>{lv.pp}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PP %</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: isAbovePP ? '#198754' : '#dc3545' }}>
                          {ppPct2 > 0 ? '+' : ''}{ppPct2}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>EMA Pro</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: row.price >= lv.ema7 ? '#198754' : '#dc3545' }}>
                          {lv.ema7 || '-'}
                        </div>
                      </div>
                    </div>
                    <div className="px-3 pt-3 pb-2">
                      <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px', color: textMuted }}>
                        <span>S3: {lv.s3}</span>
                        <span style={{ fontWeight: 700, color: text }}>Price Position</span>
                        <span>R3: {lv.r3}</span>
                      </div>
                      <PricePositionBar price={row.price} s3={lv.s3} r3={lv.r3} pp={lv.pp} darkMode={darkMode} />
                    </div>
                    <div className="px-3 pt-2 pb-3">
                      <div className="row g-0">
                        <div className="col-6 pe-2">
                          <div className="mb-2" style={{ fontSize: '13px', fontWeight: 700, color: '#dc3545', textTransform: 'uppercase' }}>▼ Support</div>
                          {[
                            { label: 'S1', val: lv.s1 },
                            { label: 'S2', val: lv.s2 },
                            { label: 'S3', val: lv.s3 },
                            { label: 'Prev Low', val: lv.prevLow },
                          ].map((item, j) => {
                            const prox = getProximity(row.price, item.val)
                            return (
                              <div key={j} className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: j < 3 ? `1px solid ${darkMode ? '#2a2a2a' : '#f0f0f0'}` : 'none' }}>
                                <span style={{ fontSize: '14px', color: textMuted }}>{item.label}</span>
                                <div className="d-flex align-items-center gap-1">
                                  {prox && <span style={{ width: 7, height: 7, borderRadius: '50%', background: prox.color, flexShrink: 0 }} />}
                                  <span className="fw-bold" style={{ fontSize: '16px', color: '#dc3545' }}>{item.val}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div className="col-6 ps-2" style={{ borderLeft: `1px solid ${border}` }}>
                          <div className="mb-2" style={{ fontSize: '13px', fontWeight: 700, color: '#198754', textTransform: 'uppercase' }}>▲ Resistance</div>
                          {[
                            { label: 'R1', val: lv.r1 },
                            { label: 'R2', val: lv.r2 },
                            { label: 'R3', val: lv.r3 },
                            { label: 'Prev High', val: lv.prevHigh },
                          ].map((item, j) => {
                            const prox = getProximity(row.price, item.val)
                            return (
                              <div key={j} className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: j < 3 ? `1px solid ${darkMode ? '#2a2a2a' : '#f0f0f0'}` : 'none' }}>
                                <span style={{ fontSize: '14px', color: textMuted }}>{item.label}</span>
                                <div className="d-flex align-items-center gap-1">
                                  {prox && <span style={{ width: 7, height: 7, borderRadius: '50%', background: prox.color, flexShrink: 0 }} />}
                                  <span className="fw-bold" style={{ fontSize: '16px', color: '#198754' }}>{item.val}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}
