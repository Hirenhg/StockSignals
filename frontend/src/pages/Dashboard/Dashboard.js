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
      
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Trading Signals</h4>
          <div className="d-flex gap-2">
            <input 
              type="text" 
              className="form-control" 
              placeholder={`Add ${assetTab === 'stocks' ? 'Stocks' : assetTab === 'indices' ? 'indices' : assetTab === 'commodities' ? 'commodities' : assetTab === 'crypto' ? 'Crypto' : assetTab === 'nifty50' ? 'Nifty50 Stock' : 'NiftyNext50 Stock'}`} 
              value={newStock}
              onChange={(e) => setNewStock(e.target.value.toUpperCase())}
            />
            <button className="btn btn-primary" onClick={handleAddStock}>Add</button>
          </div>
        </div>
        <div className="bg-white rounded-2 mb-3">
        {/* Asset Type Tabs */}
        <ul className="nav nav-pills" style={{fontSize: '14px'}}>
           <li className="nav-item">
            <button className={`nav-link ${assetTab === 'indices' ? 'active' : ''}`} onClick={() => setAssetTab('indices')}>Indices</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${assetTab === 'stocks' ? 'active' : ''}`} onClick={() => setAssetTab('stocks')}>Watchlist Stocks</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${assetTab === 'nifty50' ? 'active' : ''}`} onClick={() => setAssetTab('nifty50')}>Nifty 50</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${assetTab === 'niftynext50' ? 'active' : ''}`} onClick={() => setAssetTab('niftynext50')}>Nifty Next 50</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${assetTab === 'commodities' ? 'active' : ''}`} onClick={() => setAssetTab('commodities')}>Commodities</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${assetTab === 'crypto' ? 'active' : ''}`} onClick={() => setAssetTab('crypto')}>Crypto</button>
          </li>
        </ul>
         </div>
           {/* Signal Filter & Search */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex gap-2 align-items-center">
            <div className="btn-group" role="group">
              <button className={`btn btn-sm ${signalTab === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setSignalTab('all')}>All</button>
              <button className={`btn btn-sm ${signalTab === 'buy' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setSignalTab('buy')}>Buy</button>
              <button className={`btn btn-sm ${signalTab === 'sell' ? 'btn-danger' : 'btn-outline-danger'}`} onClick={() => setSignalTab('sell')}>Sell</button>
              <button className={`btn btn-sm ${signalTab === 'hold' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setSignalTab('hold')}>Hold</button>
            </div>
            <button className="btn btn-sm btn-outline-primary" onClick={refreshCurrentTab} title="Refresh">
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>
          <div className="d-flex align-items-center gap-3">
            <input 
              type="text" 
              className="form-control form-control-sm" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="d-flex gap-2">
              <span className="badge bg-success">BUY: {buyCount}</span>
              <span className="badge bg-danger">SELL: {sellCount}</span>
              <span className="badge bg-secondary">HOLD: {holdCount}</span>
            </div>
          </div>
        </div>
        <div className="table-responsive">
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
              {filteredSignals.map((item,index)=>(
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
                    <button className="btn btn-sm btn-primary" onClick={() => handleDeleteStock(item.symbol)}>Delete</button>
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