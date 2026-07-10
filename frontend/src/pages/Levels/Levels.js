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

const MoodSkeleton = ({ darkMode }) => {
  const bg = darkMode ? '#333' : '#e5e5e5'
  return (
    <div className="card shadow-sm mb-4" style={{ background: darkMode ? '#262626' : '#fff', border: `1px solid ${darkMode ? '#3a3a3a' : '#e9ecef'}` }}>
      <div className="card-body">
        <div className="text-center mb-3">
          <div className="skeleton-box mx-auto" style={{ width: 200, height: 120, borderRadius: 12, background: bg }} />
          <div className="skeleton-box mx-auto mt-2" style={{ width: 120, height: 20, borderRadius: 6, background: bg }} />
        </div>
        {[1,2,3,4].map(i => (
          <div key={i} className="mb-3">
            <div className="skeleton-box mb-1" style={{ width: '60%', height: 14, borderRadius: 4, background: bg }} />
            <div className="skeleton-box" style={{ width: '100%', height: 8, borderRadius: 4, background: bg }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Price position bar showing where price sits between S3 and R3
const PricePositionBar = ({ price, s3, r3, pp, darkMode }) => {
  if (!s3 || !r3 || r3 === s3) return null
  const pct = Math.max(0, Math.min(100, ((price - s3) / (r3 - s3)) * 100))
  const ppPct = ((pp - s3) / (r3 - s3)) * 100
  return (
    <div style={{ position: 'relative', height: 8, borderRadius: 4, background: darkMode ? '#333' : '#e9ecef', overflow: 'visible', marginTop: 4, marginBottom: 2 }}>
      {/* Pivot marker */}
      <div style={{ position: 'absolute', left: `${ppPct}%`, top: -2, width: 2, height: 12, background: '#6f42c1', borderRadius: 1, zIndex: 1 }} />
      {/* Price fill */}
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 4,
        background: pct > 50 ? 'linear-gradient(90deg, #ffc107, #198754)' : 'linear-gradient(90deg, #dc3545, #ffc107)',
        transition: 'width 0.4s ease'
      }} />
      {/* Price dot */}
      <div style={{
        position: 'absolute', left: `${pct}%`, top: -3, width: 14, height: 14,
        borderRadius: '50%', background: darkMode ? '#e0e0e0' : '#212529',
        border: `2px solid ${darkMode ? '#262626' : '#fff'}`,
        transform: 'translateX(-7px)', zIndex: 2
      }} />
    </div>
  )
}

export default function Levels() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [tf, setTf] = useState('daily')
  const [mood, setMood] = useState(null)
  const [moodLoading, setMoodLoading] = useState(true)
  const [watchlist, setWatchlist] = useState([])
  const [wlLoading, setWlLoading] = useState(true)
  const [wlSort, setWlSort] = useState('desc')
  const [statusFilter, setStatusFilter] = useState('All')
  const [volumeFilter, setVolumeFilter] = useState('All')
  const [recs, setRecs] = useState([])
  const [past, setPast] = useState([])
  const [recsLoading, setRecsLoading] = useState(true)
  const { darkMode } = useTheme()

  const cardBg = darkMode ? '#1e1e1e' : '#fff'
  const border = darkMode ? '#333' : '#e5e5e5'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'
  const sectionBg = darkMode ? '#262626' : '#f8f9fa'

  useEffect(() => {
    API.get('/api/levels')
      .then(r => setData(r.data))
      .catch(e => console.error('Levels fetch error:', e))
      .finally(() => setLoading(false))

    API.get('/api/market-mood')
      .then(r => setMood(r.data))
      .catch(e => console.error('Mood fetch error:', e))
      .finally(() => setMoodLoading(false))

    API.get('/api/watchlist-analysis')
      .then(r => setWatchlist(r.data))
      .catch(e => console.error('Watchlist analysis fetch error:', e))
      .finally(() => setWlLoading(false))

    Promise.all([API.get('/api/recommendations'), API.get('/api/past-performance')])
      .then(([r, p]) => { setRecs(r.data || []); setPast(p.data || []) })
      .catch(() => {})
      .finally(() => setRecsLoading(false))
  }, [])

  const getProximity = (price, level) => {
    const pct = Math.abs((price - level) / price * 100)
    if (pct <= 0.5) return { label: 'At Level', color: '#f9a825' }
    if (pct <= 1.5) return { label: 'Near', color: '#ff9800' }
    return null
  }

  return (
    <>
      <Helmet><title>Support & Resistance - TradingSignals</title></Helmet>
      <div className="p-1">

        {/* ===== MARKET MOOD INDEX ===== */}
        <h5 className="fw-bold mb-1" style={{ color: text }}>Market Mood Index</h5>
        <div className="mb-3" style={{ fontSize: '12px', color: textMuted }}>Composite sentiment from VIX · Breadth · Momentum · 52W Range</div>

        {moodLoading ? <MoodSkeleton darkMode={darkMode} /> : mood ? (
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
                {/* Gauge centered */}
                <div className="text-center mb-3">
                  <MoodGauge score={mood.score} mood={mood.mood} darkMode={darkMode} />
                </div>
                {/* Zone legend */}
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
                {/* Indicator bars */}
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

        {/* ===== SUPPORT & RESISTANCE ===== */}
        <h5 className="fw-bold mb-0" style={{ color: text }}>Support & Resistance</h5>
        <div className="fw-bold mb-3" style={{ fontSize: '12px', color: textMuted }}>Fibonacci Pivot Points · EMA Pro Strategy · S3–R3 levels</div>

        <div className="d-flex gap-2 mb-3 align-items-center">
          {['daily', 'weekly', 'monthly'].map(t => (
            <button key={t} className={`btn btn-sm ${tf === t ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTf(t)} style={{ fontSize: '13px', padding: '8px 16px', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
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
                  {data.map((row, i) => {
                    const levels = row[tf]
                    return (
                      <tr key={i} style={{ verticalAlign: 'middle' }}>
                        <td className="fw-bold">{row.symbol}</td>
                        <td>
                          ₹{row.price}
                          {row.pChange != null && <span style={{ fontSize: '11px', color: row.pChange >= 0 ? '#198754' : '#dc3545', marginLeft: 4 }}>({row.pChange > 0 ? '+' : ''}{row.pChange}%)</span>}
                        </td>
                        <td className="level-support fw-bold">{levels.prevLow}</td>
                        {[levels.s3, levels.s2, levels.s1].map((v, j) => {
                          const prox = getProximity(row.price, v)
                          return (
                            <td key={j} className={`level-support ${prox ? 'fw-bold' : ''}`}>
                              {v}{prox && <span className="level-near-dot">●</span>}
                            </td>
                          )
                        })}
                        <td className="fw-bold level-pivot">{levels.pp}</td>
                        <td className="fw-bold" style={{ color: row.price >= levels.pp ? '#198754' : '#dc3545', fontSize: '12px' }}>
                          {((row.price - levels.pp) / levels.pp * 100).toFixed(2)}%
                        </td>
                        {[levels.r1, levels.r2, levels.r3].map((v, j) => {
                          const prox = getProximity(row.price, v)
                          return (
                            <td key={j} className={`level-resistance ${prox ? 'fw-bold' : ''}`}>
                              {v}{prox && <span className="level-near-dot">●</span>}
                            </td>
                          )
                        })}
                        <td className="fw-bold" style={{ color: row.price >= levels.ema7 ? '#198754' : '#dc3545' }}>{levels.ema7 || '-'}</td>
                        <td>
                          {levels.signal && <span className={`badge ${levels.signal === 'Bullish' ? 'bg-success' : levels.signal === 'Bearish' ? 'bg-danger' : levels.signal === 'Above' ? 'text-success' : 'text-danger'}`} style={{ fontSize: '14px' }}>{levels.signal}</span>}
                        </td>
                        <td className="level-resistance fw-bold">{levels.prevHigh}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ===== MOBILE CARDS ===== */}
            <div className="d-md-none" style={{ paddingBottom: 10 }}>
              {data.map((row, i) => {
                const levels = row[tf]
                const ppPct = ((row.price - levels.pp) / levels.pp * 100).toFixed(2)
                const isAbovePP = row.price >= levels.pp
                const signalBg = levels.signal === 'Bullish' ? '#198754' : levels.signal === 'Bearish' ? '#dc3545' : levels.signal === 'Above' ? '#20c997' : '#fd7e14'

                return (
                  <div key={i} className="card mb-3 shadow" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>

                    {/* Header */}
                    <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '22px', color: text, letterSpacing: '0.3px' }}>{row.symbol}</div>
                        {levels.signal && (
                          <span className="badge mt-1" style={{ background: signalBg, fontSize: '13px', padding: '4px 12px', borderRadius: 20 }}>
                            {levels.signal}
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

                    {/* Pivot + PP% + EMA */}
                    <div className="d-flex justify-content-between align-items-center px-3 py-3" style={{ background: sectionBg, borderBottom: `1px solid ${border}` }}>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pivot</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: '#6f42c1' }}>{levels.pp}</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>PP %</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: isAbovePP ? '#198754' : '#dc3545' }}>
                          {ppPct > 0 ? '+' : ''}{ppPct}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>EMA Pro</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: row.price >= levels.ema7 ? '#198754' : '#dc3545' }}>
                          {levels.ema7 || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Price Position Bar */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px', color: textMuted }}>
                        <span>S3: {levels.s3}</span>
                        <span style={{ fontWeight: 700, color: text }}>Price Position</span>
                        <span>R3: {levels.r3}</span>
                      </div>
                      <PricePositionBar price={row.price} s3={levels.s3} r3={levels.r3} pp={levels.pp} darkMode={darkMode} />
                    </div>

                    {/* Support & Resistance */}
                    <div className="px-3 pt-2 pb-3">
                      <div className="row g-0">
                        <div className="col-6 pe-2">
                          <div className="mb-2" style={{ fontSize: '13px', fontWeight: 700, color: '#dc3545', textTransform: 'uppercase' }}>▼ Support</div>
                          {[
                            { label: 'S1', val: levels.s1 },
                            { label: 'S2', val: levels.s2 },
                            { label: 'S3', val: levels.s3 },
                            { label: 'Prev Low', val: levels.prevLow },
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
                            { label: 'R1', val: levels.r1 },
                            { label: 'R2', val: levels.r2 },
                            { label: 'R3', val: levels.r3 },
                            { label: 'Prev High', val: levels.prevHigh },
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

        {/* ===== WATCHLIST ANALYSIS ===== */}
        <h5 className="fw-bold mb-3 mt-4" style={{ color: text }}>Watchlist Stock Analysis</h5>
        <div className="mb-3" style={{ fontSize: '12px', color: textMuted }}>EMA Pro Daily/Weekly/Monthly · 50 & 200 EMA Cross · RSI · Volume · Status · Upside % · Target & Stop Loss</div>

        <div className="d-flex gap-2 mb-3 flex-wrap">
          <select className="form-select" style={{ width: 'auto', fontSize: '14px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Strong Buy">Strong Buy</option>
            <option value="Momentum Buy">Momentum Buy</option>
            <option value="Buy on Dip">Buy on Dip</option>
            <option value="Strong Support">Strong Support</option>
            <option value="Hold">Hold</option>
            <option value="Weak">Weak</option>
          </select>
          <select className="form-select" style={{ width: 'auto', fontSize: '14px' }} value={volumeFilter} onChange={e => setVolumeFilter(e.target.value)}>
            <option value="All">All Volume</option>
            <option value="Good">Good</option>
            <option value="Average">Average</option>
            <option value="Bad">Bad</option>
          </select>
        </div>

        {wlLoading ? (
          <div className="d-none d-md-block"><SkeletonTable rows={5} cols={12} /></div>
        ) : watchlist.length === 0 ? (
          <div className="text-center text-muted p-4">No watchlist stocks found</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="d-none d-md-block table-responsive mb-4">
              <table className="table table-hover" style={{ fontSize: '14px' }}>
                <thead className="table-dark">
                  <tr style={{ verticalAlign: 'middle' }}>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>EMA Pro Daily</th>
                    <th>EMA Pro Weekly</th>
                    <th>EMA Pro Monthly</th>
                    <th>50 EMA</th>
                    <th>200 EMA</th>
                    <th>RSI</th>
                    <th>Volume</th>
                    <th>Status</th>
                    <th>Up Chance <button onClick={() => setWlSort(s => s === 'desc' ? 'asc' : 'desc')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '13px', padding: '0 4px' }}>{wlSort === 'desc' ? '▼' : '▲'}</button></th>
                    <th>Target</th>
                    <th>Stop Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {[...watchlist].filter(r => (statusFilter === 'All' || r.status === statusFilter) && (volumeFilter === 'All' || r.volume === volumeFilter)).sort((a, b) => wlSort === 'desc' ? b.upChancePct - a.upChancePct : a.upChancePct - b.upChancePct).map((row, i) => {
                    const statusColor = {
                      'Strong Buy': '#198754', 'Momentum Buy': '#20c997',
                      'Buy on Dip': '#0d6efd', 'Strong Support': '#6f42c1',
                      'Hold': '#ffc107', 'Weak': '#dc3545'
                    }[row.status] || textMuted
                    const volColor = row.volume === 'Good' ? '#198754' : row.volume === 'Bad' ? '#dc3545' : '#ffc107'
                    const rsiColor = row.rsi > 70 ? '#dc3545' : row.rsi < 30 ? '#198754' : row.rsi > 55 ? '#20c997' : textMuted
                    return (
                      <tr key={i} style={{ verticalAlign: 'middle' }}>
                        <td className="fw-bold">{row.symbol}</td>
                        <td>
                          <div className="fw-bold">₹{row.price}</div>
                        </td>
                        <td style={{ color: row.ema7Daily && row.price >= row.ema7Daily ? '#198754' : '#dc3545' }}>
                          {row.ema7Daily ?? '-'}
                        </td>
                        <td style={{ color: row.ema7Weekly && row.price >= row.ema7Weekly ? '#198754' : '#dc3545' }}>
                          {row.ema7Weekly ?? '-'}
                        </td>
                        <td style={{ color: row.ema7Monthly && row.price >= row.ema7Monthly ? '#198754' : '#dc3545' }}>
                          {row.ema7Monthly ?? '-'}
                        </td>
                        <td>
                          {row.ema50Above == null ? '-' : (
                            <span className={`badge ${row.ema50Above ? 'bg-success' : 'bg-danger'}`}>{row.ema50Above ? 'YES ✓' : 'NO ✗'}</span>
                          )}
                        </td>
                        <td>
                          {row.ema200Above == null ? '-' : (
                            <span className={`badge ${row.ema200Above ? 'bg-success' : 'bg-danger'}`}>{row.ema200Above ? 'YES ✓' : 'NO ✗'}</span>
                          )}
                        </td>
                        <td style={{ color: rsiColor, fontWeight: 600 }}>{row.rsi ?? '-'}</td>
                        <td style={{ color: volColor, fontWeight: 600 }}>{row.volume}</td>
                        <td>
                          <span className="badge" style={{ background: statusColor, fontSize: '12px' }}>{row.status}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: row.upChancePct >= 70 ? '#198754' : row.upChancePct >= 50 ? '#ffc107' : '#dc3545' }}>
                            {row.upChancePct}%
                          </span>
                        </td>
                        <td className="fw-bold" style={{ color: '#198754' }}>
                          ₹{row.target}
                          <div style={{ fontSize: '11px', fontWeight: 400 }}>+{row.targetPct}%</div>
                        </td>
                        <td className="fw-bold" style={{ color: '#dc3545' }}>
                          ₹{row.stopLoss}
                          <div style={{ fontSize: '11px', fontWeight: 400 }}>{row.stopLossPct}%</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="d-md-none" style={{ paddingBottom: 10 }}>
              {watchlist.filter(r => (statusFilter === 'All' || r.status === statusFilter) && (volumeFilter === 'All' || r.volume === volumeFilter)).map((row, i) => {
                const statusColor = {
                  'Strong Buy': '#198754', 'Momentum Buy': '#20c997',
                  'Buy on Dip': '#0d6efd', 'Strong Support': '#6f42c1',
                  'Hold': '#ffc107', 'Weak': '#dc3545'
                }[row.status] || textMuted
                const volColor = row.volume === 'Good' ? '#198754' : row.volume === 'Bad' ? '#dc3545' : '#ffc107'
                const rsiColor = row.rsi > 70 ? '#dc3545' : row.rsi < 30 ? '#198754' : row.rsi > 55 ? '#20c997' : textMuted

                return (
                  <div key={i} className="card mb-3 shadow" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 16, overflow: 'hidden' }}>

                    {/* Header — Symbol + Price */}
                    <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${border}` }}>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '22px', color: text, letterSpacing: '0.3px' }}>{row.symbol}</div>
                        <span className="badge mt-1" style={{ background: statusColor, fontSize: '13px', padding: '4px 12px', borderRadius: 20 }}>{row.status}</span>
                      </div>
                      <div className="text-end">
                        <div className="fw-bold" style={{ fontSize: '24px', color: text }}>₹{row.price}</div>

                      </div>
                    </div>

                    {/* EMA Row */}
                    <div className="d-flex justify-content-between align-items-center px-3 py-3" style={{ background: sectionBg, borderBottom: `1px solid ${border}` }}>
                      {[['EMA Pro D', row.ema7Daily, row.price >= row.ema7Daily], ['EMA Pro W', row.ema7Weekly, row.price >= row.ema7Weekly], ['EMA Pro M', row.ema7Monthly, row.price >= row.ema7Monthly]].map(([lbl, val, up]) => (
                        <div key={lbl} className="text-center">
                          <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lbl}</div>
                          <div className="fw-bold" style={{ fontSize: '18px', color: val ? (up ? '#198754' : '#dc3545') : textMuted }}>{val ?? '-'}</div>
                        </div>
                      ))}
                    </div>

                    {/* EMA Cross + RSI + Volume */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="row g-0">
                        <div className="col-6 pe-2">
                          <div className="mb-2" style={{ fontSize: '13px', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>EMA Cross</div>
                          {[['50 EMA', row.ema50Above], ['200 EMA', row.ema200Above]].map(([lbl, above]) => (
                            <div key={lbl} className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: `1px solid ${darkMode ? '#2a2a2a' : '#f0f0f0'}` }}>
                              <span style={{ fontSize: '14px', color: textMuted }}>{lbl}</span>
                              <span className={`badge ${above ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '13px' }}>
                                {above == null ? '-' : above ? 'YES ✓' : 'NO ✗'}
                              </span>
                            </div>
                          ))}
                          <div className="d-flex justify-content-between align-items-center py-1">
                            <span style={{ fontSize: '14px', color: textMuted }}>Volume</span>
                            <span className="fw-bold" style={{ fontSize: '16px', color: volColor }}>{row.volume}</span>
                          </div>
                        </div>
                        <div className="col-6 ps-2" style={{ borderLeft: `1px solid ${border}` }}>
                          <div className="mb-2" style={{ fontSize: '13px', fontWeight: 700, color: textMuted, textTransform: 'uppercase' }}>Signals</div>
                          <div className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: `1px solid ${darkMode ? '#2a2a2a' : '#f0f0f0'}` }}>
                            <span style={{ fontSize: '14px', color: textMuted }}>RSI</span>
                            <span className="fw-bold" style={{ fontSize: '16px', color: rsiColor }}>{row.rsi ?? '-'}</span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center py-1" style={{ borderBottom: `1px solid ${darkMode ? '#2a2a2a' : '#f0f0f0'}` }}>
                            <span style={{ fontSize: '14px', color: textMuted }}>Up Chance</span>
                            <span className="fw-bold" style={{ fontSize: '16px', color: row.upChancePct >= 70 ? '#198754' : row.upChancePct >= 50 ? '#ffc107' : '#dc3545' }}>{row.upChancePct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Target + Stop Loss */}
                    <div className="d-flex justify-content-between align-items-center px-3 py-3" style={{ background: sectionBg, borderTop: `1px solid ${border}` }}>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: '#198754' }}>₹{row.target}</div>
                        <div style={{ fontSize: '13px', color: '#198754' }}>+{row.targetPct}%</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Risk:Reward</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: text }}>1 : 2</div>
                      </div>
                      <div className="text-center">
                        <div style={{ fontSize: '12px', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stop Loss</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: '#dc3545' }}>₹{row.stopLoss}</div>
                        <div style={{ fontSize: '13px', color: '#dc3545' }}>{row.stopLossPct}%</div>
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          </>
        )}
        {/* ===== BUY RECOMMENDATIONS ===== */}
        <h5 className="fw-bold mb-3 mt-4" style={{ color: text }}>Buy Recommendations</h5>

        {recsLoading ? (
          <div className="d-none d-md-block"><SkeletonTable rows={4} cols={8} /></div>
        ) : recs.length === 0 ? (
          <div className="text-center text-muted py-4">No recommendations</div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="d-none d-md-block table-responsive mb-4">
              <table className="table table-hover" style={{ fontSize: '13px' }}>
                <thead className="table-dark">
                  <tr><th>Name</th><th>Rec. Price</th><th>Target</th><th>Stop Loss</th><th>Upside</th><th>Duration</th><th>Date</th><th>Sector</th></tr>
                </thead>
                <tbody>
                  {recs.map(r => (
                    <tr key={r.id}>
                      <td className="fw-bold">{r.name}</td>
                      <td>₹{r.recommendedPrice}</td>
                      <td style={{ color: '#198754', fontWeight: 'bold' }}>₹{r.targetPrice}</td>
                      <td style={{ color: '#dc3545', fontWeight: 'bold' }}>₹{r.stopLoss}</td>
                      <td style={{ color: '#0d6efd', fontWeight: 'bold' }}>10%</td>
                      <td>{r.duration || '-'}</td>
                      <td>{r.date || '-'}</td>
                      <td>{r.sector || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="d-md-none">
              {recs.map(r => (
                <div key={r.id} className="card mb-3 shadow-sm" style={{ borderLeft: '4px solid #198754', background: cardBg, border: `1px solid ${border}` }}>
                  <div className="card-body px-3 py-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="fw-bold" style={{ fontSize: '17px', color: text }}>{r.name}</span>
                      <span style={{ fontSize: '13px', color: textMuted }}>{r.sector || '-'}</span>
                    </div>
                    <div className="row g-2">
                      <div className="col-4"><small style={{ color: textMuted }}>Rec. Price</small><div className="fw-bold" style={{ color: text }}>₹{r.recommendedPrice}</div></div>
                      <div className="col-4"><small style={{ color: textMuted }}>Target</small><div className="fw-bold" style={{ color: '#198754' }}>₹{r.targetPrice}</div></div>
                      <div className="col-4"><small style={{ color: textMuted }}>Stop Loss</small><div className="fw-bold" style={{ color: '#dc3545' }}>₹{r.stopLoss}</div></div>
                    </div>
                    <div className="row g-2 mt-1">
                      <div className="col-4"><small style={{ color: textMuted }}>Upside</small><div className="fw-bold" style={{ color: '#0d6efd' }}>10%</div></div>
                      <div className="col-4"><small style={{ color: textMuted }}>Duration</small><div style={{ fontSize: '13px', color: text }}>{r.duration || '-'}</div></div>
                      <div className="col-4"><small style={{ color: textMuted }}>Date</small><div style={{ fontSize: '13px', color: text }}>{r.date || '-'}</div></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ===== PAST PERFORMANCE ===== */}
        {!recsLoading && past.length > 0 && (() => {
          const totalCalls = past.length
          const successCalls = past.filter(p => p.sellPrice > p.buyPrice).length
          const successRate = ((successCalls / totalCalls) * 100).toFixed(1)
          const avgDuration = Math.round(past.reduce((sum, p) => sum + Math.ceil((new Date(p.sellDate) - new Date(p.buyDate)) / 86400000), 0) / totalCalls)
          const avgReturn = (past.reduce((sum, p) => sum + ((p.sellPrice - p.buyPrice) / p.buyPrice * 100), 0) / totalCalls).toFixed(1)
          const annualReturn = avgDuration > 0 ? ((avgReturn / avgDuration) * 365).toFixed(1) : 0
          return (
            <>
              <h5 className="fw-bold mt-4 mb-3" style={{ color: text }}>Past Performance</h5>
              <div className="row g-2 mb-3">
                {[{ label: 'Total Calls', value: totalCalls }, { label: 'Exited Calls', value: totalCalls }, { label: 'Success Rate', value: `${successRate}%` }, { label: 'Avg. Duration', value: `${avgDuration} days` }, { label: 'Annual Returns', value: `${annualReturn}%` }].map((s, i) => (
                  <div key={i} className="col-6 col-md">
                    <div className="rounded p-2 text-center" style={{ border: `1px solid ${border}`, background: sectionBg }}>
                      <div style={{ fontSize: '12px', color: textMuted }}>{s.label}</div>
                      <div className="fw-bold" style={{ fontSize: '16px', color: text }}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="d-none d-md-block table-responsive mb-4">
                <table className="table table-hover" style={{ fontSize: '13px' }}>
                  <thead className="table-dark">
                    <tr><th>Name</th><th>Buy Price</th><th>Buy Date</th><th>Sell Price</th><th>Sell Date</th><th>Returns</th><th>Duration</th><th>Sector</th></tr>
                  </thead>
                  <tbody>
                    {past.map(p => {
                      const ret = ((p.sellPrice - p.buyPrice) / p.buyPrice * 100).toFixed(1)
                      const days = Math.ceil((new Date(p.sellDate) - new Date(p.buyDate)) / 86400000)
                      return (
                        <tr key={p.id}>
                          <td className="fw-bold">{p.name}</td>
                          <td>₹{p.buyPrice}</td>
                          <td>{p.buyDate}</td>
                          <td>₹{p.sellPrice}</td>
                          <td>{p.sellDate}</td>
                          <td style={{ color: ret >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold' }}>{ret >= 0 ? '+' : ''}{ret}%</td>
                          <td>{days} days</td>
                          <td>{p.sector || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="d-md-none" style={{ paddingBottom: 10 }}>
                {past.map(p => {
                  const ret = ((p.sellPrice - p.buyPrice) / p.buyPrice * 100).toFixed(1)
                  const days = Math.ceil((new Date(p.sellDate) - new Date(p.buyDate)) / 86400000)
                  return (
                    <div key={p.id} className="card mb-3 shadow-sm" style={{ borderLeft: `4px solid ${ret >= 0 ? '#198754' : '#dc3545'}`, background: cardBg, border: `1px solid ${border}` }}>
                      <div className="card-body px-3 py-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <span className="fw-bold" style={{ fontSize: '17px', color: text }}>{p.name}</span>
                          <span className="fw-bold" style={{ fontSize: '15px', color: ret >= 0 ? '#198754' : '#dc3545' }}>{ret >= 0 ? '+' : ''}{ret}%</span>
                        </div>
                        <div className="row g-2">
                          <div className="col-6"><small style={{ color: textMuted }}>Buy</small><div style={{ color: text }}>₹{p.buyPrice} · {p.buyDate}</div></div>
                          <div className="col-6"><small style={{ color: textMuted }}>Sell</small><div style={{ color: text }}>₹{p.sellPrice} · {p.sellDate}</div></div>
                          <div className="col-6"><small style={{ color: textMuted }}>Duration</small><div style={{ color: text }}>{days} days</div></div>
                          <div className="col-6"><small style={{ color: textMuted }}>Sector</small><div style={{ color: text }}>{p.sector || '-'}</div></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        })()}

      </div>
    </>
  )
}
