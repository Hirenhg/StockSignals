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

const pct = (from, to) => from ? ((to - from) / from * 100).toFixed(2) : null
const PctBadge = ({ val }) => {
  if (val === null) return <span className="text-muted">-</span>
  const n = parseFloat(val)
  return <span style={{ color: n >= 0 ? '#198754' : '#dc3545', fontWeight: 600, fontSize: 12 }}>{n >= 0 ? '+' : ''}{val}%</span>
}

function LevelCard({ item, darkMode, livePrice, livePChange }) {
  const bg = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#2a2a2a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const muted = darkMode ? '#888' : '#6c757d'
  const subBg = darkMode ? '#262626' : '#f8f9fa'
  const price = livePrice !== undefined ? livePrice : item.cmp
  const priceStr = Number(price.toFixed ? price.toFixed(2) : price).toLocaleString('en-IN')

  return (
    <div className="card shadow-sm mb-3" style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12 }}>
      {/* Header row */}
      <div className="d-flex justify-content-between align-items-center px-3 py-2" style={{ borderBottom: `1px solid ${border}` }}>
        <div>
          <span className="fw-bold" style={{ fontSize: 15, color: text }}>{item.symbol}</span>
          <span className="ms-2" style={{ fontSize: 11, color: muted }}>{item.date}</span>
        </div>
        <div className="text-end">
          <span className="fw-bold" style={{ fontSize: 18, color: '#2962FF' }}>{priceStr}</span>
          {livePChange !== undefined && (
            <span className="ms-2" style={{ fontSize: 12, fontWeight: 700, color: livePChange >= 0 ? '#198754' : '#dc3545' }}>
              {livePChange >= 0 ? '▲' : '▼'} {Math.abs(livePChange)}%
            </span>
          )}
        </div>
      </div>

      {/* Buy / Sell columns */}
      <div className="row g-0">
        {/* Bullish */}
        <div className="col-6" style={{ borderRight: `1px solid ${border}` }}>
          <div className="px-3 py-2">
            <div className="mb-1" style={{ fontSize: 13, fontWeight: 700, color: '#198754', textTransform: 'uppercase', letterSpacing: 0.5 }}>▲ Buy Above</div>
            <div className="fw-bold" style={{ fontSize: 20, color: '#198754' }}>{Number(item.bullishAbove).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>
              T1 <span className="fw-bold" style={{ color: '#198754' }}>{Number(item.bullishTargets[0]).toLocaleString('en-IN')}</span>
              <span className="mx-1" style={{ color: border }}>·</span>
              T2 <span className="fw-bold" style={{ color: '#198754' }}>{Number(item.bullishTargets[1]).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ fontSize: 13, color: '#fd7e14', marginTop: 3 }}>SL {Number(item.bearishBelow).toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Bearish */}
        <div className="col-6">
          <div className="px-3 py-2">
            <div className="mb-1" style={{ fontSize: 13, fontWeight: 700, color: '#dc3545', textTransform: 'uppercase', letterSpacing: 0.5 }}>▼ Sell Below</div>
            <div className="fw-bold" style={{ fontSize: 20, color: '#dc3545' }}>{Number(item.bearishBelow).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: 14, color: muted, marginTop: 4 }}>
              T1 <span className="fw-bold" style={{ color: '#dc3545' }}>{Number(item.bearishTargets[0]).toLocaleString('en-IN')}</span>
              <span className="mx-1" style={{ color: border }}>·</span>
              T2 <span className="fw-bold" style={{ color: '#dc3545' }}>{Number(item.bearishTargets[1]).toLocaleString('en-IN')}</span>
            </div>
            <div style={{ fontSize: 13, color: '#fd7e14', marginTop: 3 }}>SL {Number(item.bullishAbove).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Note */}
      {item.note && (
        <div className="px-3 py-2" style={{ borderTop: `1px solid ${border}`, background: subBg, borderRadius: '0 0 12px 12px' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: darkMode ? '#fd7e14' : '#fd7e14' }}> {item.note}</span>
        </div>
      )}
    </div>
  )
}

// symbol → Yahoo Finance symbol mapping for live price
const LIVE_SYMBOL_MAP = { NIFTY: '^NSEI', BANKNIFTY: '^NSEBANK', SENSEX: '^BSESN' }

export default function IndexLevels() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [liveMap, setLiveMap] = useState({})
  const [toast, setToast] = useState('')
  const [autoRefreshing, setAutoRefreshing] = useState(false)
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

  const handleAutoRefresh = async () => {
    setAutoRefreshing(true)
    try {
      const r = await API.get('/api/index-levels/refresh')
      setData(r.data)
      setToast('Levels auto-updated from EMA Pro!')
      setTimeout(() => setToast(''), 3000)
    } catch (e) { setToast('Auto-update failed: ' + (e.response?.data?.detail || e.response?.data?.error || e.message || 'Unknown error')) }
    finally { setAutoRefreshing(false) }
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
        <h5 className="fw-bold mb-1" style={{ color: text }}>Index Key Levels</h5>
        <p className="mb-3" style={{ fontSize: 13, color: muted }}>
          Daily updated key levels for NIFTY & SENSEX — Bullish/Bearish zones with targets
        </p>

        {toast && <div className="alert alert-success py-2 px-3 mb-3" style={{ fontSize: 13 }}>{toast}</div>}

        <div className="mb-3">
          <button className="btn btn-sm btn-outline-primary" onClick={handleAutoRefresh} disabled={autoRefreshing}>
            {autoRefreshing ? '⏳ Updating...' : 'Auto-Update Levels'}
          </button>
        </div>


        {loading ? (
          <div className="text-center text-muted p-4">Loading...</div>
        ) : (
          <>
            {/* Level Cards */}
            {data.map(item => {
              const live = liveMap[item.symbol]
              return <LevelCard key={item.symbol} item={item} darkMode={darkMode} livePrice={live?.price} livePChange={live?.pChange} />
            })}


          </>
        )}

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
