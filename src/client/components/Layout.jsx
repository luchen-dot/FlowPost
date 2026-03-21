import { NavLink, Outlet, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/topics', icon: '📥', label: 'Topic Hub', sub: '选题中心' },
  { path: '/knowledge', icon: '🧠', label: 'Knowledge', sub: '知识库' },
  { path: '/settings', icon: '⚙️', label: 'Settings', sub: '设置' },
]

export default function Layout() {
  const location = useLocation()
  const inPipeline = location.pathname.startsWith('/pipeline/')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left navigation */}
      <nav
        style={{
          width: 200,
          minWidth: 200,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '24px 20px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
            ✦ FlowPost
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            内容生产流水线
          </div>
        </div>

        {/* Nav links */}
        <div style={{ padding: '8px 0', flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                textDecoration: 'none',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all 0.15s',
                cursor: 'pointer',
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.sub}</div>
                  </div>
                </>
              )}
            </NavLink>
          ))}

          {/* Pipeline indicator (shown when in pipeline) */}
          {inPipeline && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                background: 'var(--bg-card)',
                borderLeft: '3px solid var(--accent)',
              }}
            >
              <span style={{ fontSize: 16 }}>✍️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                  Pipeline
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>创作流水线</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          Phase 1 · MVP
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
        <Outlet />
      </main>
    </div>
  )
}
