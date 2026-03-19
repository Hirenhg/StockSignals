import { useEffect, useRef } from 'react'

const TradingViewModal = ({ symbol, onClose }) => {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `NSE:${symbol}`,
      interval: '5',
      timezone: 'Asia/Kolkata',
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      support_host: 'https://www.tradingview.com'
    })
    containerRef.current.appendChild(script)
  }, [symbol])

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10000 }}>
      <div className="modal-dialog modal-fullscreen">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h6 className="modal-title fw-bold">📊 {symbol} — TradingView</h6>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-0" style={{ height: 'calc(100vh - 56px)' }}>
            <div className="tradingview-widget-container" ref={containerRef} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default TradingViewModal
