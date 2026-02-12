import { Search, History, Menu, Fuel } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onHistoryOpen: () => void;
  onSidebarToggle: () => void;
  isMobile: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  onHistoryOpen,
  onSidebarToggle,
  isMobile,
}: HeaderProps) {
  return (
    <header className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm z-[1000] relative">
      <div className="flex items-center h-14 md:h-14 px-4 gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <Fuel className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-none">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              POL Tracker
            </h1>
            {!isMobile && (
              <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                Sabah Fuel Receipt System
              </p>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Desktop search */}
        {!isMobile && (
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search stations..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100/80 border border-slate-200/60 rounded-lg
                         placeholder:text-slate-400 text-slate-700 focus:outline-none focus:ring-2
                         focus:ring-blue-500/20 focus:border-blue-300 transition-all"
            />
          </div>
        )}

        {/* History button */}
        <button
          onClick={onHistoryOpen}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          title="Receipt History"
        >
          <History className="w-[18px] h-[18px] text-slate-600" />
        </button>

        {/* Mobile sidebar toggle */}
        {isMobile && (
          <button
            onClick={onSidebarToggle}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            title="Stations"
          >
            <Menu className="w-[18px] h-[18px] text-slate-600" />
          </button>
        )}
      </div>
    </header>
  );
}
