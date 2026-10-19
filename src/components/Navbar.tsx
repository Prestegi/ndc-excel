import React from 'react';
import {
  FileSpreadsheet,
  CheckCircle,
  LogIn,
  LogOut,
  Layers,
  Table,
  Settings,
  ShieldCheck,
  User,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'queue' | 'table' | 'export' | 'validation';
  setActiveTab: (tab: 'queue' | 'table' | 'export' | 'validation') => void;
  user: { email: string | null; displayName: string | null; photoURL?: string | null } | null;
  onSignInWithGoogle: () => void;
  onDemoSignIn: () => void;
  onSignOut: () => void;
  recordsCount: number;
  approvedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onSignInWithGoogle,
  onDemoSignIn,
  onSignOut,
  recordsCount,
  approvedCount,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B3C5D] text-white shadow-xs">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900">
                NDC Scanner
              </h1>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                PROD v2.4
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Agent Form OCR, Passport Extraction &amp; Excel Generator
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'queue'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            Upload &amp; Queue
          </button>

          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'table'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Table className="h-4 w-4" />
            Records &amp; Table
            {recordsCount > 0 && (
              <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] text-blue-800">
                {recordsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'export'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel Export
            {approvedCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] text-emerald-800 font-bold">
                {approvedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('validation')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'validation'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Validation Suite
          </button>
        </nav>

        {/* User Auth controls */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800">
                  {user.displayName || user.email?.split('@')[0] || 'Approved Reviewer'}
                </span>
                <span className="text-[10px] text-emerald-700 font-medium flex items-center justify-end gap-1">
                  <CheckCircle className="h-2.5 w-2.5" /> Authenticated
                </span>
              </div>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Avatar"
                  className="h-8 w-8 rounded-full border border-slate-300 object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                  <User className="h-4 w-4" />
                </div>
              )}
              <button
                onClick={onSignOut}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onSignInWithGoogle}
                className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-800 transition"
              >
                <LogIn className="h-3.5 w-3.5" />
                Google Sign In
              </button>
              <button
                onClick={onDemoSignIn}
                className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                title="Instant reviewer session without popup restrictions"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Reviewer Access
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav tabs */}
      <div className="flex md:hidden border-t border-slate-200 bg-slate-50 px-2 py-1 justify-around text-xs">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-3 py-1 font-semibold ${activeTab === 'queue' ? 'text-blue-700' : 'text-slate-600'}`}
        >
          Queue
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`px-3 py-1 font-semibold ${activeTab === 'table' ? 'text-blue-700' : 'text-slate-600'}`}
        >
          Records ({recordsCount})
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-3 py-1 font-semibold ${activeTab === 'export' ? 'text-blue-700' : 'text-slate-600'}`}
        >
          Export ({approvedCount})
        </button>
        <button
          onClick={() => setActiveTab('validation')}
          className={`px-3 py-1 font-semibold ${activeTab === 'validation' ? 'text-blue-700' : 'text-slate-600'}`}
        >
          Tests
        </button>
      </div>
    </header>
  );
};
