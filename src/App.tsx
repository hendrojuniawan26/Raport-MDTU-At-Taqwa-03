import {
  BookCheck,
  Database,
  Eye,
  FileSpreadsheet,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Printer,
  Settings,
  Table2,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DashboardView } from './components/DashboardView';
import { ExcelImportView } from './components/ExcelImportView';
import { LegerView } from './components/LegerView';
import { LoginView } from './components/LoginView';
import { MasterDataView } from './components/MasterDataView';
import { RaportPreviewView } from './components/RaportPreviewView';
import { SettingsAndSupabaseView } from './components/SettingsAndSupabaseView';
import { TopBarStudentSearch } from './components/TopBarStudentSearch';
import { AppProvider, useApp } from './context/AppContext';
import { getAllowedTabs, ROLE_LABELS } from './lib/rbac';
import type { ActiveTab } from './types';

const ALL_NAV_ITEMS: {
  id: ActiveTab;
  label: string;
  parentLabel?: string;
  guruLabel?: string;
  icon: typeof LayoutDashboard;
  parentIcon?: typeof LayoutDashboard;
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    parentLabel: 'Ringkasan Ananda',
    icon: LayoutDashboard,
  },
  {
    id: 'leger',
    label: 'Leger Nilai',
    guruLabel: 'Input Nilai Mapel',
    icon: Table2,
  },
  { id: 'master', label: 'Data Master', icon: Users },
  { id: 'import-export', label: 'Import Excel', icon: FileSpreadsheet },
  {
    id: 'raport',
    label: 'Cetak Raport',
    parentLabel: 'Raport Ananda',
    icon: Printer,
    parentIcon: Eye,
  },
  {
    id: 'settings',
    label: 'Pengaturan',
    parentLabel: 'Akun & Sesi',
    guruLabel: 'Akun & Sesi',
    icon: Settings,
  },
];

function MainShell() {
  const {
    settings,
    userProfile,
    signOut,
    isOnline,
    pendingSavesCount,
    toasts,
    dismissToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [crestError, setCrestError] = useState(false);

  const allowedTabs = useMemo(
    () => getAllowedTabs(userProfile?.role),
    [userProfile?.role]
  );

  const visibleNavItems = useMemo(() => {
    return ALL_NAV_ITEMS.filter((item) => allowedTabs.includes(item.id)).map(
      (item) => {
        let displayLabel = item.label;
        if (userProfile?.role === 'orang_tua' && item.parentLabel) {
          displayLabel = item.parentLabel;
        } else if (userProfile?.role === 'guru' && item.guruLabel) {
          displayLabel = item.guruLabel;
        }
        const displayIcon =
          userProfile?.role === 'orang_tua' && item.parentIcon
            ? item.parentIcon
            : item.icon;
        return { ...item, displayLabel, displayIcon };
      }
    );
  }, [allowedTabs, userProfile?.role]);

  useEffect(() => {
    if (userProfile && !allowedTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [userProfile, allowedTabs, activeTab]);

  const toastOverlay = toasts.length > 0 && (
    <div className="no-print fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border shadow-lg text-xs font-medium ${
            t.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-900'
              : t.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <span>{t.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="text-slate-400 hover:text-slate-700 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );

  if (!userProfile) {
    return (
      <>
        <LoginView />
        {toastOverlay}
      </>
    );
  }

  const activeNav =
    visibleNavItems.find((n) => n.id === activeTab) || visibleNavItems[0];

  const handleNavigate = (tab: ActiveTab) => {
    if (!allowedTabs.includes(tab)) return;
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const roleLabel = ROLE_LABELS[userProfile.role];

  return (
    <div className="min-h-screen flex bg-[#F7F9F8] text-slate-900">
      {/* Sidebar Desktop (256px) */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B2B1F] text-white border-r border-emerald-950">
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white p-0.5 shrink-0 flex items-center justify-center overflow-hidden">
            {!crestError ? (
              <img
                src="/assets/aistudio/Desain_tanpa_judul_20261118_152836_0000_ef69cfc5.png"
                alt="Logo MDTU At-Taqwa '03 Cibeureum"
                referrerPolicy="no-referrer"
                onError={() => setCrestError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <BookCheck className="w-6 h-6 text-emerald-900" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight truncate">
              MDTU At-Taqwa &apos;03
            </div>
            <div className="text-[11px] text-emerald-200/80 truncate">
              Cibeureum · E-Raport
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.displayIcon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-700/80 text-white'
                    : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.displayLabel}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 text-xs space-y-3">
          <div className="space-y-1">
            <div className="font-semibold text-white truncate">
              {userProfile.full_name}
            </div>
            <div className="text-[11px] text-emerald-200/80 truncate">
              {roleLabel}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-200/70 pt-0.5">
              <Database className="w-3 h-3 text-emerald-300 shrink-0" />
              <span className="truncate">Online · Supabase</span>
            </div>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-100 bg-white/10 hover:bg-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#0B2B1F] text-white flex flex-col z-10">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-bold">MDTU At-Taqwa &apos;03</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-emerald-100 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.displayIcon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg ${
                      active
                        ? 'bg-emerald-700/80 text-white'
                        : 'text-emerald-100/80 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.displayLabel}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10 space-y-2 text-xs">
              <div className="font-semibold text-white truncate">
                {userProfile.full_name}
              </div>
              <div className="text-[11px] text-emerald-200/80">
                {roleLabel}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-100 bg-white/10 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar Akun
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract (Non-Print) */}
        <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-8 h-14 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="hidden md:inline font-semibold text-slate-900 truncate">
                {settings.nama_madrasah}
              </span>
              <span
                className="hidden md:inline text-slate-300"
                aria-hidden="true"
              >
                /
              </span>
              <span className="font-medium md:font-normal text-slate-700 md:text-slate-600 truncate">
                {activeNav?.displayLabel || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 sm:gap-3 flex-1 min-w-0">
            {pendingSavesCount > 0 && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Menyimpan ({pendingSavesCount})...
              </span>
            )}
            <TopBarStudentSearch
              activeTab={activeTab}
              onNavigate={handleNavigate}
            />
            <span className="hidden xl:inline text-xs text-slate-500 whitespace-nowrap">
              {userProfile.full_name} · {roleLabel}
            </span>
            <button
              type="button"
              onClick={() => handleNavigate('raport')}
              className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
            >
              {userProfile.role === 'orang_tua'
                ? 'Raport Ananda'
                : 'Cetak Raport'}
            </button>
          </div>
        </header>

        {!isOnline && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-4 sm:px-8 py-2.5 text-xs text-amber-900 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Koneksi internet terputus. Perubahan nilai belum dapat disinkronkan ke Supabase sampai koneksi kembali aktif.
            </span>
          </div>
        )}

        {/* Main Workspace */}
        <main className="flex-1 px-4 sm:px-8 py-6 max-w-[1320px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView onNavigate={handleNavigate} />
          )}
          {activeTab === 'leger' && allowedTabs.includes('leger') && (
            <LegerView />
          )}
          {activeTab === 'master' && allowedTabs.includes('master') && (
            <MasterDataView />
          )}
          {activeTab === 'import-export' &&
            allowedTabs.includes('import-export') && <ExcelImportView />}
          {activeTab === 'raport' && allowedTabs.includes('raport') && (
            <RaportPreviewView />
          )}
          {activeTab === 'settings' && allowedTabs.includes('settings') && (
            <SettingsAndSupabaseView />
          )}
        </main>
      </div>

      {toastOverlay}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}
