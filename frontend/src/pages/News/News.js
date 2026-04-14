import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import API from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import { SkeletonNewsCards } from "../../components/Skeleton/Skeleton";

const newsCache = { data: null, time: 0 };

const News = () => {
  const { t } = useLanguage();
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStock, setSelectedStock] = useState('all');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const fetchNews = useCallback(async (showRefreshToast = false) => {
    if (!showRefreshToast && newsCache.data && Date.now() - newsCache.time < 300000) {
      setNewsData(newsCache.data);
      setLoading(false);
      return;
    }
    if (showRefreshToast) setRefreshing(true);
    try {
      const res = await API.get('/api/news');
      setNewsData(res.data);
      newsCache.data = res.data;
      newsCache.time = Date.now();
      if (showRefreshToast) showToast(t('dataRefreshed'), 'success');
    } catch {
      if (showRefreshToast) showToast(t('refreshFailed'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const stocks = ['all', ...newsData.map(s => s.symbol)];

  const filteredNews = selectedStock === 'all'
    ? newsData.flatMap(s => s.news.map(n => ({ ...n, symbol: s.symbol }))).sort((a, b) => new Date(b.time) - new Date(a.time))
    : (newsData.find(s => s.symbol === selectedStock)?.news || []).map(n => ({ ...n, symbol: selectedStock }));

  const timeAgo = (time) => {
    if (!time) return '';
    const diff = Date.now() - new Date(time).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) {
    return (
      <>
        <Helmet><title>{t('news')} - TradingSignals</title></Helmet>
        <div>
         <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          <h4 className="mb-0 fw-bold me-auto">{t('news')}</h4>
          <button className="btn btn-sm btn-outline-primary" onClick={() => fetchNews(true)} disabled={refreshing}>
            {refreshing ? t('refreshing') : t('refresh')}
          </button>
        </div>
          {/* Desktop stock filter */}
          <div className="d-none d-md-flex gap-2 mb-3 overflow-auto" style={{scrollbarWidth: 'none'}}>
            {stocks.map(s => (
              <button key={s} className={`btn btn-sm flex-shrink-0 ${selectedStock === s ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setSelectedStock(s)} style={{fontSize: '13px', padding: '6px 14px', whiteSpace: 'nowrap'}}>
                {s === 'all' ? t('all') : s === 'MARKET' ? '📈 Market' : s}
              </button>
            ))}
          </div>

          {/* Mobile bottom bar */}
          <div className="d-md-none position-fixed bottom-0 start-0 end-0 bg-white border-top shadow-lg bottom-nav" style={{zIndex: 1000}}>
            <div className="d-flex overflow-auto" style={{scrollbarWidth: 'none'}}>
              {stocks.map(s => (
                <button key={s} className={`btn flex-shrink-0 rounded-0 border-0 py-3 ${selectedStock === s ? 'btn-primary' : 'btn-light'}`} onClick={() => setSelectedStock(s)} style={{fontSize: '13px', fontWeight: '600', minWidth: 'fit-content', padding: '12px 16px'}}>
                  {s === 'all' ? t('all') : s === 'MARKET' ? '📈 Market' : s}
                </button>
              ))}
            </div>
          </div>

          <SkeletonNewsCards count={6} />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>{t('news')} - TradingSignals</title></Helmet>
      <div>
        {toast.show && (
          <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 9999 }}>
            <div className={`alert alert-${toast.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`} role="alert">
              {toast.message}
              <button type="button" className="btn-close" onClick={() => setToast({ show: false, message: '', type: '' })}></button>
            </div>
          </div>
        )}

        <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          <h4 className="mb-0 fw-bold me-auto">{t('news')}</h4>
          <button className="btn btn-sm btn-outline-primary" onClick={() => fetchNews(true)} disabled={refreshing}>
            {refreshing ? t('refreshing') : t('refresh')}
          </button>
        </div>

        {/* Desktop stock filter */}
        <div className="d-none d-md-flex gap-2 mb-3 overflow-auto" style={{scrollbarWidth: 'none'}}>
          {stocks.map(s => (
            <button key={s} className={`btn btn-sm flex-shrink-0 ${selectedStock === s ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setSelectedStock(s)} style={{fontSize: '13px', padding: '6px 14px', whiteSpace: 'nowrap'}}>
              {s === 'all' ? t('all') : s === 'MARKET' ? '📈 Market' : s}
            </button>
          ))}
        </div>

        {/* Mobile bottom bar */}
        <div className="d-md-none position-fixed bottom-0 start-0 end-0 bg-white border-top shadow-lg bottom-nav" style={{zIndex: 1000}}>
          <div className="d-flex overflow-auto" style={{scrollbarWidth: 'none'}}>
            {stocks.map(s => (
              <button key={s} className={`btn flex-shrink-0 rounded-0 border-0 py-3 ${selectedStock === s ? 'btn-primary' : 'btn-light'}`} onClick={() => setSelectedStock(s)} style={{fontSize: '13px', fontWeight: '600', minWidth: 'fit-content', padding: '12px 16px'}}>
                {s === 'all' ? t('all') : s === 'MARKET' ? '📈 Market' : s}
              </button>
            ))}
          </div>
        </div>

        {filteredNews.length === 0 ? (
          <div className="text-center text-muted py-5">{t('noNews')}</div>
        ) : (
          <div className="d-md-none" style={{paddingBottom: '80px'}}>
            {filteredNews.map((item, idx) => (
              <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                <div className="card mb-2 shadow-sm">
                  <div className="card-body p-3">
                    <div className="fw-bold" style={{fontSize: '14px', lineHeight: '1.3'}}>{item.title}</div>
                    <div className="d-flex gap-2 mt-2 align-items-center" style={{fontSize: '12px'}}>
                      <span className={`badge ${item.symbol === 'MARKET' ? 'bg-gray-100 text-primary' : 'bg-primary'}`}>{item.symbol === 'MARKET' ? '📈 Market' : item.symbol}</span>
                      <span className="text-muted">{item.publisher}</span>
                      <span className="text-muted ms-auto">{timeAgo(item.time)}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Desktop */}
        <div className="d-none d-md-block">
          {filteredNews.map((item, idx) => (
            <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
              <div className="card mb-2 shadow-sm" style={{transition: 'transform 0.15s'}} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div className="card-body p-3">
                  <div className="fw-bold" style={{fontSize: '15px'}}>{item.title}</div>
                  <div className="d-flex gap-2 mt-2 align-items-center" style={{fontSize: '13px'}}>
                    <span className={`badge ${item.symbol === 'MARKET' ? 'bg-gray-100 text-primary' : 'bg-primary'}`}>{item.symbol === 'MARKET' ? '📈 Market' : item.symbol}</span>
                    <span className="text-muted">{item.publisher}</span>
                    <span className="text-muted ms-auto">{timeAgo(item.time)}</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  );
};

export default News;
