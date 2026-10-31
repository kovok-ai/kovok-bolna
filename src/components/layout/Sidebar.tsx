'use client';

import React from 'react';

export type PageId =
  | 'overview'
  | 'requests'
  | 'quotations'
  | 'orders'
  | 'exceptions'
  | 'catalog'
  | 'suppliers'
  | 'integrations'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  workspaceName?: string;
  workspaceSubtitle?: string;
  userName?: string;
  userRole?: string;
  isOpen?: boolean;
  onOpenSetup?: () => void;
  onLogout?: () => void;
  requestCount?: number;
}

export function Sidebar({
  currentPage,
  onPageChange,
  workspaceName = 'Concrete & Co.',
  workspaceSubtitle = 'Delhi NCR · 2 sites',
  userName = 'Shiwang Gupta',
  userRole = 'Workspace admin',
  isOpen = false,
  onOpenSetup,
  onLogout,
  requestCount,
}: SidebarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="mark">k.</div>
        <div>
          <div className="brand-name">
            kovok<span>.</span>
          </div>
          <div className="brand-sub">CONSTRUCTION</div>
        </div>
      </div>

      {/* Workspace Switcher */}
      <button
        className="workspace"
        onClick={onOpenSetup}
        title="Configure workspace rules"
        aria-label="Current workspace"
      >
        <div className="workspace-logo">{getInitials(workspaceName)}</div>
        <div>
          <strong>{workspaceName}</strong>
          <small>{workspaceSubtitle}</small>
        </div>
        <span className="workspace-chevron">⌄</span>
      </button>

      {/* Workspace Navigation */}
      <div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="nav" id="mainNav">
          <button
            className={`nav-btn ${currentPage === 'overview' ? 'active' : ''}`}
            onClick={() => onPageChange('overview')}
          >
            <span className="nav-ico">
              <svg viewBox="0 0 24 24">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
                <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
                <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
                <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
              </svg>
            </span>
            Overview
          </button>
          <button
            className={`nav-btn ${currentPage === 'requests' ? 'active' : ''}`}
            onClick={() => onPageChange('requests')}
          >
            <span className="nav-ico">
              <svg viewBox="0 0 24 24">
                <path d="M8 6h12M8 12h12M8 18h12" />
                <circle cx="4" cy="6" r=".8" />
                <circle cx="4" cy="12" r=".8" />
                <circle cx="4" cy="18" r=".8" />
              </svg>
            </span>
            Requests <span className="count">{requestCount !== undefined ? requestCount : 6}</span>
          </button>
          <button
            className={`nav-btn ${currentPage === 'quotations' ? 'active' : ''}`}
            onClick={() => onPageChange('quotations')}
          >
            <span className="nav-ico">
              <svg viewBox="0 0 24 24">
                <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
              </svg>
            </span>
            Quotations <span className="count">3</span>
          </button>
          <button
            className={`nav-btn ${currentPage === 'orders' ? 'active' : ''}`}
            onClick={() => onPageChange('orders')}
          >
            <span className="nav-ico">
              <svg viewBox="0 0 24 24">
                <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
                <path d="M4.5 7.8 12 12l7.5-4.2M12 12v8.5" />
              </svg>
            </span>
            Orders
          </button>
          <button
            className={`nav-btn ${currentPage === 'exceptions' ? 'active' : ''}`}
            onClick={() => onPageChange('exceptions')}
          >
            <span className="nav-ico">
              <svg viewBox="0 0 24 24">
                <path d="M12 3.5 21 20H3z" />
                <path d="M12 9v5M12 17.2h.01" />
              </svg>
            </span>
            Exceptions <span className="count">2</span>
          </button>
        </nav>
      </div>

      {/* Data Navigation */}
      <div>
        <div className="nav-caption">DATA</div>
        <nav className="nav">
          <button
            className={`nav-btn ${currentPage === 'catalog' ? 'active' : ''}`}
            onClick={() => onPageChange('catalog')}
          >
            <span className="nav-ico">
              <svg viewBox="0 0 24 24">
                <path d="M4 4.5h16v15H4z" />
                <path d="M8 4.5v15M8 9h12M8 14h12" />
              </svg>
            </span>
            Product catalogue
          </button>
          <button
            className={`nav-btn ${currentPage === 'suppliers' ? 'active' : ''}`}
            onClick={() => onPageChange('suppliers')}
          >
            <span className="nav-ico">
              <svg viewBox="0 0 24 24">
                <path d="M3.5 20V8l8.5-4 8.5 4v12z" />
                <path d="M8 20v-5h8v5M8 9.5h.01M12 9.5h.01M16 9.5h.01" />
              </svg>
            </span>
            Suppliers
          </button>
          <button
            className={`nav-btn ${currentPage === 'integrations' ? 'active' : ''}`}
            onClick={() => onPageChange('integrations')}
          >
            <span className="nav-ico">
              <svg viewBox="0 0 24 24">
                <path d="M8 8V4M16 8V4M8 8h8v5a4 4 0 0 1-8 0zM12 17v3" />
              </svg>
            </span>
            Integrations
          </button>
        </nav>
      </div>

      {/* Side Bottom: Settings and Profile */}
      <div className="side-bottom">
        <button
          className={`nav-btn ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => onPageChange('settings')}
        >
          <span className="nav-ico">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path
                d="m19.4 15 .1.1 1.3 1-1.5 2.6-1.6-.7a8 8 0 0 1-1.6.9l-.3 1.7h-3l-.3-1.7a8 8 0 0 1-1.6-.9l-1.6.7-1.5-2.6 1.3-1a7 7 0 0 1 0-1.9l-1.3-1 1.5-2.6 1.6.7a8 8 0 0 1 1.6-.9l.3-1.7h3l.3 1.7a8 8 0 0 1 1.6.9l1.6-.7 1.5 2.6-1.3 1a7 7 0 0 1-.1 1.8z"
                transform="translate(-1 -1) scale(1.08)"
              />
            </svg>
          </span>
          Settings & rules
        </button>

        <div className="profile">
          <div className="avatar">{getInitials(userName)}</div>
          <div>
            <strong>{userName}</strong>
            <small>{userRole}</small>
          </div>
          {onLogout && (
            <button
              className="profile-more"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              ⎋
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
