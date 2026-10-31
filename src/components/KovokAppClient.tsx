'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, PageId } from './layout/Sidebar';
import { Topbar } from './layout/Topbar';
import { OverviewView } from './views/OverviewView';
import { RequestsView } from './views/RequestsView';
import { QuotationsView } from './views/QuotationsView';
import { OrdersView } from './views/OrdersView';
import { ExceptionsView } from './views/ExceptionsView';
import { CatalogView } from './views/CatalogView';
import { SuppliersView } from './views/SuppliersView';
import { IntegrationsView } from './views/IntegrationsView';
import { SettingsView } from './views/SettingsView';
import { NewRequestModal } from './modals/NewRequestModal';

interface KovokAppClientProps {
  initialWorkspace: {
    id: string;
    name: string;
    slug: string;
    serviceArea: string;
    isSandbox: boolean;
  };
  initialUser: {
    id: string;
    email: string;
    name: string;
  };
  initialRole: string | null;
}

export function KovokAppClient({
  initialWorkspace,
  initialUser,
  initialRole,
}: KovokAppClientProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [selectedRequestCode, setSelectedRequestCode] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [newRequestDefaults, setNewRequestDefaults] = useState<{
    category: 'tmt_rebar' | 'cement';
    grade?: string;
    diameter?: string;
  } | null>(null);
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3400);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  const handleNewRequestSubmit = (data: any) => {
    setRequestsRefreshKey((k) => k + 1);
    const code = data?.requestCode ? `[${data.requestCode}] ` : '';
    const qty = data?.quantityValue ?? data?.quantity ?? '';
    const unit = data?.quantityUnit ?? data?.unit ?? '';
    const cat = (data?.category ?? '').toUpperCase();
    if (data?.requestCode) {
      setSelectedRequestCode(data.requestCode);
    }
    showToast(`Request ${code}created: ${qty} ${unit} ${cat}. Sourcing outreach queued.`);
    setCurrentPage('requests');
  };

  const pageTitles: Record<PageId, string> = {
    overview: 'Overview',
    requests: 'Requests',
    quotations: 'Quotations',
    orders: 'Orders & delivery',
    exceptions: 'Exceptions',
    catalog: 'Product catalogue',
    suppliers: 'Suppliers',
    integrations: 'Integrations',
    settings: 'Settings & rules',
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onPageChange={(page) => {
          setCurrentPage(page);
          setIsSidebarOpen(false);
        }}
        workspaceName={initialWorkspace.name}
        workspaceSubtitle={initialWorkspace.serviceArea}
        userName={initialUser.name}
        userRole={initialRole ?? 'Team Member'}
        isOpen={isSidebarOpen}
        onOpenSetup={() => setCurrentPage('settings')}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="main">
        <Topbar
          workspaceName={initialWorkspace.name}
          currentPageTitle={pageTitles[currentPage]}
          isSandbox={initialWorkspace.isSandbox}
          onNewRequest={() => {
            setNewRequestDefaults(null);
            setIsNewRequestOpen(true);
          }}
          onToggleMenu={() => setIsSidebarOpen(!isSidebarOpen)}
          onSearch={(q) => {
            const query = q.toLowerCase();
            if (query.includes('quote')) setCurrentPage('quotations');
            else if (query.includes('supplier')) setCurrentPage('suppliers');
            else if (query.includes('order')) setCurrentPage('orders');
            else if (query.includes('catalog') || query.includes('steel') || query.includes('cement')) setCurrentPage('catalog');
            else setCurrentPage('requests');
            showToast(`Filtering for “${q}”…`);
          }}
          onHelp={() => showToast('Kovok Procurement Foundation: Phase 1 & 2 active. Real PostgreSQL, canonical catalogue, and procurement intake enabled.')}
        />

        <div className="page">
          {currentPage === 'overview' && (
            <OverviewView
              onNavigate={(page) => setCurrentPage(page as PageId)}
              onOpenNewRequest={(params) => {
                setNewRequestDefaults(params || null);
                setIsNewRequestOpen(true);
              }}
              onOpenRequest={(code) => {
                setSelectedRequestCode(code);
                setCurrentPage('requests');
              }}
              workspaceSubtitle={initialWorkspace.serviceArea}
            />
          )}

          {currentPage === 'requests' && (
            <RequestsView
              initialSelectedCode={selectedRequestCode}
              refreshTrigger={requestsRefreshKey}
              onNewRequest={() => {
                setNewRequestDefaults(null);
                setIsNewRequestOpen(true);
              }}
              onOpenRequest={(code) => {
                setSelectedRequestCode(code);
                showToast(`Opening request ${code}. Commercial offers ready for review.`);
              }}
            />
          )}

          {currentPage === 'quotations' && (
            <QuotationsView
              onApproveQuote={(id) => showToast(`Quotation ${id} selected. Versioned buyer approval required.`)}
              onClarifyQuote={(supplier) => showToast(`Clarification requested from ${supplier} for missing freight terms.`)}
            />
          )}

          {currentPage === 'orders' && (
            <OrdersView
              onExport={() => showToast('Exporting purchase orders data...')}
              onOpenOrder={(po) => showToast(`Opening order ${po}...`)}
            />
          )}

          {currentPage === 'exceptions' && (
            <ExceptionsView
              onReviewRecovery={(ex) => showToast(`Reviewing exception ${ex}...`)}
            />
          )}

          {currentPage === 'catalog' && (
            <CatalogView
              onAddProduct={() => showToast('Proposing new provisional product for review.')}
              onImport={() => showToast('Importing product catalogue list...')}
              onInitiateRequest={(params) => {
                setNewRequestDefaults(params);
                setIsNewRequestOpen(true);
              }}
            />
          )}

          {currentPage === 'suppliers' && (
            <SuppliersView
              onInitiateProcurement={(params) => {
                setNewRequestDefaults(params || null);
                setIsNewRequestOpen(true);
              }}
            />
          )}

          {currentPage === 'integrations' && <IntegrationsView />}

          {currentPage === 'settings' && (
            <SettingsView onSave={() => showToast('Procurement policy and calling window rules updated.')} />
          )}
        </div>
      </main>

      {/* New Request Modal */}
      <NewRequestModal
        isOpen={isNewRequestOpen}
        onClose={() => {
          setIsNewRequestOpen(false);
          setNewRequestDefaults(null);
        }}
        onSubmit={handleNewRequestSubmit}
        initialCategory={newRequestDefaults?.category}
        initialGrade={newRequestDefaults?.grade}
        initialDiameter={newRequestDefaults?.diameter}
      />

      {/* Toast Notification */}
      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
}
