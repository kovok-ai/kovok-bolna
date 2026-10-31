'use client';

import React from 'react';
import Image from 'next/image';
import { Menu, Search, HelpCircle, Plus } from 'lucide-react';

interface TopbarProps {
  workspaceName?: string;
  currentPageTitle: string;
  isSandbox?: boolean;
  onNewRequest: () => void;
  onToggleMenu: () => void;
  onSearch?: (query: string) => void;
  onHelp?: () => void;
}

export function Topbar({
  workspaceName = 'Concrete & Co.',
  currentPageTitle,
  isSandbox = false,
  onNewRequest,
  onToggleMenu,
  onSearch,
  onHelp,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="icon-btn mobile-only"
          onClick={onToggleMenu}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center' }}>
          <Image
            src="/images/kovok-logo.png"
            alt="Kovok"
            width={24}
            height={24}
            style={{ width: '24px', height: '24px', objectFit: 'contain' }}
            priority
          />
        </div>
      </div>

      <div className="crumb">
        <span className="crumb-full">{workspaceName} /</span>
        <b>{currentPageTitle}</b>
        {isSandbox && <span className="sample">SANDBOX</span>}
      </div>

      <div className="top-actions">
        <label className="search">
          <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center' }}>
            <Search size={14} />
          </span>
          <input
            id="globalSearch"
            placeholder="Search material, code, PO..."
            aria-label="Search material, code, PO"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSearch) {
                onSearch((e.target as HTMLInputElement).value);
              }
            }}
          />
        </label>
        <button
          className="icon-btn"
          onClick={onHelp}
          title="Procurement documentation and guidelines"
          aria-label="Help"
        >
          <HelpCircle size={16} />
        </button>
        <button className="btn btn-primary" onClick={onNewRequest}>
          <Plus size={14} style={{ marginRight: '4px' }} /> New Request
        </button>
      </div>
    </header>
  );
}
