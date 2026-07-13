import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable } from '../../components/Skeleton/Skeleton'
import { useTheme } from '../../context/ThemeContext'

export default function Levels() {
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
    Promise.all([API.get('/api/recommendations'), API.get('/api/past-performance')])
      .then(([r, p]) => { setRecs(r.data || []); setPast(p.data || []) })
      .catch(() => {})
      .finally(() => setRecsLoading(false))
  }, [])

  return (
    <>
      <Helmet><title>Recommendations - TradingSignals</title></Helmet>
      <div className="p-1">

        {/* ===== BUY RECOMMENDATIONS ===== */}
        <h5 className="fw-bold mb-3" style={{ color: text }}>Buy Recommendations</h5>

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
