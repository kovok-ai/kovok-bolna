'use client';

import React from 'react';

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
  isSandbox = true,
  onNewRequest,
  onToggleMenu,
  onSearch,
  onHelp,
}: TopbarProps) {
  return (
    <header className="topbar">
      <button
        className="icon-btn mobile-only"
        onClick={onToggleMenu}
        aria-label="Open navigation"
      >
        ☰
      </button>

      <div className="crumb">
        <span className="crumb-full">{workspaceName} /</span>
        <b>{currentPageTitle}</b>
        {isSandbox && <span className="sample">SAMPLE DATA</span>}
      </div>

      <div className="top-actions">
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input
            id="globalSearch"
            placeholder="Search anything"
            aria-label="Search anything"
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
          title="Help & documentation"
          aria-label="Help"
        >
          ?
        </button>
        <button className="btn btn-primary" onClick={onNewRequest}>
          + New request
        </button>
      </div>
    </header>
  );
}
