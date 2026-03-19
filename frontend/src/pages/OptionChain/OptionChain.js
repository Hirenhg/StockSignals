import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import API from "../../services/api";
import { useTheme } from "../../context/ThemeContext";
import { SkeletonTable, SkeletonCards } from "../../components/Skeleton/Skeleton";

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NYKAA', 'MAZDOCK'];

const OptionChain = () => {
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiries, setExpiries] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [chain, setChain] = useState([]);
  const [loading, setLoading] = useState(true);
  const [strikeRange, setStrikeRange] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const { darkMode } = useTheme();

  const fetchChain = useCallback(async () => {
    setLoading(true);
    try {
      const params = selectedExpiry ? `?expiry=${selectedExpiry}` : '';
      const res = await API.get(`/api/optionchain/${symbol}${params}`);
      setExpiries(res.data.expiries || []);
      setSelectedExpiry(res.data.selectedExpiry || '');
      setChain(res.data.chain || []);
    } catch (err) {} finally {
      setLoading(false);
    }
  }, [symbol, selectedExpiry]);

  useEffect(() => { fetchChain(); }, [fetchChain]);

  // Find ATM strike (highest OI CE side)
  const atmIndex = chain.reduce((maxIdx, row, idx, arr) => {
    const ceOi = row.ce?.oi || 0;
    return ceOi > (arr[maxIdx]?.ce?.oi || 0) ? idx : maxIdx;
  }, 0);

  // Show limited strikes around ATM
  const startIdx = Math.max(0, atmIndex - strikeRange);
  const endIdx = Math.min(chain.length, atmIndex + strikeRange + 1);
  const visibleChain = chain.slice(startIdx, endIdx);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortValue = (row, key) => {
    const map = {
      'ce.oi': row.ce?.oi || 0, 'ce.volume': row.ce?.volume || 0,
      'ce.change': row.ce?.change || 0, 'ce.ltp': row.ce?.ltp || 0,
      'strike': row.strike || 0,
      'pe.ltp': row.pe?.ltp || 0, 'pe.change': row.pe?.change || 0,
      'pe.volume': row.pe?.volume || 0, 'pe.oi': row.pe?.oi || 0
    };
    return map[key] || 0;
  };

  const sortedChain = sortConfig.key
    ? [...visibleChain].sort((a, b) => {
        const aVal = getSortValue(a, sortConfig.key);
        const bVal = getSortValue(b, sortConfig.key);
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      })
    : visibleChain;

  const maxCeOi = Math.max(...sortedChain.map(r => r.ce?.oi || 0), 1);
  const maxPeOi = Math.max(...sortedChain.map(r => r.pe?.oi || 0), 1);

  const formatNum = (n) => {
    if (!n || n === 0) return '-';
    if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
    if (n >= 100000) return (n / 100000).toFixed(2) + ' L';
    if (n >= 1000) return (n / 1000).toFixed(1) + ' K';
    return n.toLocaleString();
  };

  return (
    <>
      <Helmet><title>Option Chain - {symbol}</title></Helmet>
      <div>
        {/* Desktop Controls */}
        <div className="d-none d-md-flex flex-wrap gap-2 align-items-center mb-3">
          <h4 className="mb-0 fw-bold me-auto">Option Chain</h4>
          <select className="form-select" style={{width: 'auto'}} value={symbol} onChange={e => { setSymbol(e.target.value); setSelectedExpiry(''); }} aria-label="Symbol">
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-select" style={{width: 'auto'}} value={selectedExpiry} onChange={e => setSelectedExpiry(e.target.value)} aria-label="Expiry">
            {expiries.map(exp => <option key={exp} value={exp}>{exp}</option>)}
          </select>
          <select className="form-select" style={{width: 'auto'}} value={strikeRange} onChange={e => setStrikeRange(Number(e.target.value))} aria-label="Strike range">
            <option value={5}>±5 Strikes</option>
            <option value={10}>±10 Strikes</option>
            <option value={20}>±20 Strikes</option>
            <option value={50}>All Strikes</option>
          </select>
          <button className="btn btn-sm btn-outline-primary" onClick={fetchChain}>Refresh</button>
        </div>

        {/* Mobile Controls */}
        <div className="d-md-none mb-3">
          <h4 className="mb-3 fw-bold">Option Chain</h4>
          <div className="d-flex gap-2 mb-2">
            <select className="form-select" value={symbol} onChange={e => { setSymbol(e.target.value); setSelectedExpiry(''); }} aria-label="Symbol">
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" value={selectedExpiry} onChange={e => setSelectedExpiry(e.target.value)} aria-label="Expiry">
              {expiries.map(exp => <option key={exp} value={exp}>{exp}</option>)}
            </select>
          </div>
          <div className="d-flex gap-2">
            <select className="form-select" value={strikeRange} onChange={e => setStrikeRange(Number(e.target.value))} aria-label="Strike range">
              <option value={5}>±5 Strikes</option>
              <option value={10}>±10 Strikes</option>
              <option value={20}>±20 Strikes</option>
              <option value={50}>All Strikes</option>
            </select>
            <button className="btn btn-outline-primary w-100" onClick={fetchChain}>Refresh</button>
          </div>
        </div>

        {loading ? (
          <><SkeletonCards count={4} /><SkeletonTable rows={10} cols={9} /></>
        ) : chain.length === 0 ? (
          <div className="text-center text-muted p-5">No option chain data found for {symbol}</div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="d-none d-md-block table-responsive">
              <table className="table table-hover mb-0" style={{fontSize: '14px'}}>
                <thead>
                  <tr className="text-center">
                    <th colSpan="4" className="bg-success bg-opacity-10 text-success border-bottom-0">CALLS (CE)</th>
                    <th className="border-bottom-0"></th>
                    <th colSpan="4" className="bg-danger bg-opacity-10 text-danger border-bottom-0">PUTS (PE)</th>
                  </tr>
                  <tr className="text-center table-dark" style={{fontSize: '14px'}}>
                    {[{key:'ce.oi',label:'Open Interest'},{key:'ce.volume',label:'Volume'},{key:'ce.change',label:'Change'},{key:'ce.ltp',label:'LTP'}].map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} style={{cursor:'pointer'}}>
                        {col.label} {sortConfig.key === col.key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                    <th onClick={() => handleSort('strike')} style={{background: '#343a40', color: '#ffc107', minWidth: '80px', cursor:'pointer'}}>
                      STRIKE {sortConfig.key === 'strike' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    {[{key:'pe.ltp',label:'LTP'},{key:'pe.change',label:'Change'},{key:'pe.volume',label:'Volume'},{key:'pe.oi',label:'Open Interest'}].map(col => (
                      <th key={col.key} onClick={() => handleSort(col.key)} style={{cursor:'pointer'}}>
                        {col.label} {sortConfig.key === col.key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedChain.map((row, idx) => {
                    const isAtm = !sortConfig.key && startIdx + idx === atmIndex;
                    return (
                      <tr key={row.strike} className={`text-center ${isAtm ? 'table-warning' : ''}`} style={{verticalAlign: 'middle'}}>
                        {/* CE Side */}
                        <td style={{position: 'relative'}}>
                          <div style={{position: 'absolute', top: 0, right: 0, bottom: 0, width: `${((row.ce?.oi || 0) / maxCeOi) * 100}%`, background: 'rgba(25,135,84,0.08)'}}></div>
                          <span style={{position: 'relative'}}>{formatNum(row.ce?.oi)}</span>
                        </td>
                        <td>{formatNum(row.ce?.volume)}</td>
                        <td style={{color: (row.ce?.change || 0) >= 0 ? '#198754' : '#dc3545'}}>
                          {row.ce?.change ? row.ce.change.toFixed(2) : '-'}
                        </td>
                        <td className="fw-bold">{row.ce?.ltp ? `₹${row.ce.ltp.toFixed(2)}` : '-'}</td>
                        {/* Strike */}
                        <td className="fw-bold" style={{background: isAtm ? '#ffc107' : (darkMode ? '#0f3460' : '#f8f9fa'), color: isAtm ? '#212529' : (darkMode ? '#ffc107' : '#212529')}}>
                          {row.strike}
                        </td>
                        {/* PE Side */}
                        <td className="fw-bold">{row.pe?.ltp ? `₹${row.pe.ltp.toFixed(2)}` : '-'}</td>
                        <td style={{color: (row.pe?.change || 0) >= 0 ? '#198754' : '#dc3545'}}>
                          {row.pe?.change ? row.pe.change.toFixed(2) : '-'}
                        </td>
                        <td>{formatNum(row.pe?.volume)}</td>
                        <td style={{position: 'relative'}}>
                          <div style={{position: 'absolute', top: 0, left: 0, bottom: 0, width: `${((row.pe?.oi || 0) / maxPeOi) * 100}%`, background: 'rgba(220,53,69,0.08)'}}></div>
                          <span style={{position: 'relative'}}>{formatNum(row.pe?.oi)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="d-md-none">
              {visibleChain.map((row, idx) => {
                const isAtm = startIdx + idx === atmIndex;
                return (
                  <div key={row.strike} className={`card mb-3 shadow-sm ${isAtm ? 'border-warning border-2' : ''}`}>
                    <div className="card-body p-3">
                      <div className="text-center mb-3">
                        <span className={`badge ${isAtm ? 'bg-warning text-dark' : 'bg-dark'} px-4 py-2`} style={{fontSize: '15px'}}>
                          ₹{row.strike} {isAtm && '• ATM'}
                        </span>
                      </div>
                      <div className="row g-0">
                        {/* CE Side */}
                        <div className="col-6 pe-3 border-end">
                          <div className="text-center mb-2">
                            <span className="badge bg-success px-3 py-1" style={{fontSize: '13px'}}>CALL (CE)</span>
                          </div>
                          <div className="d-flex justify-content-between mb-1" style={{fontSize: '14px'}}>
                            <span className="text-muted">LTP</span>
                            <strong>{row.ce?.ltp ? `₹${row.ce.ltp.toFixed(2)}` : '-'}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-1" style={{fontSize: '14px'}}>
                            <span className="text-muted">OI</span>
                            <span>{formatNum(row.ce?.oi)}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-1" style={{fontSize: '14px'}}>
                            <span className="text-muted">Volume</span>
                            <span>{formatNum(row.ce?.volume)}</span>
                          </div>
                          <div className="d-flex justify-content-between" style={{fontSize: '14px'}}>
                            <span className="text-muted">Change</span>
                            <span style={{color: (row.ce?.change || 0) >= 0 ? '#198754' : '#dc3545', fontWeight: 600}}>
                              {row.ce?.change ? row.ce.change.toFixed(2) : '-'}
                            </span>
                          </div>
                        </div>
                        {/* PE Side */}
                        <div className="col-6 ps-3">
                          <div className="text-center mb-2">
                            <span className="badge bg-danger px-3 py-1" style={{fontSize: '13px'}}>PUT (PE)</span>
                          </div>
                          <div className="d-flex justify-content-between mb-1" style={{fontSize: '14px'}}>
                            <span className="text-muted">LTP</span>
                            <strong>{row.pe?.ltp ? `₹${row.pe.ltp.toFixed(2)}` : '-'}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-1" style={{fontSize: '14px'}}>
                            <span className="text-muted">OI</span>
                            <span>{formatNum(row.pe?.oi)}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-1" style={{fontSize: '14px'}}>
                            <span className="text-muted">Volume</span>
                            <span>{formatNum(row.pe?.volume)}</span>
                          </div>
                          <div className="d-flex justify-content-between" style={{fontSize: '14px'}}>
                            <span className="text-muted">Change</span>
                            <span style={{color: (row.pe?.change || 0) >= 0 ? '#198754' : '#dc3545', fontWeight: 600}}>
                              {row.pe?.change ? row.pe.change.toFixed(2) : '-'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default OptionChain;
