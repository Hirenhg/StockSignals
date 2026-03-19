import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable, SkeletonCards } from '../../components/Skeleton/Skeleton'
import { useTheme } from '../../context/ThemeContext'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const getPEColor = (pe) => {
  if (pe == null) return 'inherit'
  if (pe < 14) return '#2e7d32'
  if (pe < 18) return '#43a047'
  if (pe < 20) return '#7cb342'
  if (pe < 22) return '#9e9d24'
  if (pe < 24) return '#f9a825'
  if (pe < 26) return '#ef6c00'
  if (pe < 28) return '#e65100'
  if (pe < 30) return '#d32f2f'
  if (pe < 34) return '#c62828'
  return '#b71c1c'
}

const getPELabel = (pe) => {
  if (pe == null) return ''
  if (pe < 15) return 'Undervalued'
  if (pe < 20) return 'Fair'
  if (pe < 25) return 'Average'
  if (pe < 30) return 'Expensive'
  if (pe < 40) return 'Overvalued'
  return 'Very High'
}

const SectorPE = () => {
  const [tab, setTab] = useState('allpe')
  const [peData, setPeData] = useState([])
  const [sectorData, setSectorData] = useState([])
  const [loadingPE, setLoadingPE] = useState(true)
  const [loadingSector, setLoadingSector] = useState(true)
  const [sortConfig, setSortConfig] = useState({ key: 'pe', direction: 'asc' })
  const [statusFilter, setStatusFilter] = useState('all')
  const { darkMode } = useTheme()

  useEffect(() => {
    API.get('/api/nifty-pe').then(res => setPeData(res.data)).catch(() => {}).finally(() => setLoadingPE(false))
    API.get('/api/sector-pe').then(res => setSectorData(res.data)).catch(() => {}).finally(() => setLoadingSector(false))
  }, [])

  // Nifty 50 PE stats
  const allEntries = peData.flatMap(r => MONTHS.map(m => r[m] != null ? { year: r.year, month: m, pe: r[m] } : null).filter(Boolean))
  const allValues = allEntries.map(e => e.pe)
  const lastRow = peData[peData.length - 1]
  const lastMonths = lastRow ? MONTHS.filter(m => lastRow[m] != null) : []
  const currentPE = lastRow && lastMonths.length ? lastRow[lastMonths[lastMonths.length - 1]] : null
  const avgPE = allValues.length ? (allValues.reduce((a, b) => a + b, 0) / allValues.length).toFixed(2) : '-'
  const minEntry = allEntries.length ? allEntries.reduce((a, b) => a.pe < b.pe ? a : b) : null
  const maxEntry = allEntries.length ? allEntries.reduce((a, b) => a.pe > b.pe ? a : b) : null

  // PE range distribution
  const peRanges = [
    { label: '10-15', min: 10, max: 15, color: '#2e7d32' },
    { label: '16-20', min: 16, max: 20, color: '#43a047' },
    { label: '21-25', min: 21, max: 25, color: '#f9a825' },
    { label: '26-30', min: 26, max: 30, color: '#e65100' },
    { label: '31-35', min: 31, max: 35, color: '#d32f2f' },
    { label: '35-40', min: 35, max: 40, color: '#c62828' },
    { label: '40+', min: 40, max: 999, color: '#b71c1c' },
  ]
  const rangeCounts = peRanges.map(r => ({ ...r, count: allValues.filter(v => v >= r.min && v <= r.max).length }))

  // Sector PE
  const statuses = ['all', 'Undervalued', 'Fair', 'Average', 'Expensive', 'Overvalued', 'Very High']
  const filteredSectors = sectorData
    .filter(s => statusFilter === 'all' || getPELabel(s.pe) === statusFilter)
    .sort((a, b) => {
      if (sortConfig.key === 'status') {
        const aVal = getPELabel(a.pe), bVal = getPELabel(b.pe)
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortConfig.direction === 'asc' ? a[sortConfig.key] - b[sortConfig.key] : b[sortConfig.key] - a[sortConfig.key]
    })

  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))

  const bg2 = darkMode ? '#16213e' : '#f8f9fa'
  const border = darkMode ? '#2a2a4a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'
  const yearBg = darkMode ? '#16213e' : '#f1f3f5'
  const currentYearBg = darkMode ? '#1a3a6e' : '#e3f2fd'

  return (
    <>
      <Helmet><title>Sector PE Ratio - StockSignal</title></Helmet>
      <div className="p-1">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <h5 className="fw-bold mb-0">Sector PE Ratio {sectorData.length > 0 && <span style={{ fontSize: '10px', color: '#4caf50', fontWeight: 600, verticalAlign: 'middle' }}>● LIVE</span>}</h5>
          <div className="d-flex gap-1">
            <button className={`btn btn-sm ${tab === 'allpe' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('allpe')} style={{ fontSize: '13px', padding: '8px 16px' }}>All PE</button>
            <button className={`btn btn-sm ${tab === 'nifty50' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('nifty50')} style={{ fontSize: '13px', padding: '8px 16px' }}>Nifty 50 Ratio</button>
          </div>
        </div>

        {/* ===== TAB 1: Nifty 50 Ratio ===== */}
        {tab === 'nifty50' && (
          <>
            {loadingPE ? <><SkeletonCards count={2} /><SkeletonTable rows={10} cols={13} /></> : (
              <>
                {/* Stats + PE Range Badges - Single Row */}
                <div className="d-flex gap-2 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
                  <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
                    <div style={{ fontSize: '13px', color: textMuted }}>Current</div>
                    <div className="fw-bold" style={{ fontSize: '20px', color: currentPE ? getPEColor(currentPE) : text }}>{currentPE || '-'}</div>
                  </div>
                  <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
                    <div style={{ fontSize: '13px', color: textMuted }}>Average</div>
                    <div className="fw-bold" style={{ fontSize: '20px', color: textMuted }}>{avgPE}</div>
                  </div>
                  <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
                    <div style={{ fontSize: '13px', color: textMuted }}>Low</div>
                    <div className="fw-bold" style={{ fontSize: '20px', color: '#2e7d32' }}>{minEntry ? minEntry.pe : '-'}</div>
                  </div>
                  <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '75px' }}>
                    <div style={{ fontSize: '13px', color: textMuted }}>High</div>
                    <div className="fw-bold" style={{ fontSize: '20px', color: '#d32f2f' }}>{maxEntry ? maxEntry.pe : '-'}</div>
                  </div>
                  <div style={{ borderLeft: `2px solid ${border}`, margin: '4px 0' }} />
                  {rangeCounts.map(r => (
                    <div key={r.label} className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '65px' }}>
                      <div style={{ fontSize: '13px', color: textMuted }}>{r.label}</div>
                      <div className="fw-bold" style={{ fontSize: '20px', color: r.color }}>{r.count}</div>
                    </div>
                  ))}
                  <div className="flex-shrink-0 text-center rounded px-3 py-1" style={{ background: bg2, border: `1px solid ${border}`, minWidth: '65px' }}>
                    <div style={{ fontSize: '13px', color: textMuted }}>Total</div>
                    <div className="fw-bold" style={{ fontSize: '20px', color: text }}>{allValues.length}</div>
                  </div>
                </div>

                {/* Desktop Table */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover text-center" style={{ fontSize: '14px' }}>
                    <thead className="table-dark">
                      <tr style={{ verticalAlign: 'middle' }}>
                        <th style={{ position: 'sticky', left: 0, zIndex: 2 }}>Year</th>
                        {MONTHS.map(m => <th key={m}>{m}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[...peData].reverse().map(row => {
                        const isCurrentYear = row.year === lastRow?.year
                        return (
                          <tr key={row.year} style={{ verticalAlign: 'middle' }}>
                            <td className="fw-bold" style={{ position: 'sticky', left: 0, zIndex: 1, background: isCurrentYear ? currentYearBg : yearBg, color: isCurrentYear ? (darkMode ? '#64b5f6' : '#1565c0') : text }}>{row.year}</td>
                            {MONTHS.map(m => {
                              const v = row[m]
                              const isCurrent = isCurrentYear && lastMonths.length && m === lastMonths[lastMonths.length - 1]
                              return (
                                <td key={m} style={{ color: v != null ? getPEColor(v) : textMuted, fontWeight: v != null ? 600 : 400, background: isCurrent ? (darkMode ? '#1a3a6e' : '#e3f2fd') : 'transparent' }}>
                                  {v != null ? v : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="d-md-none" style={{ paddingBottom: '80px' }}>
                  {[...peData].reverse().map(row => {
                    const months = MONTHS.filter(m => row[m] != null)
                    const isCurrentYear = row.year === lastRow?.year
                    return (
                      <div key={row.year} className="mb-2 rounded" style={{ background: bg2, border: `1px solid ${isCurrentYear ? (darkMode ? '#64b5f6' : '#1565c0') : border}` }}>
                        <div className="px-3 py-2" style={{ borderBottom: `1px solid ${border}` }}>
                          <span className="fw-bold" style={{ color: isCurrentYear ? (darkMode ? '#64b5f6' : '#1565c0') : text }}>{row.year}</span>
                        </div>
                        <div className="px-2 py-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px' }}>
                          {months.map(m => {
                            const v = row[m]
                            const isCurrent = isCurrentYear && lastMonths.length && m === lastMonths[lastMonths.length - 1]
                            return (
                              <div key={m} className="text-center py-1 rounded" style={{ background: isCurrent ? (darkMode ? '#1a3a6e' : '#e3f2fd') : 'transparent' }}>
                                <div style={{ fontSize: '9px', color: textMuted }}>{m}</div>
                                <div className="fw-bold" style={{ fontSize: '13px', color: getPEColor(v) }}>{v}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ===== TAB 2: All PE ===== */}
        {tab === 'allpe' && (
          <>
            {loadingSector ? <><SkeletonCards count={4} /><SkeletonTable rows={10} cols={4} /></> : (
              <>
                {/* Status filter - Desktop */}
                <div className="d-none d-md-flex gap-1 mb-3 overflow-auto" style={{ scrollbarWidth: 'none' }}>
                  {statuses.map(s => (
                    <button key={s} className={`btn btn-sm flex-shrink-0 ${statusFilter === s ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setStatusFilter(s)} style={{ fontSize: '13px', padding: '8px 16px' }}>
                      {s === 'all' ? 'All Status' : s}
                    </button>
                  ))}
                </div>

                {/* Status filter - Mobile Bottom Bar */}
                <div className="d-md-none position-fixed bottom-0 start-0 end-0 bg-white border-top shadow-lg bottom-nav" style={{ zIndex: 1000 }}>
                  <div className="d-flex overflow-auto" style={{ scrollbarWidth: 'none' }}>
                    {statuses.map(s => (
                      <button key={s} className={`btn flex-shrink-0 rounded-0 border-0 py-3 ${statusFilter === s ? 'btn-primary' : 'btn-light'}`} onClick={() => setStatusFilter(s)} style={{ fontSize: '13px', fontWeight: '600', minWidth: 'fit-content', padding: '12px 16px' }}>
                        {s === 'all' ? 'All Status' : s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Desktop Table */}
                <div className="d-none d-md-block table-responsive">
                  <table className="table table-hover" style={{ fontSize: '14px' }}>
                    <thead className="table-dark">
                      <tr style={{ verticalAlign: 'middle' }}>
                        <th>Sector</th>
                        <th onClick={() => handleSort('pe')} style={{ cursor: 'pointer' }} className="text-center">
                          PE {sortConfig.key === 'pe' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSort('pb')} style={{ cursor: 'pointer' }} className="text-center">
                          PB {sortConfig.key === 'pb' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }} className="text-center">
                          Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th className="text-center">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSectors.map(s => (
                        <tr key={s.sector} style={{ verticalAlign: 'middle' }}>
                          <td className="fw-bold">{s.sector}</td>
                          <td className="text-center fw-bold" style={{ color: getPEColor(s.pe) }}>{s.pe}</td>
                          <td className="text-center" style={{ color: textMuted }}>{s.pb || '-'}</td>
                          <td className="text-center">
                            <span style={{ color: getPEColor(s.pe), fontWeight: 600 }}>{getPELabel(s.pe)}</span>
                          </td>
                          <td className="text-center" style={{ color: textMuted }}>{s.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="d-md-none" style={{ paddingBottom: '80px' }}>
                  {filteredSectors.map(s => (
                    <div key={s.sector} className="d-flex justify-content-between align-items-center rounded mb-2 px-3 py-2" style={{ background: bg2, border: `1px solid ${border}` }}>
                      <div>
                        <div className="fw-semibold" style={{ fontSize: '14px', color: text }}>{s.sector}</div>
                        <div style={{ fontSize: '13px', color: textMuted }}>{s.category} · <span style={{ color: getPEColor(s.pe) }}>{getPELabel(s.pe)}</span></div>
                      </div>
                      <div className="text-end">
                        <div className="fw-bold" style={{ fontSize: '20px', color: getPEColor(s.pe) }}>{s.pe}</div>
                        {s.pb && <div style={{ fontSize: '13px', color: textMuted }}>PB: {s.pb}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

export default SectorPE
