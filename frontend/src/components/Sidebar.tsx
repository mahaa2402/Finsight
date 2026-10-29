// frontend/src/components/Sidebar.tsx
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  section?: string;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '🏠', section: 'main' },
  { to: '/transactions', label: 'Transactions', icon: '💳', section: 'main' },
  { to: '/budgets', label: 'Budgets', icon: '🎯', section: 'main' },
  { to: '/upload', label: 'Upload Data', icon: '📤', section: 'main' },
  { to: '/analytics', label: 'Analytics', icon: '📊', section: 'main' },
  { to: '/forecast', label: 'Forecast', icon: '🔮', section: 'main' },
  { to: '/anomalies', label: 'Anomalies', icon: '🚨', section: 'main' },
  { to: '/insights', label: 'Insights', icon: '💡', section: 'main' },
  { to: '/settings', label: 'Settings', icon: '⚙️', section: 'bottom' },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
    navigate('/login');
  };

  const mainItems = navItems.filter(i => i.section === 'main');
  const bottomItems = navItems.filter(i => i.section === 'bottom');

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span className="text-white font-bold text-sm">FI</span>
        </div>
        {!collapsed && (
          <span className="text-xl font-bold text-white tracking-tight whitespace-nowrap">
            Fin<span className="text-gradient">Sight</span> IQ
          </span>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">
          {!collapsed && 'MENU'}
        </div>
        <ul className="sidebar-nav-list">
          {mainItems.map(item => (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`sidebar-nav-item ${isActive(item.to) ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                {isActive(item.to) && <div className="sidebar-active-indicator" />}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Navigation & User Profile */}
      <div className="sidebar-bottom">
        <div className="sidebar-divider" />

        {/* User Mini Profile Card */}
        {user && !collapsed && (
          <div className="mx-2 mb-3 p-2.5 rounded-xl bg-surface-800/60 border border-surface-700/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600/30 border border-primary-500/40 flex items-center justify-center text-primary-300 font-bold text-xs">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-surface-400 truncate">{user.email}</p>
            </div>
          </div>
        )}

        <ul className="sidebar-nav-list">
          {bottomItems.map(item => (
            <li key={item.to}>
              <Link
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`sidebar-nav-item ${isActive(item.to) ? 'active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
              </Link>
            </li>
          ))}
          <li>
            <button
              onClick={handleLogout}
              className="sidebar-nav-item w-full text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              title={collapsed ? 'Logout' : undefined}
            >
              <span className="sidebar-nav-icon">🚪</span>
              {!collapsed && <span className="sidebar-nav-label font-medium">Logout</span>}
            </button>
          </li>
        </ul>
      </div>

      {/* Collapse Toggle (desktop only) */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="sidebar-collapse-btn hidden lg:flex"
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        <span style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
          «
        </span>
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sidebar-mobile-header lg:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sidebar-hamburger"
          aria-label="Toggle menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
        <div className="flex items-center gap-2">
          <div className="sidebar-logo-icon" style={{ width: '32px', height: '32px' }}>
            <span className="text-white font-bold text-xs">FI</span>
          </div>
          <span className="text-lg font-bold text-white">
            Fin<span className="text-gradient">Sight</span> IQ
          </span>
        </div>
        <div style={{ width: '40px' }} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
