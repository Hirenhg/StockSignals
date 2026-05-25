import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTheme } from '../../context/ThemeContext'

const INVESTMENT = 25000

const INITIAL_STOCKS = [
  { name: 'TRANSRAILL',          buyPrice: 503,  t1: 770,  t2: 990,  t3: 1232, sl: 470,  closingPrice: 508,  monthLow: 488,  monthHigh: 608,  resultDate: '' },
  { name: 'CLEAN SCIENCE',       buyPrice: 758,  t1: 890,  t2: 920,  t3: 950,  sl: 728,  closingPrice: 754,  monthLow: 732,  monthHigh: 899,  resultDate: '26-05-2026' },
  { name: 'SURYODAY',            buyPrice: 153,  t1: 170,  t2: 180,  t3: 190,  sl: 140,  closingPrice: 161,  monthLow: 151,  monthHigh: 190,  resultDate: '' },
  { name: 'NORTHERN ARC',        buyPrice: 279,  t1: 300,  t2: 315,  t3: 330,  sl: 269,  closingPrice: 281,  monthLow: 257,  monthHigh: 321,  resultDate: '' },
  { name: 'SYRMA',               buyPrice: 980,  t1: 1050, t2: 1100, t3: 1150, sl: 945,  closingPrice: 1040, monthLow: 958,  monthHigh: 1148, resultDate: '' },
  { name: 'AEROFLEX',            buyPrice: 363,  t1: 400,  t2: 420,  t3: 440,  sl: 344,  closingPrice: 404,  monthLow: 294,  monthHigh: 458,  resultDate: '' },
  { name: 'WOCKPHARMA',          buyPrice: 1550, t1: 1650, t2: 1750, t3: 1780, sl: 1500, closingPrice: 1575, monthLow: 1400, monthHigh: 1778, resultDate: '' },
  { name: 'JBM AUTO',            buyPrice: 620,  t1: 660,  t2: 690,  t3: 720,  sl: 600,  closingPrice: 632,  monthLow: 608,  monthHigh: 711,  resultDate: '' },
  { name: 'SHRIPISTON',          buyPrice: 3257, t1: 3680, t2: 3780, t3: 3880, sl: 3175, closingPrice: 3273, monthLow: 3228, monthHigh: 3677, resultDate: '' },
  { name: 'ANANTRAJ',            buyPrice: 520,  t1: 580,  t2: 600,  t3: 640,  sl: 500,  closingPrice: 504,  monthLow: 464,  monthHigh: 564,  resultDate: '' },
  { name: 'NUVAMA',              buyPrice: 1457, t1: 1530, t2: 1590, t3: 1650, sl: 1420, closingPrice: 1480, monthLow: 1316, monthHigh: 1648, resultDate: '' },
  { name: 'ZYDUSWELL',           buyPrice: 484,  t1: 530,  t2: 545,  t3: 556,  sl: 455,  closingPrice: 490,  monthLow: 484,  monthHigh: 542,  resultDate: '' },
  { name: 'SERVOTECH',           buyPrice: 90,   t1: 100,  t2: 110,  t3: 120,  sl: 80,   closingPrice: 93,   monthLow: 85,   monthHigh: 102,  resultDate: '' },
  { name: 'KMEW',                buyPrice: 1980, t1: 2150, t2: 2230, t3: 2290, sl: 1900, closingPrice: 2089, monthLow: 1803, monthHigh: 2285, resultDate: '' },
  { name: 'GREAVES COTTON',      buyPrice: 158,  t1: 180,  t2: 190,  t3: 200,  sl: 140,  closingPrice: 163,  monthLow: 158,  monthHigh: 178,  resultDate: '' },
  { name: 'GAEL',                buyPrice: 163,  t1: 172,  t2: 180,  t3: 185,  sl: 157,  closingPrice: 164,  monthLow: 154,  monthHigh: 177,  resultDate: '' },
  { name: 'SASKEN',              buyPrice: 1750, t1: 1950, t2: 2050, t3: 2100, sl: 1650, closingPrice: 1823, monthLow: 1320, monthHigh: 1969, resultDate: '' },
  { name: 'KRISHANA PHOSCHEM',   buyPrice: 672,  t1: 740,  t2: 770,  t3: 800,  sl: 650,  closingPrice: 667,  monthLow: 585,  monthHigh: 712,  resultDate: '' },
  { name: 'NUVOCO',              buyPrice: 320,  t1: 340,  t2: 360,  t3: 380,  sl: 310,  closingPrice: 320,  monthLow: 289,  monthHigh: 340,  resultDate: '' },
  { name: 'MARKSANS PHARMA',     buyPrice: 200,  t1: 220,  t2: 240,  t3: 280,  sl: 190,  closingPrice: 212,  monthLow: 185,  monthHigh: 225,  resultDate: '26-05-2026' },
  { name: 'EMIL',                buyPrice: 115,  t1: 130,  t2: 140,  t3: 150,  sl: 108,  closingPrice: 120,  monthLow: 110,  monthHigh: 127,  resultDate: '' },
  { name: 'RRKABEL',             buyPrice: 1945, t1: 2050, t2: 2100, t3: 2150, sl: 1870, closingPrice: 1945, monthLow: 1603, monthHigh: 2049, resultDate: '' },
  { name: 'ADANIENSOL',          buyPrice: 1312, t1: 1460, t2: 1600, t3: 1800, sl: 1240, closingPrice: 1368, monthLow: 1237, monthHigh: 1438, resultDate: '' },
  { name: 'ONESOURCE SPECIALT',  buyPrice: 1799, t1: 2000, t2: 2200, t3: 2200, sl: 1720, closingPrice: 1834, monthLow: 1705, monthHigh: 1918, resultDate: '' },
  { name: 'WELSPUN LIVING LIMIT', buyPrice: 136, t1: 160,  t2: 180,  t3: 210,  sl: 125,  closingPrice: 139,  monthLow: 128,  monthHigh: 145,  resultDate: '' },
  { name: 'SAIL',                buyPrice: 195,  t1: 210,  t2: 215,  t3: 220,  sl: 187,  closingPrice: 201,  monthLow: 176,  monthHigh: 209,  resultDate: '' },
  { name: 'ARVIND',              buyPrice: 470,  t1: 520,  t2: 560,  t3: 600,  sl: 445,  closingPrice: 481,  monthLow: 387,  monthHigh: 499,  resultDate: '' },
  { name: 'NIACL',               buyPrice: 162,  t1: 178,  t2: 190,  t3: 195,  sl: 154,  closingPrice: 165,  monthLow: 154,  monthHigh: 170,  resultDate: '' },
  { name: 'CYIENT',              buyPrice: 883,  t1: 930,  t2: 960,  t3: 990,  sl: 860,  closingPrice: 903,  monthLow: 857,  monthHigh: 927,  resultDate: '' },
  { name: 'SPARC',               buyPrice: 195,  t1: 225,  t2: 240,  t3: 255,  sl: 180,  closingPrice: 210,  monthLow: 139,  monthHigh: 214,  resultDate: '' },
  { name: 'BAJAJCON',            buyPrice: 555,  t1: 620,  t2: 680,  t3: 740,  sl: 520,  closingPrice: 571,  monthLow: 453,  monthHigh: 578,  resultDate: '' },
  { name: 'PARKMEDIWORLD',       buyPrice: 246,  t1: 265,  t2: 275,  t3: 280,  sl: 237,  closingPrice: 279,  monthLow: 233,  monthHigh: 281,  resultDate: '' },
  { name: 'DEEPAKFERT',          buyPrice: 1270, t1: 1400, t2: 1450, t3: 1500, sl: 1240, closingPrice: 1474, monthLow: 1211, monthHigh: 1464, resultDate: '26-05-2026' },
  { name: 'SPORTKING',           buyPrice: 155,  t1: 175,  t2: 190,  t3: 205,  sl: 145,  closingPrice: 164,  monthLow: 137,  monthHigh: 165,  resultDate: '' },
]

function calcRow(s) {
  const qty = s.buyPrice ? Math.floor(INVESTMENT / s.buyPrice) : 0
  const invested = qty * s.buyPrice
  const profitT1 = qty * (s.t1 - s.buyPrice)
  const profitT2 = qty * (s.t2 - s.buyPrice)
  const profitT3 = qty * (s.t3 - s.buyPrice)
  const loss = qty * (s.sl - s.buyPrice)
  const currentPnl = qty * (s.closingPrice - s.buyPrice)
  const currentProfit = currentPnl > 0 ? currentPnl : 0
  const currentLoss = currentPnl < 0 ? currentPnl : 0
  const monthLowPct = s.monthLow ? (((s.closingPrice - s.monthLow) / s.monthLow) * 100).toFixed(2) : '-'
  const monthHighPct = s.closingPrice ? (((s.monthHigh - s.closingPrice) / s.closingPrice) * 100).toFixed(2) : '-'
  return { ...s, qty, invested, profitT1, profitT2, profitT3, loss, currentPnl, currentProfit, currentLoss, monthLowPct, monthHighPct }
}

const fmt = (n) => n != null ? Math.round(n).toLocaleString('en-IN') : '-'
const clr = (n) => n >= 0 ? '#198754' : '#dc3545'

const EDIT_FIELDS = ['buyPrice', 't1', 't2', 't3', 'sl', 'closingPrice', 'monthLow', 'monthHigh', 'resultDate']
const EDIT_LABELS = { buyPrice: 'Buy Price', t1: 'Target 1', t2: 'Target 2', t3: 'Target 3', sl: 'SL', closingPrice: 'Today Close', monthLow: '1M Low', monthHigh: '1M High', resultDate: 'Result Date' }

export default function SwingTrade() {
  const { darkMode } = useTheme()
  const [stocks, setStocks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('swingStocks') || 'null')
      return saved || INITIAL_STOCKS
    } catch { return INITIAL_STOCKS }
  })
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' })
  const [form, setForm] = useState(null)
  const [editIdx, setEditIdx] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const EMPTY = { name: '', buyPrice: '', t1: '', t2: '', t3: '', sl: '', closingPrice: '', monthLow: '', monthHigh: '', resultDate: '' }

  const bg2 = darkMode ? '#16213e' : '#f8f9fa'
  const border = darkMode ? '#2a2a4a' : '#e9ecef'
  const text = darkMode ? '#e0e0e0' : '#212529'
  const textMuted = darkMode ? '#8a8a9a' : '#6c757d'
  const inputBg = darkMode ? '#0f0f1a' : '#fff'

  const save = (updated) => {
    setStocks(updated)
    localStorage.setItem('swingStocks', JSON.stringify(updated))
  }

  const rows = stocks.map(calcRow)

  const sorted = [...rows].sort((a, b) => {
    if (!sortConfig.key) return 0
    const av = a[sortConfig.key], bv = b[sortConfig.key]
    if (typeof av === 'string') return sortConfig.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    return sortConfig.dir === 'asc' ? av - bv : bv - av
  })

  const toggleSort = (key) => setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))
  const arrow = (key) => sortConfig.key === key ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : ''

  const openEdit = (i) => { setForm({ ...stocks[i] }); setEditIdx(i); setShowAdd(false) }
  const openAdd = () => { setForm({ ...EMPTY }); setEditIdx(null); setShowAdd(true) }
  const closeForm = () => { setForm(null); setEditIdx(null); setShowAdd(false) }

  const saveForm = () => {
    const s = { ...form, buyPrice: +form.buyPrice, t1: +form.t1, t2: +form.t2, t3: +form.t3, sl: +form.sl, closingPrice: +form.closingPrice, monthLow: +form.monthLow, monthHigh: +form.monthHigh }
    if (editIdx !== null) save(stocks.map((r, i) => i === editIdx ? s : r))
    else save([...stocks, s])
    closeForm()
  }

  const deleteRow = (i) => save(stocks.filter((_, idx) => idx !== i))

  const th = { cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '14px', padding: '6px 8px' }
  const td = { whiteSpace: 'nowrap', fontSize: '14px', padding: '5px 8px', verticalAlign: 'middle' }

  const totalInvested = sorted.reduce((s, r) => s + r.invested, 0)
  const totalPT1 = sorted.reduce((s, r) => s + r.profitT1, 0)
  const totalPT2 = sorted.reduce((s, r) => s + r.profitT2, 0)
  const totalPT3 = sorted.reduce((s, r) => s + r.profitT3, 0)
  const totalLoss = sorted.reduce((s, r) => s + r.loss, 0)
  const totalProfit = sorted.reduce((s, r) => s + r.currentProfit, 0)
  const totalCurLoss = sorted.reduce((s, r) => s + r.currentLoss, 0)

  return (
    <>
      <Helmet><title>Swing Trade Watchlist - TradingSignals</title></Helmet>
      <div className="p-2">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div>
            <h5 className="fw-bold mb-0" style={{ color: text }}>Swing Trade Watchlist</h5>
            <div style={{ fontSize: '14px', color: textMuted }}>Investment per stock: ₹{INVESTMENT.toLocaleString('en-IN')}</div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={openAdd}>+ Add</button>
        </div>

        {form && (
          <div className="card mb-3 p-3" style={{ background: bg2, border: `1px solid ${border}` }}>
            <div className="fw-bold mb-2" style={{ color: text, fontSize: '14px' }}>{showAdd ? 'Add Stock' : form.name}</div>
            <div className="row g-2">
              {(showAdd ? ['name', ...EDIT_FIELDS] : EDIT_FIELDS).map(k => (
                <div className="col-6 col-md-3 col-lg-2" key={k}>
                  <label style={{ fontSize: '11px', color: textMuted }}>{k === 'name' ? 'Name' : EDIT_LABELS[k]}</label>
                  <input
                    className="form-control form-control-sm"
                    type={k === 'resultDate' ? 'date' : k === 'name' ? 'text' : 'number'}
                    value={form[k]}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={{ background: inputBg, color: text, border: `1px solid ${border}` }}
                  />
                </div>
              ))}
            </div>
            <div className="d-flex gap-2 mt-2">
              <button className="btn btn-sm btn-success" onClick={saveForm}>Save</button>
              <button className="btn btn-sm btn-secondary" onClick={closeForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* Desktop Table */}
        <div className="d-none d-md-block table-responsive">
          <table className="table table-hover mb-0" style={{ minWidth: '1900px' }}>
            <thead className="table-dark">
              <tr>
                <th style={th} onClick={() => toggleSort('name')}>Name{arrow('name')}</th>
                <th style={th} onClick={() => toggleSort('buyPrice')}>Buy Price{arrow('buyPrice')}</th>
                <th style={th} onClick={() => toggleSort('t1')}>Target 1{arrow('t1')}</th>
                <th style={th} onClick={() => toggleSort('t2')}>Target 2{arrow('t2')}</th>
                <th style={th} onClick={() => toggleSort('t3')}>Target 3{arrow('t3')}</th>
                <th style={th} onClick={() => toggleSort('sl')}>SL{arrow('sl')}</th>
                <th style={th} onClick={() => toggleSort('closingPrice')}>Today Close{arrow('closingPrice')}</th>
                <th style={th} onClick={() => toggleSort('monthLow')}>1M Low{arrow('monthLow')}</th>
                <th style={th} onClick={() => toggleSort('monthHigh')}>1M High{arrow('monthHigh')}</th>
                <th style={th}>Investment</th>
                <th style={th} onClick={() => toggleSort('profitT1')}>Profit T1{arrow('profitT1')}</th>
                <th style={th} onClick={() => toggleSort('profitT2')}>Profit T2{arrow('profitT2')}</th>
                <th style={th} onClick={() => toggleSort('profitT3')}>Profit T3{arrow('profitT3')}</th>
                <th style={th} onClick={() => toggleSort('loss')}>Loss{arrow('loss')}</th>
                <th style={{ ...th, color: '#198754' }} onClick={() => toggleSort('currentProfit')}>Current Profit{arrow('currentProfit')}</th>
                <th style={{ ...th, color: '#dc3545' }} onClick={() => toggleSort('currentLoss')}>Current Loss{arrow('currentLoss')}</th>
                <th style={th} onClick={() => toggleSort('monthLowPct')}>1M Low %{arrow('monthLowPct')}</th>
                <th style={th} onClick={() => toggleSort('monthHighPct')}>1M High %{arrow('monthHighPct')}</th>
                <th style={th} onClick={() => toggleSort('resultDate')}>Result Date{arrow('resultDate')}</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const origIdx = stocks.findIndex(s => s.name === row.name)
                return (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 600 }}>{row.name}</td>
                    <td style={td}>₹{row.buyPrice}</td>
                    <td style={{ ...td, color: '#198754' }}>₹{row.t1}</td>
                    <td style={{ ...td, color: '#198754' }}>₹{row.t2}</td>
                    <td style={{ ...td, color: '#198754' }}>₹{row.t3}</td>
                    <td style={{ ...td, color: '#dc3545' }}>₹{row.sl}</td>
                    <td style={td}>₹{row.closingPrice}</td>
                    <td style={{ ...td, color: '#198754' }}>₹{row.monthLow}</td>
                    <td style={{ ...td, color: '#dc3545' }}>₹{row.monthHigh}</td>
                    <td style={td}>₹{fmt(row.invested)}</td>
                    <td style={{ ...td, color: '#198754' }}>₹{fmt(row.profitT1)}</td>
                    <td style={{ ...td, color: '#198754' }}>₹{fmt(row.profitT2)}</td>
                    <td style={{ ...td, color: '#198754' }}>₹{fmt(row.profitT3)}</td>
                    <td style={{ ...td, color: '#dc3545' }}>₹{fmt(row.loss)}</td>
                    <td style={{ ...td, color: '#198754', fontWeight: 600 }}>{row.currentProfit > 0 ? `₹${fmt(row.currentProfit)}` : '-'}</td>
                    <td style={{ ...td, color: '#dc3545', fontWeight: 600 }}>{row.currentLoss < 0 ? `₹${fmt(row.currentLoss)}` : '-'}</td>
                    <td style={{ ...td, color: '#dc3545' }}>{row.monthLowPct !== '-' ? `+${row.monthLowPct}%` : '-'}</td>
                    <td style={{ ...td, color: '#198754' }}>{row.monthHighPct !== '-' ? `${row.monthHighPct}%` : '-'}</td>
                    <td style={td}>{row.resultDate || '-'}</td>
                    <td style={td}>
                      <button className="btn btn-outline-primary btn-sm me-1" style={{ fontSize: '11px', padding: '1px 7px' }} onClick={() => openEdit(origIdx)}>Edit</button>
                      <button className="btn btn-outline-danger btn-sm" style={{ fontSize: '11px', padding: '1px 7px' }} onClick={() => deleteRow(origIdx)}>Del</button>
                    </td>
                  </tr>
                )
              })}
              <tr className="fw-bold" style={{ background: darkMode ? '#1a1a3e' : '#e9ecef' }}>
                <td style={td} colSpan={9}>TOTAL</td>
                <td style={td}>₹{fmt(totalInvested)}</td>
                <td style={{ ...td, color: '#198754' }}>₹{fmt(totalPT1)}</td>
                <td style={{ ...td, color: '#198754' }}>₹{fmt(totalPT2)}</td>
                <td style={{ ...td, color: '#198754' }}>₹{fmt(totalPT3)}</td>
                <td style={{ ...td, color: '#dc3545' }}>₹{fmt(totalLoss)}</td>
                <td style={{ ...td, color: '#198754' }}>₹{fmt(totalProfit)}</td>
                <td style={{ ...td, color: '#dc3545' }}>₹{fmt(totalCurLoss)}</td>
                <td style={td} colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="d-md-none" style={{ paddingBottom: '80px' }}>
          {sorted.map((row, i) => {
            const origIdx = stocks.findIndex(s => s.name === row.name)
            const pnlColor = clr(row.currentPnl)
            return (
              <div key={i} className="mb-2 rounded" style={{ background: bg2, border: `1px solid ${border}`, overflow: 'hidden' }}>
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center px-3 py-2" style={{ background: darkMode ? '#1e2a4a' : '#343a40' }}>
                  <span className="fw-bold text-white" style={{ fontSize: '14px', letterSpacing: '0.5px' }}>{row.name}</span>
                  <div className="d-flex align-items-center gap-2">
                    {row.resultDate && <span className="badge bg-warning text-dark" style={{ fontSize: '14px' }}>{row.resultDate}</span>}
                    <span className="fw-bold" style={{ color: pnlColor, fontSize: '14px' }}>
                      {row.currentPnl >= 0 ? '+' : ''}₹{fmt(row.currentPnl)}
                    </span>
                  </div>
                </div>

                <div className="px-3 py-2">
                  {/* Row 1: Buy | Close | SL */}
                  <div className="d-flex justify-content-between mb-2">
                    <div className="text-center" style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>Buy</div>
                      <div className="fw-bold" style={{ fontSize: '14px', color: text }}>₹{row.buyPrice}</div>
                    </div>
                    <div className="text-center" style={{ flex: 1, borderLeft: `1px solid ${border}`, borderRight: `1px solid ${border}` }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>Today Close</div>
                      <div className="fw-bold" style={{ fontSize: '14px', color: text }}>₹{row.closingPrice}</div>
                    </div>
                    <div className="text-center" style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>SL</div>
                      <div className="fw-bold" style={{ fontSize: '14px', color: '#dc3545' }}>₹{row.sl}</div>
                    </div>
                  </div>

                  {/* Row 2: T1 | T2 | T3 */}
                  <div className="d-flex justify-content-between mb-2 rounded py-1" style={{ background: darkMode ? '#0d2a1a' : '#d1e7dd' }}>
                    <div className="text-center" style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: '#198754' }}>Target 1</div>
                      <div className="fw-bold" style={{ fontSize: '14px', color: '#198754' }}>₹{row.t1}</div>
                    </div>
                    <div className="text-center" style={{ flex: 1, borderLeft: '1px solid #198754', borderRight: '1px solid #198754' }}>
                      <div style={{ fontSize: '14px', color: '#198754' }}>Target 2</div>
                      <div className="fw-bold" style={{ fontSize: '14px', color: '#198754' }}>₹{row.t2}</div>
                    </div>
                    <div className="text-center" style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: '#198754' }}>Target 3</div>
                      <div className="fw-bold" style={{ fontSize: '14px', color: '#198754' }}>₹{row.t3}</div>
                    </div>
                  </div>

                  {/* Row 3: Invested | Profit T1 | Loss */}
                  <div className="d-flex justify-content-between mb-2">
                    <div className="text-center" style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>Invested</div>
                      <div style={{ fontSize: '14px', color: text }}>₹{fmt(row.invested)}</div>
                    </div>
                    <div className="text-center" style={{ flex: 1, borderLeft: `1px solid ${border}`, borderRight: `1px solid ${border}` }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>Profit T1</div>
                      <div style={{ fontSize: '14px', color: '#198754' }}>₹{fmt(row.profitT1)}</div>
                    </div>
                    <div className="text-center" style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>Loss</div>
                      <div style={{ fontSize: '14px', color: '#dc3545' }}>₹{fmt(row.loss)}</div>
                    </div>
                  </div>

                  {/* Row 4: 1M Low | 1M High | P&L */}
                  <div className="d-flex justify-content-between mb-2">
                    <div className="text-center" style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>1M Low</div>
                      <div style={{ fontSize: '14px', color: '#198754' }}>₹{row.monthLow} <span style={{ fontSize: '14px' }}>({row.monthLowPct !== '-' ? `+${row.monthLowPct}%` : '-'})</span></div>
                    </div>
                    <div className="text-center" style={{ flex: 1, borderLeft: `1px solid ${border}`, borderRight: `1px solid ${border}` }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>1M High</div>
                      <div style={{ fontSize: '14px', color: '#dc3545' }}>₹{row.monthHigh} <span style={{ fontSize: '14px' }}>({row.monthHighPct !== '-' ? `${row.monthHighPct}%` : '-'})</span></div>
                    </div>
                    <div className="text-center" style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: textMuted }}>{row.currentPnl >= 0 ? 'Cur. Profit' : 'Cur. Loss'}</div>
                      <div className="fw-bold" style={{ fontSize: '14px', color: pnlColor }}>₹{fmt(Math.abs(row.currentPnl))}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary btn-sm flex-grow-1" style={{ fontSize: '14px' }} onClick={() => openEdit(origIdx)}>Edit</button>
                    <button className="btn btn-outline-danger btn-sm" style={{ fontSize: '14px', padding: '4px 14px' }} onClick={() => deleteRow(origIdx)}>Del</button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Mobile Totals */}
          <div className="rounded p-3 mt-2" style={{ background: darkMode ? '#1a1a3e' : '#343a40' }}>
            <div className="text-white fw-bold mb-2" style={{ fontSize: '14px' }}>TOTALS</div>
            <div className="d-flex justify-content-between mb-1">
              <span style={{ fontSize: '14px', color: '#adb5bd' }}>Invested</span>
              <span className="fw-bold text-white" style={{ fontSize: '14px' }}>₹{fmt(totalInvested)}</span>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span style={{ fontSize: '14px', color: '#adb5bd' }}>Profit T1 / T2 / T3</span>
              <span style={{ fontSize: '14px', color: '#198754' }}>₹{fmt(totalPT1)} / ₹{fmt(totalPT2)} / ₹{fmt(totalPT3)}</span>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span style={{ fontSize: '14px', color: '#adb5bd' }}>Max Loss</span>
              <span className="fw-bold" style={{ fontSize: '14px', color: '#dc3545' }}>₹{fmt(totalLoss)}</span>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span style={{ fontSize: '14px', color: '#adb5bd' }}>Current Profit</span>
              <span className="fw-bold" style={{ fontSize: '14px', color: '#198754' }}>₹{fmt(totalProfit)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span style={{ fontSize: '14px', color: '#adb5bd' }}>Current Loss</span>
              <span className="fw-bold" style={{ fontSize: '14px', color: '#dc3545' }}>₹{fmt(totalCurLoss)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
