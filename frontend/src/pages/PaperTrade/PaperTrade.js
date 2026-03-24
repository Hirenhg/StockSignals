import { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import API from '../../services/api'
import { SkeletonTable } from '../../components/Skeleton/Skeleton'

function PaperTrade() {
  const [wallet, setWallet] = useState(null)
  const [positions, setPositions] = useState([])
  const [trades, setTrades] = useState([])
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const [modal, setModal] = useState({ show: false, type: 'BUY', symbol: '', price: '', qty: '1' })
  const [tab, setTab] = useState('positions')
  const [suggestions, setSuggestions] = useState([])

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000)
  }

  const fetchWallet = useCallback(() => {
    API.get('/api/paper-trade/wallet')
      .then(res => {
        setWallet(res.data.wallet)
        setPositions(res.data.positions)
        setTrades(res.data.trades)
      })
      .catch(() => showToast('Failed to load wallet', 'error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchWallet() }, [fetchWallet])

  // Fetch live prices for positions
  useEffect(() => {
    if (!positions.length) return
    const symbols = positions.map(p => p.symbol)
    API.post('/api/prices', { symbols })
      .then(res => setPrices(res.data))
      .catch(() => {})
    const interval = setInterval(() => {
      API.post('/api/prices', { symbols }).then(res => setPrices(res.data)).catch(() => {})
    }, 15000)
    return () => clearInterval(interval)
  }, [positions.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const searchSymbol = async (val) => {
    if (val.length < 1) { setSuggestions([]); return }
    try {
      const res = await API.get(`/api/search?q=${val}&type=stocks`)
      setSuggestions(res.data)
    } catch { setSuggestions([]) }
  }

  const executeTrade = () => {
    const { type, symbol, price, qty } = modal
    if (!symbol || !price || !qty || parseInt(qty) <= 0) return showToast('Fill all fields', 'error')
    API.post(`/api/paper-trade/${type.toLowerCase()}`, { symbol, price: parseFloat(price), qty: parseInt(qty) })
      .then(res => {
        showToast(res.data.message, 'success')
        setWallet(res.data.wallet)
        setPositions(res.data.positions)
        setModal({ show: false, type: 'BUY', symbol: '', price: '', qty: '1' })
        setSuggestions([])
        fetchWallet()
      })
      .catch(err => showToast(err.response?.data?.error || 'Trade failed', 'error'))
  }

  const resetAccount = () => {
    if (!window.confirm('Reset paper trading? All positions and history will be cleared.')) return
    API.post('/api/paper-trade/reset')
      .then(res => {
        showToast(res.data.message)
        setWallet(res.data.wallet)
        setPositions([])
        setTrades([])
        setPrices({})
      })
      .catch(() => showToast('Reset failed', 'error'))
  }

  const openBuySell = (type, symbol = '', price = '') => {
    setModal({ show: true, type, symbol, price: price ? String(price) : '', qty: '1' })
    setSuggestions([])
  }

  // Calculate portfolio P&L
  const invested = positions.reduce((sum, p) => sum + p.avgPrice * p.qty, 0)
  const currentVal = positions.reduce((sum, p) => {
    const ltp = prices[p.symbol]?.price || p.avgPrice
    return sum + ltp * p.qty
  }, 0)
  const totalPnl = currentVal - invested
  const totalPnlPct = invested ? (totalPnl / invested * 100) : 0

  if (loading) return <div className="p-1"><SkeletonTable rows={6} cols={6} /></div>

  return (
    <>
      <Helmet><title>Paper Trading - StockSignal</title></Helmet>
      <div className="p-1">
        {toast.show && (
          <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
            <div className={`alert alert-${toast.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`}>
              {toast.message}
              <button type="button" className="btn-close" onClick={() => setToast({ show: false, message: '', type: '' })}></button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h4 className="mb-0 fw-bold">Paper Trading</h4>
          <div className="d-flex gap-2">
            <button className="btn btn-success btn-sm" onClick={() => openBuySell('BUY')}>Buy</button>
            <button className="btn btn-danger btn-sm" onClick={() => openBuySell('SELL')}>Sell</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={resetAccount}>Reset</button>
          </div>
        </div>

        {/* Wallet Summary Cards */}
        {wallet && (
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3">
              <div className="card shadow-sm">
                <div className="card-body py-2 px-3">
                  <small className="text-muted d-block">Balance</small>
                  <strong>₹{wallet.balance.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card shadow-sm">
                <div className="card-body py-2 px-3">
                  <small className="text-muted d-block">Invested</small>
                  <strong>₹{invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card shadow-sm">
                <div className="card-body py-2 px-3">
                  <small className="text-muted d-block">Current Value</small>
                  <strong>₹{currentVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card shadow-sm">
                <div className="card-body py-2 px-3">
                  <small className="text-muted d-block">Total P&L</small>
                  <strong style={{ color: totalPnl >= 0 ? '#198754' : '#dc3545' }}>
                    {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toFixed(2)} ({totalPnlPct.toFixed(2)}%)
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="d-flex gap-2 mb-3">
          <button className={`btn btn-sm ${tab === 'positions' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setTab('positions')}>
            Positions ({positions.length})
          </button>
          <button className={`btn btn-sm ${tab === 'trades' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setTab('trades')}>
            Trade History ({trades.length})
          </button>
        </div>

        {/* Positions */}
        {tab === 'positions' && (
          <>
            {/* Mobile cards */}
            <div className="d-md-none">
              {positions.length === 0 ? (
                <div className="text-center text-muted py-4">No open positions. Start trading!</div>
              ) : positions.map((p, i) => {
                const ltp = prices[p.symbol]?.price || p.avgPrice
                const pnl = (ltp - p.avgPrice) * p.qty
                const pnlPct = ((ltp - p.avgPrice) / p.avgPrice * 100)
                return (
                  <div key={i} className="card mb-2 shadow-sm">
                    <div className="card-body py-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong>{p.symbol}</strong>
                        <span style={{ color: pnl >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold' }}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)} ({pnlPct.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="d-flex justify-content-between" style={{ fontSize: '13px' }}>
                        <span>Qty: {p.qty} | Avg: ₹{p.avgPrice}</span>
                        <span>LTP: ₹{parseFloat(ltp).toFixed(2)}</span>
                      </div>
                      <div className="d-flex gap-2 mt-2">
                        <button className="btn btn-success btn-sm flex-fill" onClick={() => openBuySell('BUY', p.symbol, ltp)}>Buy More</button>
                        <button className="btn btn-danger btn-sm flex-fill" onClick={() => openBuySell('SELL', p.symbol, ltp)}>Sell</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Desktop table */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover" style={{ fontSize: '14px' }}>
                <thead className="table-dark">
                  <tr>
                    <th>Symbol</th><th>Qty</th><th>Avg Price</th><th>LTP</th><th>Invested</th><th>Current</th><th>P&L</th><th>P&L %</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.length === 0 ? (
                    <tr><td colSpan="9" className="text-center text-muted py-3">No open positions</td></tr>
                  ) : positions.map((p, i) => {
                    const ltp = prices[p.symbol]?.price || p.avgPrice
                    const inv = p.avgPrice * p.qty
                    const cur = ltp * p.qty
                    const pnl = cur - inv
                    const pnlPct = ((ltp - p.avgPrice) / p.avgPrice * 100)
                    return (
                      <tr key={i}>
                        <td className="fw-bold">{p.symbol}</td>
                        <td>{p.qty}</td>
                        <td>₹{p.avgPrice.toFixed(2)}</td>
                        <td>₹{parseFloat(ltp).toFixed(2)}</td>
                        <td>₹{inv.toFixed(0)}</td>
                        <td>₹{cur.toFixed(0)}</td>
                        <td style={{ color: pnl >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold' }}>{pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}</td>
                        <td style={{ color: pnlPct >= 0 ? '#198754' : '#dc3545', fontWeight: 'bold' }}>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</td>
                        <td>
                          <button className="btn btn-success btn-sm me-1" onClick={() => openBuySell('BUY', p.symbol, ltp)}>Buy</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openBuySell('SELL', p.symbol, ltp)}>Sell</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Trade History */}
        {tab === 'trades' && (
          <>
            <div className="d-md-none">
              {trades.length === 0 ? (
                <div className="text-center text-muted py-4">No trades yet</div>
              ) : trades.map((t, i) => (
                <div key={i} className="card mb-2 shadow-sm">
                  <div className="card-body py-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{t.symbol}</strong>
                        <span className={`badge ms-2 ${t.type === 'BUY' ? 'bg-success' : 'bg-danger'}`}>{t.type}</span>
                      </div>
                      <strong>₹{t.total.toFixed(2)}</strong>
                    </div>
                    <small className="text-muted">{t.qty} × ₹{t.price} · {new Date(t.date).toLocaleString()}</small>
                  </div>
                </div>
              ))}
            </div>
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover" style={{ fontSize: '14px' }}>
                <thead className="table-dark">
                  <tr><th>Date</th><th>Symbol</th><th>Type</th><th>Price</th><th>Qty</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {trades.length === 0 ? (
                    <tr><td colSpan="6" className="text-center text-muted py-3">No trades yet</td></tr>
                  ) : trades.map((t, i) => (
                    <tr key={i}>
                      <td>{new Date(t.date).toLocaleString()}</td>
                      <td className="fw-bold">{t.symbol}</td>
                      <td><span className={`badge ${t.type === 'BUY' ? 'bg-success' : 'bg-danger'}`}>{t.type}</span></td>
                      <td>₹{t.price.toFixed(2)}</td>
                      <td>{t.qty}</td>
                      <td>₹{t.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Buy/Sell Modal */}
        {modal.show && (
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{modal.type === 'BUY' ? '🟢 Buy' : '🔴 Sell'} Stock</h5>
                  <button type="button" className="btn-close" onClick={() => { setModal({ ...modal, show: false }); setSuggestions([]) }}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3 position-relative">
                    <label className="form-label">Symbol</label>
                    <input className="form-control" value={modal.symbol}
                      onChange={e => { setModal({ ...modal, symbol: e.target.value.toUpperCase() }); searchSymbol(e.target.value.toUpperCase()) }}
                      placeholder="Search stock..." autoComplete="off" />
                    {suggestions.length > 0 && (
                      <ul className="list-group position-absolute w-100 shadow" style={{ zIndex: 9999, maxHeight: '180px', overflowY: 'auto', top: '100%' }}>
                        {suggestions.map((s, i) => (
                          <li key={i} className="list-group-item list-group-item-action py-2 px-3" style={{ cursor: 'pointer', fontSize: '13px' }}
                            onClick={() => {
                              setModal({ ...modal, symbol: s.symbol })
                              setSuggestions([])
                              // Auto-fetch price
                              API.post('/api/prices', { symbols: [s.symbol] })
                                .then(r => { if (r.data[s.symbol]?.price) setModal(m => ({ ...m, price: String(r.data[s.symbol].price) })) })
                                .catch(() => {})
                            }}>
                            <span className="fw-bold">{s.symbol}</span>
                            {s.name && s.name !== s.symbol && <span className="text-muted ms-2">{s.name}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Price (₹)</label>
                    <input type="number" className="form-control" value={modal.price}
                      onChange={e => setModal({ ...modal, price: e.target.value })} step="0.05" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Quantity</label>
                    <input type="number" className="form-control" value={modal.qty}
                      onChange={e => setModal({ ...modal, qty: e.target.value })} min="1" />
                  </div>
                  {modal.price && modal.qty && (
                    <div className="alert alert-light mb-0 py-2">
                      Total: <strong>₹{(parseFloat(modal.price || 0) * parseInt(modal.qty || 0)).toLocaleString('en-IN')}</strong>
                      {wallet && <span className="text-muted ms-2">| Available: ₹{wallet.balance.toLocaleString('en-IN')}</span>}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => { setModal({ ...modal, show: false }); setSuggestions([]) }}>Cancel</button>
                  <button className={`btn ${modal.type === 'BUY' ? 'btn-success' : 'btn-danger'}`} onClick={executeTrade}>
                    {modal.type} {modal.symbol || 'Stock'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default PaperTrade
