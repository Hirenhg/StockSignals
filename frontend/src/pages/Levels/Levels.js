import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable } from '../../components/Skeleton/Skeleton'
import { useTheme } from '../../context/ThemeContext'

export default function Levels() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [tf, setTf] = useState('weekly')
  const { darkMode } = useTheme()

  const bg2 = darkMode ? '#262626' : '#f8f9fa'
  const border = darkMode ? '#3a3a3a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'

  useEffect(() => {
    API.get('/api/levels')
      .then(r => setData(r.data))
      .catch(e => console.error('Levels fetch error:', e))
      .finally(() => setLoading(false))
  }, [])

  const getProximity = (price, level) => {
    const pct = Math.abs((price - level) / price * 100)
    if (pct <= 0.5) return { label: 'At Level', color: '#f9a825' }
    if (pct <= 1.5) return { label: 'Near', color: '#ff9800' }
    return null
  }

  const levelClass = (type) => type === 'support' ? 'level-support' : type === 'resistance' ? 'level-resistance' : 'level-pivot'

  return (
    <>
      <Helmet><title>Support & Resistance - StockSignal</title></Helmet>
      <div className="p-1">
        <h5 className="fw-bold mb-0" style={{ color: text }}>Support & Resistance</h5>
        <div className="fw-bold mb-3" style={{ fontSize: '12px', color: textMuted }}>Fibonacci Pivot Points · 7 EMA Strategy · S3–R3 levels</div>

        <div className="d-flex gap-2 mb-3 align-items-center">
          {['weekly', 'monthly'].map(t => (
            <button key={t} className={`btn btn-sm ${tf === t ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTf(t)} style={{ fontSize: '13px', padding: '8px 16px', textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>

        {loading ? <SkeletonTable rows={8} cols={9} /> : (
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
                    <th>7 EMA</th>
                    <th>Signal</th>
                    <th>Prev High</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => {
                    const levels = tf === 'weekly' ? row.weekly : row.monthly
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
                          {levels.signal && <span className={`badge ${levels.signal === 'Bullish' ? 'bg-success' : levels.signal === 'Bearish' ? 'bg-danger' : levels.signal === 'Above' ? 'text-success' : 'text-danger'}`} style={{ fontSize: '11px' }}>{levels.signal}</span>}
                        </td>
                        <td className="level-resistance fw-bold">{levels.prevHigh}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="d-md-none" style={{ paddingBottom: '20px' }}>
              {data.map((row, i) => {
                const levels = tf === 'weekly' ? row.weekly : row.monthly
                return (
                  <div key={i} className="card mb-2 shadow-sm" style={{ background: bg2, border: `1px solid ${border}` }}>
                    <div className="card-body py-2 px-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="fw-bold" style={{ fontSize: '15px', color: text }}>{row.symbol}</div>
                        <div className="text-end">
                          <span className="fw-bold" style={{ fontSize: '15px', color: text }}>₹{row.price}</span>
                          {row.pChange != null && <span style={{ fontSize: '11px', color: row.pChange >= 0 ? '#198754' : '#dc3545', marginLeft: 4 }}>({row.pChange > 0 ? '+' : ''}{row.pChange}%)</span>}
                        </div>
                      </div>
                      <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px', color: textMuted }}>
                        <span>PP %: <span className="fw-bold" style={{ color: row.price >= (tf === 'weekly' ? row.weekly : row.monthly).pp ? '#198754' : '#dc3545' }}>{((row.price - (tf === 'weekly' ? row.weekly : row.monthly).pp) / (tf === 'weekly' ? row.weekly : row.monthly).pp * 100).toFixed(2)}%</span></span>
                        <span>7 EMA: <span className="fw-bold" style={{ color: row.price >= levels.ema7 ? '#198754' : '#dc3545' }}>{levels.ema7 || '-'}</span>
                          {levels.signal && <span className={`ms-1 fw-bold`} style={{ color: levels.signal === 'Bullish' || levels.signal === 'Above' ? '#198754' : '#dc3545' }}>{levels.signal}</span>}
                        </span>
                      </div>
                      <div className="row g-1 text-center" style={{ fontSize: '12px' }}>
                        {[
                          { label: 'PL', val: levels.prevLow, type: 'support' },
                          { label: 'S3', val: levels.s3, type: 'support' },
                          { label: 'S2', val: levels.s2, type: 'support' },
                          { label: 'S1', val: levels.s1, type: 'support' },
                          { label: 'PP', val: levels.pp, type: 'pivot' },
                          { label: 'R1', val: levels.r1, type: 'resistance' },
                          { label: 'R2', val: levels.r2, type: 'resistance' },
                          { label: 'R3', val: levels.r3, type: 'resistance' },
                          { label: 'PH', val: levels.prevHigh, type: 'resistance' },
                        ].map((l, j) => (
                          <div key={j} className="col">
                            <div style={{ color: textMuted, fontSize: '10px' }}>{l.label}</div>
                            <div className={`fw-bold ${levelClass(l.type)}`} style={{ fontSize: '11px' }}>
                              {l.val}
                            </div>
                          </div>
                        ))}
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
