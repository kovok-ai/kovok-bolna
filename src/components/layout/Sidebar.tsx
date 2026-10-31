'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileText,
  BadgeDollarSign,
  Package,
  AlertTriangle,
  BookOpen,
  Users,
  Cpu,
  Settings,
  ChevronDown,
  LogOut,
} from 'lucide-react';

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
  quotationCount?: number;
  exceptionCount?: number;
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
  quotationCount,
  exceptionCount,
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
        <ChevronDown size={14} className="workspace-chevron" />
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
              <LayoutDashboard size={16} />
            </span>
            Overview
          </button>
          <button
            className={`nav-btn ${currentPage === 'requests' ? 'active' : ''}`}
            onClick={() => onPageChange('requests')}
          >
            <span className="nav-ico">
              <FileText size={16} />
            </span>
            Requests {requestCount !== undefined && <span className="count">{requestCount}</span>}
          </button>
          <button
            className={`nav-btn ${currentPage === 'quotations' ? 'active' : ''}`}
            onClick={() => onPageChange('quotations')}
          >
            <span className="nav-ico">
              <BadgeDollarSign size={16} />
            </span>
            Quotations {quotationCount !== undefined && <span className="count">{quotationCount}</span>}
          </button>
          <button
            className={`nav-btn ${currentPage === 'orders' ? 'active' : ''}`}
            onClick={() => onPageChange('orders')}
          >
            <span className="nav-ico">
              <Package size={16} />
            </span>
            Orders &amp; delivery
          </button>
          <button
            className={`nav-btn ${currentPage === 'exceptions' ? 'active' : ''}`}
            onClick={() => onPageChange('exceptions')}
          >
            <span className="nav-ico">
              <AlertTriangle size={16} />
            </span>
            Exceptions {exceptionCount !== undefined && <span className="count">{exceptionCount}</span>}
          </button>
        </nav>
      </div>

      {/* Data Navigation */}
      <div>
        <div className="nav-caption">DATA &amp; DISCOVERY</div>
        <nav className="nav">
          <button
            className={`nav-btn ${currentPage === 'catalog' ? 'active' : ''}`}
            onClick={() => onPageChange('catalog')}
          >
            <span className="nav-ico">
              <BookOpen size={16} />
            </span>
            Product catalogue
          </button>
          <button
            className={`nav-btn ${currentPage === 'suppliers' ? 'active' : ''}`}
            onClick={() => onPageChange('suppliers')}
          >
            <span className="nav-ico">
              <Users size={16} />
            </span>
            Suppliers
          </button>
          <button
            className={`nav-btn ${currentPage === 'integrations' ? 'active' : ''}`}
            onClick={() => onPageChange('integrations')}
          >
            <span className="nav-ico">
              <Cpu size={16} />
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
            <Settings size={16} />
          </span>
          Settings &amp; rules
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
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
