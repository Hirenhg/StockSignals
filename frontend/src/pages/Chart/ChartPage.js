import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import API from '../../services/api'
import { useTheme } from '../../context/ThemeContext'

const TIMEFRAMES = [
  { label: '1m', interval: '1m', range: '1d' },
  { label: '5m', interval: '5m', range: '5d' },
  { label: '15m', interval: '15m', range: '5d' },
  { label: '1H', interval: '1h', range: '1mo' },
  { label: '1D', interval: '1d', range: '6mo' },
  { label: '1W', interval: '1wk', range: '2y' },
]

const calcEMA = (data, period) => {
  const k = 2 / (period + 1)
  const result = []
  let prev = null
  for (const d of data) {
    if (prev === null) { prev = d.close; result.push({ time: d.time, value: d.close }); continue }
    prev = d.close * k + prev * (1 - k)
    result.push({ time: d.time, value: parseFloat(prev.toFixed(2)) })
  }
  return result
}

const calcSMA = (data, period) => {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    result.push({ time: data[i].time, value: parseFloat((sum / period).toFixed(2)) })
  }
  return result
}

const ChartPage = () => {
  const { symbol: rawSymbol } = useParams()
  const symbol = decodeURIComponent(rawSymbol)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { darkMode } = useTheme()
  const chartContainerRef = useRef(null)
  const chartRef = useRef(null)
  const [tf, setTf] = useState(searchParams.get('tf') || '5m')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chartType, setChartType] = useState('candle')
  const [priceInfo, setPriceInfo] = useState(null)
  const [searchSymbol, setSearchSymbol] = useState('')
  const mode = searchParams.get('mode') || 'dashboard'

  const fetchAndRender = useCallback(async () => {
    setLoading(true)
    setError(null)
    const tfConfig = TIMEFRAMES.find(t => t.label === tf) || TIMEFRAMES[1]
    try {
      const res = await API.get(`/api/chart/${encodeURIComponent(symbol)}?interval=${tfConfig.interval}&range=${tfConfig.range}`)
      const candles = res.data.candles || []
      if (!candles.length) { setError('No data available'); setLoading(false); return }
      if (!chartContainerRef.current) { setLoading(false); return }

      const last = candles[candles.length - 1]
      const first = candles[0]
      const change = last.close - first.open
      const pChange = ((change / first.open) * 100).toFixed(2)
      setPriceInfo({ price: last.close.toFixed(2), change: change.toFixed(2), pChange, high: Math.max(...candles.map(c => c.high)).toFixed(2), low: Math.min(...candles.map(c => c.low)).toFixed(2) })

      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: { background: { color: darkMode ? '#1a1a2e' : '#fff' }, textColor: darkMode ? '#a0a0b0' : '#555' },
        grid: { vertLines: { color: darkMode ? '#1f1f3a' : '#f5f5f5' }, horzLines: { color: darkMode ? '#1f1f3a' : '#f5f5f5' } },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: darkMode ? '#2a2a4a' : '#e0e0e0', scaleMargins: { top: 0.1, bottom: 0.2 } },
        timeScale: { borderColor: darkMode ? '#2a2a4a' : '#e0e0e0', timeVisible: true, secondsVisible: false },
      })
      chartRef.current = chart

      if (chartType === 'candle') {
        const cs = chart.addSeries(CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350' })
        cs.setData(candles)
      } else {
        const ls = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2 })
        ls.setData(candles.map(c => ({ time: c.time, value: c.close })))
      }

      if (mode === 'equity') {
        chart.addSeries(LineSeries, { color: '#4fc3f7', lineWidth: 1 }).setData(calcEMA(candles, 10))
        chart.addSeries(LineSeries, { color: '#81c784', lineWidth: 1 }).setData(calcEMA(candles, 20))
        if (candles.length >= 40) chart.addSeries(LineSeries, { color: '#ffb74d', lineWidth: 2 }).setData(calcSMA(candles, 40))
      } else {
        chart.addSeries(LineSeries, { color: '#ef5350', lineWidth: 1 }).setData(calcEMA(candles, 5))
        chart.addSeries(LineSeries, { color: '#26a69a', lineWidth: 1 }).setData(calcEMA(candles, 10))
        chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 1 }).setData(calcEMA(candles, 15))
        chart.addSeries(LineSeries, { color: '#ffc107', lineWidth: 1 }).setData(calcEMA(candles, 20))
      }

      const vs = chart.addSeries(HistogramSeries, { color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: 'vol' })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
      vs.setData(candles.map(c => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(38,166,154,0.25)' : 'rgba(239,83,80,0.25)' })))

      chart.timeScale().fitContent()

      const handleResize = () => { if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth }) }
      window.addEventListener('resize', handleResize)
      setLoading(false)
      return () => window.removeEventListener('resize', handleResize)
    } catch (err) {
      console.error('Chart error:', err)
      setError('Failed to load chart')
      setLoading(false)
    }
  }, [symbol, tf, darkMode, chartType, mode])

  useEffect(() => { fetchAndRender() }, [fetchAndRender])
  useEffect(() => { return () => { if (chartRef.current) { chartRef.current.remove(); chartRef.current = null } } }, [])

  const handleSymbolSearch = (e) => {
    e.preventDefault()
    if (searchSymbol.trim()) navigate(`/chart/${searchSymbol.trim().toUpperCase()}?mode=${mode}`)
  }

  const isUp = priceInfo && parseFloat(priceInfo.change) >= 0

  return (
    <>
      <Helmet><title>{symbol} Chart - StockSignal</title></Helmet>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Bar */}
        <div className="border-bottom px-3 py-2" style={{ background: darkMode ? '#16213e' : '#fff' }}>
          {/* Row 1: Back + Symbol + Price + Search */}
          <div className="d-flex align-items-center gap-2 mb-2">
            <button className="btn btn-sm btn-outline-secondary border-0 p-1" onClick={() => navigate(-1)} style={{ fontSize: '18px', lineHeight: 1 }}>←</button>
            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              <h5 className="mb-0 fw-bold">{symbol}</h5>
              <span className="badge" style={{ background: mode === 'equity' ? '#7c3aed' : '#2962FF', fontSize: '10px' }}>
                {mode === 'equity' ? 'EQ' : 'EMA'}
              </span>
            </div>
            {priceInfo && (
              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                <span className="fw-bold" style={{ fontSize: '18px' }}>₹{priceInfo.price}</span>
                <span className="fw-bold" style={{ fontSize: '13px', color: isUp ? '#26a69a' : '#ef5350' }}>
                  {isUp ? '▲' : '▼'} {Math.abs(priceInfo.change)} ({isUp ? '+' : ''}{priceInfo.pChange}%)
                </span>
              </div>
            )}
            <form onSubmit={handleSymbolSearch} className="ms-auto d-none d-md-flex" style={{ maxWidth: '180px' }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search symbol..."
                value={searchSymbol}
                onChange={e => setSearchSymbol(e.target.value.toUpperCase())}
                style={{ fontSize: '12px' }}
              />
            </form>
          </div>

          {/* Row 2: Timeframes + Chart Type + Indicators */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex gap-1 overflow-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
              {TIMEFRAMES.map(t => (
                <button
                  key={t.label}
                  className={`btn flex-shrink-0 ${tf === t.label ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setTf(t.label)}
                  style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', fontWeight: tf === t.label ? 700 : 400 }}
                >{t.label}</button>
              ))}
            </div>

            <div className="vr d-none d-md-block" style={{ height: '20px' }}></div>

            <div className="d-flex gap-1 flex-shrink-0" role="group">
              <button className={`btn btn-sm ${chartType === 'candle' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setChartType('candle')} style={{ fontSize: '12px', padding: '3px 8px' }}>🕯️ Candle</button>
              <button className={`btn btn-sm ${chartType === 'line' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setChartType('line')} style={{ fontSize: '12px', padding: '3px 8px' }}>📈 Line</button>
            </div>

            <div className="vr d-none d-md-block" style={{ height: '20px' }}></div>

            {priceInfo && (
              <div className="d-none d-md-flex gap-3 flex-shrink-0" style={{ fontSize: '11px' }}>
                <span><span className="text-muted">H:</span> <span style={{ color: '#26a69a', fontWeight: 600 }}>₹{priceInfo.high}</span></span>
                <span><span className="text-muted">L:</span> <span style={{ color: '#ef5350', fontWeight: 600 }}>₹{priceInfo.low}</span></span>
              </div>
            )}

            <div className="d-none d-md-flex gap-2 ms-auto" style={{ fontSize: '10px' }}>
              {mode === 'equity' ? (
                <>
                  <span style={{ color: '#4fc3f7' }}>● EMA10</span>
                  <span style={{ color: '#81c784' }}>● EMA20</span>
                  <span style={{ color: '#ffb74d' }}>● SMA40</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#ef5350' }}>● EMA5</span>
                  <span style={{ color: '#26a69a' }}>● EMA10</span>
                  <span style={{ color: '#2962FF' }}>● EMA15</span>
                  <span style={{ color: '#ffc107' }}>● EMA20</span>
                </>
              )}
            </div>
          </div>

          {/* Mobile search */}
          <form onSubmit={handleSymbolSearch} className="d-md-none mt-2">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search symbol... (e.g. INFY, TCS)"
              value={searchSymbol}
              onChange={e => setSearchSymbol(e.target.value.toUpperCase())}
              style={{ fontSize: '12px' }}
            />
          </form>
        </div>

        {/* Chart Area */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {loading && (
            <div className="position-absolute top-50 start-50 translate-middle" style={{ zIndex: 2 }}>
              <div className="spinner-border text-primary" role="status"></div>
            </div>
          )}
          {error && <div className="position-absolute top-50 start-50 translate-middle text-muted">{error}</div>}
          <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Mobile indicator legend */}
        <div className="d-md-none border-top px-3 py-1 d-flex justify-content-center gap-3" style={{ fontSize: '10px', background: darkMode ? '#16213e' : '#fafafa' }}>
          {mode === 'equity' ? (
            <>
              <span style={{ color: '#4fc3f7' }}>● EMA10</span>
              <span style={{ color: '#81c784' }}>● EMA20</span>
              <span style={{ color: '#ffb74d' }}>● SMA40</span>
            </>
          ) : (
            <>
              <span style={{ color: '#ef5350' }}>● EMA5</span>
              <span style={{ color: '#26a69a' }}>● EMA10</span>
              <span style={{ color: '#2962FF' }}>● EMA15</span>
              <span style={{ color: '#ffc107' }}>● EMA20</span>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default ChartPage
