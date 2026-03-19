const SkeletonBox = ({ width = '100%', height = '16px', style = {} }) => (
  <div className="skeleton-box" style={{ width, height, borderRadius: '4px', ...style }} />
)

export const SkeletonTable = ({ rows = 8, cols = 10 }) => (
  <div className="d-none d-md-block table-responsive">
    <table className="table" style={{ fontSize: '14px' }}>
      <thead className="table-dark">
        <tr>{Array.from({ length: cols }).map((_, i) => <th key={i}><SkeletonBox height="14px" style={{ background: 'rgba(255,255,255,0.15)' }} /></th>)}</tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}><SkeletonBox height="14px" width={c === 0 ? '80px' : '60px'} /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const SkeletonCards = ({ count = 4 }) => (
  <div className="d-md-none" style={{ paddingBottom: '80px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card mb-3 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between mb-3">
            <div>
              <SkeletonBox width="100px" height="20px" style={{ marginBottom: '8px' }} />
              <SkeletonBox width="70px" height="18px" />
            </div>
            <SkeletonBox width="60px" height="28px" style={{ borderRadius: '12px' }} />
          </div>
          <div className="row g-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div className="col-6" key={j}>
                <SkeletonBox width="50px" height="12px" style={{ marginBottom: '4px' }} />
                <SkeletonBox width="70px" height="16px" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
)

export const SkeletonNewsCards = ({ count = 6 }) => (
  <div style={{ paddingBottom: '80px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card mb-2 shadow-sm">
        <div className="card-body p-3">
          <SkeletonBox width="90%" height="16px" style={{ marginBottom: '6px' }} />
          <SkeletonBox width="60%" height="14px" style={{ marginBottom: '10px' }} />
          <div className="d-flex gap-2 align-items-center">
            <SkeletonBox width="60px" height="20px" style={{ borderRadius: '10px' }} />
            <SkeletonBox width="80px" height="12px" />
            <SkeletonBox width="40px" height="12px" style={{ marginLeft: 'auto' }} />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default SkeletonBox
