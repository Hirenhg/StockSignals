import React, { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable } from '../../components/Skeleton/Skeleton'
import { useTheme } from '../../context/ThemeContext'
import arrowDown from '../../images/arrow-down.svg'

function StatusBadge({ status }) {
  if (!status) return <span className="text-muted">-</span>
  const map = { Undervalued: 'success', 'Fairly Valued': 'warning', Overvalued: 'danger' }
  return <span className={`text-${map[status] || 'secondary'}`}>{status}</span>
}

export default function PEGRatio() {
  const [data, setData] = useState([])
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState('PEG')
  const [loading, setLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [filter, setFilter] = useState('All')
  const [editingEps, setEditingEps] = useState(null)
  const [epsInput, setEpsInput] = useState('')
  const [editingDiv, setEditingDiv] = useState(null)
  const [divInput, setDivInput] = useState('')
  const [editingPe, setEditingPe] = useState(null)
  const [peInput, setPeInput] = useState('')
  const { darkMode } = useTheme()

  const bg2 = darkMode ? '#262626' : '#f8f9fa'
  const border = darkMode ? '#3a3a3a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'

  useEffect(() => {
    API.get('/api/peg/categories').then(r => setCategories(r.data)).catch(() => {})
  }, [])

  const load = (cat) => {
    setLoading(true)
    API.get(`/api/peg/live?category=${cat || category}`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh prices every 30s during market hours
  useEffect(() => {
    if (loading || !data.length) return
    const isMarketOpen = () => {
      const now = new Date()
      const h = now.getHours(), m = now.getMinutes()
      const day = now.getDay()
      if (day === 0 || day === 6) return false
      return (h * 60 + m) >= 555 && (h * 60 + m) <= 930
    }
    if (!isMarketOpen()) return
    const interval = setInterval(() => {
      if (!isMarketOpen()) return
      API.get(`/api/peg/prices?category=${category}`)
        .then(r => {
          const priceMap = r.data
          setData(prev => prev.map(row => {
            const p = priceMap[row.name]
            if (!p || !p.price) return row
            return { ...row, price: p.price, pChange: p.pChange, prevClose: p.prevClose }
          }))
        })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [loading, data.length, category])

  const switchCategory = (c) => { setCategory(c); load(c) }

  const recalcPEG = (d, epsG, dy, peOverride) => {
    const pe = peOverride ?? d.pe
    const peg = pe && epsG ? parseFloat((pe / (epsG + (dy || 0))).toFixed(2)) : null
    const pegStatus = peg !== null ? (peg < 1 ? 'Undervalued' : peg <= 2 ? 'Fairly Valued' : 'Overvalued') : null
    return { peg, pegStatus }
  }

  const saveEps = (name) => {
    const val = parseFloat(epsInput)
    if (isNaN(val)) { setEditingEps(null); return }
    API.put(`/api/peg/${encodeURIComponent(name)}`, { epsGrowth: val })
      .then(() => {
        setData(prev => prev.map(d => {
          if (d.name !== name) return d
          const { peg, pegStatus } = recalcPEG(d, val, d.dividendYield)
          return { ...d, epsGrowth: val, peg, pegStatus }
        }))
        setEditingEps(null)
      })
      .catch(() => {})
  }

  const saveDiv = (name) => {
    const val = parseFloat(divInput)
    if (isNaN(val)) { setEditingDiv(null); return }
    API.put(`/api/peg/${encodeURIComponent(name)}`, { manualDivYield: val })
      .then(() => {
        setData(prev => prev.map(d => {
          if (d.name !== name) return d
          const { peg, pegStatus } = recalcPEG(d, d.epsGrowth, val)
          return { ...d, dividendYield: val, peg, pegStatus }
        }))
        setEditingDiv(null)
      })
      .catch(() => {})
  }

  const savePe = (name) => {
    const val = parseFloat(peInput)
    if (isNaN(val)) { setEditingPe(null); return }
    API.put(`/api/peg/${encodeURIComponent(name)}`, { manualPE: val })
      .then(() => {
        setData(prev => prev.map(d => {
          if (d.name !== name) return d
          const { peg, pegStatus } = recalcPEG(d, d.epsGrowth, d.dividendYield, val)
          return { ...d, pe: val, peg, pegStatus }
        }))
        setEditingPe(null)
      })
      .catch(() => {})
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0
    if (sortConfig.key === 'name') return sortConfig.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    if (sortConfig.key === 'pegStatus') {
      const order = { Undervalued: 1, 'Fairly Valued': 2, Overvalued: 3 }
      const av = order[a.pegStatus] || 4, bv = order[b.pegStatus] || 4
      return sortConfig.direction === 'asc' ? av - bv : bv - av
    }
    if (sortConfig.key === 'fairPrice') {
      const av = a.peg && a.peg > 0 ? a.price / a.peg : 999999
      const bv = b.peg && b.peg > 0 ? b.price / b.peg : 999999
      return sortConfig.direction === 'asc' ? av - bv : bv - av
    }
    const av = a[sortConfig.key] ?? 999, bv = b[sortConfig.key] ?? 999
    return sortConfig.direction === 'asc' ? av - bv : bv - av
  })

  const arrow = (key) => sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''

  const filtered = filter === 'All' ? sorted : sorted.filter(r => r.pegStatus === filter)

  const stats = data.reduce((acc, r) => {
    if (r.pegStatus === 'Undervalued') acc.under++
    else if (r.pegStatus === 'Fairly Valued') acc.fair++
    else if (r.pegStatus === 'Overvalued') acc.over++
    return acc
  }, { under: 0, fair: 0, over: 0 })

  const renderEditableCell = (row, field, editing, setEditing, input, setInput, saveFn) => {
    if (editing === row.name) {
      return (
        <input type="number" step="0.1" className="form-control form-control-sm" style={{ width: '80px', fontSize: '13px' }}
          value={input} onChange={e => setInput(e.target.value)} autoFocus
          onBlur={() => saveFn(row.name)} onKeyDown={e => { if (e.key === 'Enter') saveFn(row.name); if (e.key === 'Escape') setEditing(null) }} />
      )
    }
    const val = row[field]
    return (
      <span style={{ cursor: 'pointer' }} onClick={() => { setEditing(row.name); setInput(val ?? '') }}>
        {val != null ? <span style={{ color: val > 0 ? '#198754' : '#dc3545', fontWeight: 'bold' }}>{val}%</span> : <span className="text-muted">click to set</span>}
      </span>
    )
  }

  const renderPeCell = (row) => {
    if (editingPe === row.name) {
      return (
        <input type="number" step="0.1" className="form-control form-control-sm" style={{ width: '80px', fontSize: '13px' }}
          value={peInput} onChange={e => setPeInput(e.target.value)} autoFocus
          onBlur={() => savePe(row.name)} onKeyDown={e => { if (e.key === 'Enter') savePe(row.name); if (e.key === 'Escape') setEditingPe(null) }} />
      )
    }
    return (
      <span style={{ cursor: 'pointer' }} onClick={() => { setEditingPe(row.name); setPeInput(row.pe ?? '') }}>
        {row.pe != null ? <span className="fw-bold">{row.pe}</span> : <span className="text-muted">click to set</span>}
      </span>
    )
  }
  const renderEpsCell = (row) => renderEditableCell(row, 'epsGrowth', editingEps, setEditingEps, epsInput, setEpsInput, saveEps)
  const renderDivCell = (row) => renderEditableCell(row, 'dividendYield', editingDiv, setEditingDiv, divInput, setDivInput, saveDiv)

  return (
    <>
      <Helmet><title>Peter Lynch PEG - StockSignal</title></Helmet>
      <div className="p-1">
        <h5 className="fw-bold mb-0" style={{ color: text }}>Peter Lynch PEG {data.length > 0 && <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: 600, verticalAlign: 'middle' }}>● LIVE</span>}</h5>
        <div className="mb-3" style={{ fontSize: '12px', color: textMuted }}>PEG = PE ÷ (EPS Growth + Div Yield) · Click EPS Growth / Div Yield to edit</div>

        <div className="d-flex gap-2 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>Total</div>
            <div className="fw-bold" style={{ fontSize: '20px', color: text }}>{data.length}</div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>Undervalued</div>
            <div className="fw-bold" style={{ fontSize: '20px', color: '#198754' }}>{stats.under}</div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>Fair Value</div>
            <div className="fw-bold" style={{ fontSize: '20px', color: '#f9a825' }}>{stats.fair}</div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>Overvalued</div>
            <div className="fw-bold" style={{ fontSize: '20px', color: '#dc3545' }}>{stats.over}</div>
          </div>
          <div style={{ borderLeft: `2px solid ${border}`, margin: '4px 0' }} />
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '85px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>PEG &lt; 1</div>
            <div className="fw-bold" style={{ fontSize: '14px', color: '#198754' }}>Buy Signal</div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '85px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>PEG 1–2</div>
            <div className="fw-bold" style={{ fontSize: '14px', color: '#f9a825' }}>Hold</div>
          </div>
          <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '85px' }}>
            <div style={{ fontSize: '12px', color: textMuted }}>PEG &gt; 2</div>
            <div className="fw-bold" style={{ fontSize: '14px', color: '#dc3545' }}>Avoid</div>
          </div>
        </div>

        {/* Category Tabs + Filter - Desktop */}
        <div className="d-none d-md-flex gap-1 mb-3 align-items-center overflow-auto" style={{ scrollbarWidth: 'none' }}>
          {categories.map(c => (
            <button key={c} className={`btn btn-sm flex-shrink-0 ${category === c ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => switchCategory(c)} style={{ fontSize: '13px', padding: '8px 16px' }}>
              {c}
            </button>
          ))}
          <div style={{ borderLeft: `2px solid ${border}`, height: '32px', margin: '0 4px' }} />
          <select className="form-select flex-shrink-0" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 'auto', fontSize: '14px', ...(darkMode ? { backgroundPosition: '90% center', backgroundImage: `url(${arrowDown})` } : {}) }}>
            <option value="All">All</option>
            <option value="Undervalued">Undervalued</option>
            <option value="Fairly Valued">Fairly Valued</option>
            <option value="Overvalued">Overvalued</option>
          </select>
        </div>

        {/* Filter - Mobile */}
        <div className="d-md-none mb-3">
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)} style={{ fontSize: '13px', ...(darkMode ? { backgroundColor: '#262626', color: '#e0e0e0', borderColor: '#3a3a3a', backgroundImage: `url(${arrowDown})` } : {}) }}>
            <option value="All">All</option>
            <option value="Undervalued">Undervalued</option>
            <option value="Fairly Valued">Fairly Valued</option>
            <option value="Overvalued">Overvalued</option>
          </select>
        </div>

        {/* Category - Mobile Bottom Bar */}
        <div className="d-md-none position-fixed bottom-0 start-0 end-0 border-top shadow-lg bottom-nav" style={{ zIndex: 1000, background: darkMode ? '#1a1a2e' : '#fff' }}>
          <div className="d-flex justify-content-between">
            {categories.map(c => (
              <button key={c} className={`btn flex-grow-1 rounded-0 border-0 py-3 ${category === c ? 'btn-primary' : darkMode ? 'btn-dark' : 'btn-light'}`} onClick={() => switchCategory(c)} style={{ fontSize: '11px', fontWeight: '600', padding: '12px 4px' }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? <SkeletonTable rows={10} cols={8} /> : (
          <>
            {/* Desktop Table */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover" style={{ fontSize: '14px' }}>
                <thead className="table-dark">
                  <tr style={{ verticalAlign: 'middle' }}>
                    <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Name{arrow('name')}</th>
                    <th onClick={() => handleSort('price')} style={{ cursor: 'pointer' }}>Price{arrow('price')}</th>
                    <th onClick={() => handleSort('epsGrowth')} style={{ cursor: 'pointer' }}>EPS Growth{arrow('epsGrowth')}</th>
                    <th onClick={() => handleSort('pe')} style={{ cursor: 'pointer' }}>PE{arrow('pe')}</th>
                    <th onClick={() => handleSort('dividendYield')} style={{ cursor: 'pointer' }}>Div Yield{arrow('dividendYield')}</th>
                    <th onClick={() => handleSort('peg')} style={{ cursor: 'pointer' }}>Result{arrow('peg')}</th>
                    <th onClick={() => handleSort('fairPrice')} style={{ cursor: 'pointer' }}>Fair Price{arrow('fairPrice')}</th>
                    <th onClick={() => handleSort('pegStatus')} style={{ cursor: 'pointer' }}>Status{arrow('pegStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => {
                    const fairPrice = row.peg && row.peg > 0 ? Math.round(row.price / row.peg) : null
                    return (
                    <tr key={i} style={{ verticalAlign: 'middle' }}>
                      <td className="fw-bold">{row.name}</td>
                      <td>₹{row.price || '-'}</td>
                      <td>{renderEpsCell(row)}</td>
                      <td>{renderPeCell(row)}</td>
                      <td>{renderDivCell(row)}</td>
                      <td className="fw-bold">{row.peg ?? '-'}</td>
                      <td className="fw-bold" style={{ color: row.pegStatus === 'Undervalued' ? '#198754' : row.pegStatus === 'Fairly Valued' ? '#ffc107' : row.pegStatus === 'Overvalued' ? '#dc3545' : undefined }}>{fairPrice ? `₹${fairPrice}` : '-'}</td>
                      <td><StatusBadge status={row.pegStatus} /></td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="d-md-none" style={{ paddingBottom: '80px' }}>
              {filtered.map((row, i) => {
                const fairPrice = row.peg && row.peg > 0 ? Math.round(row.price / row.peg) : null
                const statusColor = row.pegStatus === 'Undervalued' ? '#198754' : row.pegStatus === 'Fairly Valued' ? '#ffc107' : row.pegStatus === 'Overvalued' ? '#dc3545' : textMuted
                return (
                <div key={i} className="card mb-2 shadow-sm" style={{ background: bg2, border: `1px solid ${border}` }}>
                  <div className="card-body py-2 px-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="fw-bold" style={{ fontSize: '15px', color: text }}>{row.name}</div>
                      <span className="fw-bold" style={{ fontSize: '14px', color: statusColor }}>{row.pegStatus || '-'}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <div style={{ fontSize: '12px', color: textMuted }}>Price</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: text }}>₹{row.price || '-'}</div>
                      </div>
                      <div className="text-end">
                        <div style={{ fontSize: '12px', color: textMuted }}>Fair Price</div>
                        <div className="fw-bold" style={{ fontSize: '18px', color: statusColor }}>{fairPrice ? `₹${fairPrice}` : '-'}</div>
                      </div>
                    </div>
                    <div className="row g-2">
                      <div className="col-3 text-center">
                        <div style={{ fontSize: '11px', color: textMuted }}>PE</div>
                        <div style={{ fontSize: '14px' }}>{renderPeCell(row)}</div>
                      </div>
                      <div className="col-3 text-center">
                        <div style={{ fontSize: '11px', color: textMuted }}>EPS Gr.</div>
                        <div style={{ fontSize: '14px' }}>{renderEpsCell(row)}</div>
                      </div>
                      <div className="col-3 text-center">
                        <div style={{ fontSize: '11px', color: textMuted }}>Div Yield</div>
                        <div style={{ fontSize: '14px' }}>{renderDivCell(row)}</div>
                      </div>
                      <div className="col-3 text-center">
                        <div style={{ fontSize: '11px', color: textMuted }}>PEG</div>
                        <div className="fw-bold" style={{ fontSize: '15px', color: statusColor }}>{row.peg ?? '-'}</div>
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
