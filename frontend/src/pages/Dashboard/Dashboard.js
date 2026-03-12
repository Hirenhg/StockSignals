import React, { useEffect, useState } from "react"
import { Helmet } from "react-helmet-async"
import API from "../../services/api"

function Dashboard() {
  const [signals, setSignals] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [searchTerm, setSearchTerm] = useState('')
  const [newStock, setNewStock] = useState('')
  const [assetTab, setAssetTab] = useState('indices')
  const [signalTab, setSignalTab] = useState('all')
  const [allData, setAllData] = useState({})
  const [fetchTime, setFetchTime] = useState(null)

  const filteredSignals = signals.filter(s => {
    const matchesSearch = s.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSignal = signalTab === 'all' || s.signal === signalTab.toUpperCase()
    return matchesSearch && matchesSignal
  })

  const buyCount = filteredSignals.filter(s => s.signal === 'BUY').length
  const sellCount = filteredSignals.filter(s => s.signal === 'SELL').length
  const holdCount = filteredSignals.filter(s => s.signal === 'HOLD').length

  useEffect(() => {
    fetchAllData()
    
    const handleSyncData = () => {
      console.log('Background sync triggered, refreshing data...');
      fetchAllData();
    };
    
    window.addEventListener('sync-data', handleSyncData);
    
    return () => {
      window.removeEventListener('sync-data', handleSyncData);
    };
  }, [])

  useEffect(() => {
    if (allData[assetTab]) {
      setSignals(allData[assetTab])
    }
  }, [assetTab, allData])

  const fetchAllData = () => {
    const types = ['indices', 'stocks', 'nifty50', 'niftynext50', 'commodities', 'crypto']
    const promises = types.map(type => 
      API.get(`/api/signals/${type}`).then(res => ({ type, data: res.data }))
    )
    
    Promise.all(promises)
      .then(results => {
        const dataObj = {}
        results.forEach(({ type, data }) => {
          dataObj[type] = data
        })
        setAllData(dataObj)
        setSignals(dataObj['stocks'])
        setFetchTime(new Date().toISOString())
      })
      .catch(err => console.error("API Error:", err))
  }

  const refreshCurrentTab = () => {
    API.get(`/api/signals/${assetTab}`)
      .then(res => {
        setAllData(prev => ({ ...prev, [assetTab]: res.data }))
        setSignals(res.data)
        setFetchTime(new Date().toISOString())
      })
      .catch(err => console.error("API Error:", err))
  }

  const handleAddStock = () => {
    if (!newStock.trim()) return
    const assetType = assetTab;
    API.post(`/api/${assetType}`, { symbol: newStock })
      .then(() => {
        setNewStock('')
        const displayName = assetType === 'nifty50' ? 'Nifty50 stock' : assetType === 'niftynext50' ? 'NiftyNext50 stock' : assetType === 'commodities' ? 'commodity' : assetType.slice(0, -1);
        alert(`${displayName} added successfully!`)
        fetchAllData()
      })
      .catch(err => {
        const displayName = assetType === 'nifty50' ? 'Nifty50 stock' : assetType === 'niftynext50' ? 'NiftyNext50 stock' : assetType === 'commodities' ? 'commodity' : assetType.slice(0, -1);
        alert(err.response?.data?.error || `Error adding ${displayName}`)
      })
  }

  const handleDeleteStock = (symbol) => {
    if (!window.confirm(`Delete ${symbol}?`)) return
    const assetType = assetTab;
    API.delete(`/api/${assetType}/${symbol}`)
      .then(() => {
        setSignals(signals.filter(s => s.symbol !== symbol))
        const displayName = assetType === 'nifty50' ? 'Nifty50 stock' : assetType === 'niftynext50' ? 'NiftyNext50 stock' : assetType === 'commodities' ? 'commodity' : assetType.slice(0, -1);
        alert(`${displayName} deleted successfully!`)
      })
      .catch(err => {
        console.error('Delete error:', err)
        const displayName = assetType === 'nifty50' ? 'Nifty50 stock' : assetType === 'niftynext50' ? 'NiftyNext50 stock' : assetType === 'commodities' ? 'commodity' : assetType.slice(0, -1);
        alert(err.response?.data?.error || `Error deleting ${displayName}`)
      })
  }

  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })

    const sorted = [...filteredSignals].sort((a, b) => {
      if (key === 'signal' || key === 'symbol') {
        return direction === 'asc' ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key])
      }
      return direction === 'asc' ? parseFloat(a[key]) - parseFloat(b[key]) : parseFloat(b[key]) - parseFloat(a[key])
    })
    setSignals(sorted)
  }

  return (
    <>
      <Helmet>
        <title>Stock Signals Dashboard</title>
      </Helmet>
      
      <div className="p-1">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-2">
          <h4 className="mb-0 fw-bold">Trading Signals</h4>
          <div className="d-flex gap-2 w-md-auto">
            <input 
              type="text" 
              className="form-control form-control" 
              placeholder={`Add ${assetTab === 'stocks' ? 'Stock' : assetTab === 'indices' ? 'Index' : assetTab}`} 
              value={newStock}
              onChange={(e) => setNewStock(e.target.value.toUpperCase())}
            />
            <button className="btn btn-primary" onClick={handleAddStock}>Add</button>
          </div>
        </div>

        <div className="mb-3">
          <div className="d-flex align-items-center flex-wrap gap-2 mb-2 overflow-auto pb-2" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
            <style>{`.overflow-auto::-webkit-scrollbar { display: none; }`}</style>
            {[
              { key: 'indices', label: 'Indices' },
              { key: 'stocks', label: 'Watchlist' },
              { key: 'nifty50', label: 'Nifty 50' },
              { key: 'niftynext50', label: 'Next 50'},
              { key: 'commodities', label: 'Commodities'},
              { key: 'crypto', label: 'Crypto' }
            ].map(tab => (
              <button 
                key={tab.key}
                className={`btn btn-sm flex-shrink-0 d-flex align-items-center gap-1 ${
                  assetTab === tab.key ? 'btn-primary' : 'btn-outline-primary'
                }`}
                onClick={() => setAssetTab(tab.key)}
                style={{fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap'}}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3 gap-3">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <div className="btn-group" role="group">
              <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
              <button className={`btn btn-sm ${signalTab === 'buy' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('buy')}>Buy</button>
              <button className={`btn btn-sm ${signalTab === 'sell' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('sell')}>Sell</button>
              <button className={`btn btn-sm ${signalTab === 'hold' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setSignalTab('hold')}>Hold</button>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={refreshCurrentTab}>
              <i className="bi bi-arrow-clockwise"></i>Refresh
            </button>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap flex-md-nowrap">
            <input 
              type="text" 
              className="form-control flex-grow-1" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{minWidth: '150px'}}
            />
            <div className="d-flex gap-2">
              <span className="badge bg-success p-2">BUY: {buyCount}</span>
              <span className="badge bg-danger p-2">SELL: {sellCount}</span>
              <span className="badge bg-secondary p-2">HOLD: {holdCount}</span>
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="d-md-none">
          {filteredSignals.map((item, index) => (
            <div key={index} className="card mb-3 shadow-sm">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h5 className="card-title mb-1 fw-bold">{item.symbol}</h5>
                    <h6 className="text-primary fw-bold mb-0">₹{item.price}</h6>
                  </div>
                  <span className={`badge rounded-pill px-3 py-2 ${item.signal === 'BUY' ? 'bg-success' : item.signal === 'SELL' ? 'bg-danger' : 'bg-secondary'}`}>
                    {item.signal}
                  </span>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <small className="text-muted d-block">RSI</small>
                    <strong>{item.rsi}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">Volume (K)</small>
                    <strong>{item.volume || '-'}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">52W High</small>
                    <strong>₹{item.week52High || '-'}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-muted d-block">52W Low</small>
                    <strong>₹{item.week52Low || '-'}</strong>
                  </div>
                </div>

                <div className="row g-3 mb-3 mt-3 border-top">
                  <div className="col-6">
                    <small className="text-danger d-block">EMA5</small>
                    <strong className="text-danger">₹{item.ema5}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-success d-block">EMA10</small>
                    <strong className="text-success">₹{item.ema10}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-primary d-block">EMA15</small>
                    <strong className="text-primary">₹{item.ema15}</strong>
                  </div>
                  <div className="col-6">
                    <small className="text-warning d-block">EMA20</small>
                    <strong className="text-warning">₹{item.ema20}</strong>
                  </div>
                </div>

                <button className="btn btn-danger btn-sm w-100" onClick={() => handleDeleteStock(item.symbol)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="d-none d-md-block table-responsive">
          <table className="table table-hover" style={{fontSize: '14px'}}>
            <thead className="table-dark">
              <tr>
                <th onClick={() => handleSort('symbol')} style={{cursor: 'pointer'}}>
                  Stock {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('price')} style={{cursor: 'pointer'}}>
                  Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('signal')} style={{cursor: 'pointer'}}>
                  Signal {sortConfig.key === 'signal' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('rsi')} style={{cursor: 'pointer'}}>
                  RSI {sortConfig.key === 'rsi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th style={{color: 'red'}}>EMA5</th>
                <th style={{color: 'green'}}>EMA10</th>
                <th style={{color: 'blue'}}>EMA15</th>
                <th style={{color: '#ffc107'}}>EMA20</th>
                <th onClick={() => handleSort('volume')} style={{cursor: 'pointer'}}>
                  Volume (K) {sortConfig.key === 'volume' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th>52W High</th>
                <th>52W Low</th>
                <th style={{color: '#28a745'}}>Yest High</th>
                <th style={{color: '#dc3545'}}>Yest Low</th>
                <th>Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSignals.map((item, index) => (
                <tr key={index}>
                  <td className="fw-bold">{item.symbol}</td>
                  <td>₹{item.price}</td>
                  <td>
                    <span className={`badge ${item.signal === "BUY" ? "bg-success" : item.signal === "SELL" ? "bg-danger" : "bg-secondary"}`}>
                      {item.signal}
                    </span>
                  </td>
                  <td>{item.rsi}</td>
                  <td style={{color: 'red'}}>₹{item.ema5}</td>
                  <td style={{color: 'green'}}>₹{item.ema10}</td>
                  <td style={{color: 'blue'}}>₹{item.ema15}</td>
                  <td style={{color: '#ffc107'}}>₹{item.ema20}</td>
                  <td>{item.volume || '-'}</td>
                  <td>₹{item.week52High || '-'}</td>
                  <td>₹{item.week52Low || '-'}</td>
                  <td style={{color: '#28a745', fontWeight: 'bold'}}>₹{item.yesterdayHigh || '-'}</td>
                  <td style={{color: '#dc3545', fontWeight: 'bold'}}>₹{item.yesterdayLow || '-'}</td>
                  <td>{fetchTime ? new Date(fetchTime).toLocaleString() : new Date(item.timestamp).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteStock(item.symbol)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default Dashboard