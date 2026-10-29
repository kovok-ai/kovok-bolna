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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
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
    showToast(`Request submitted for ${data.quantity} ${data.unit} ${data.category.toUpperCase()}. Sourcing outreach queued.`);
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
          onNewRequest={() => setIsNewRequestOpen(true)}
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
          onHelp={() => showToast('Kovok Procurement Foundation: Phase 1 active. Multi-tenant database and session auth enabled.')}
        />

        <div className="page">
          {currentPage === 'overview' && (
            <OverviewView
              onNavigate={(page) => setCurrentPage(page as PageId)}
              onOpenRecovery={() => setCurrentPage('exceptions')}
              workspaceSubtitle={initialWorkspace.serviceArea}
            />
          )}

          {currentPage === 'requests' && (
            <RequestsView
              onOpenRequest={(code) => showToast(`Opening request ${code}. Commercial offers ready for review.`)}
              onImport={() => showToast('Importing purchase requests: Phase 5 ERP/CSV integration.')}
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
            />
          )}

          {currentPage === 'suppliers' && <SuppliersView />}

          {currentPage === 'integrations' && <IntegrationsView />}

          {currentPage === 'settings' && (
            <SettingsView onSave={() => showToast('Procurement policy and calling window rules updated.')} />
          )}
        </div>
      </main>

      {/* New Request Modal */}
      <NewRequestModal
        isOpen={isNewRequestOpen}
        onClose={() => setIsNewRequestOpen(false)}
        onSubmit={handleNewRequestSubmit}
      />

      {/* Toast Notification */}
      {toastMessage && <div className="toast">{toastMessage}</div>}
    </div>
  );
}
