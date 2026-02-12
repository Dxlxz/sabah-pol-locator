import { useMemo } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { stations, regionColors, type Station } from '../data/stations';

interface SidebarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeRegion: string | null;
  onRegionChange: (region: string | null) => void;
  activeStationId: string | null;
  onStationSelect: (station: Station) => void;
  isMobile: boolean;
  open: boolean;
  onClose: () => void;
}

const regions = Object.keys(regionColors);

export function Sidebar({
  searchQuery,
  onSearchChange,
  activeRegion,
  onRegionChange,
  activeStationId,
  onStationSelect,
  isMobile,
  open,
  onClose,
}: SidebarProps) {
  const filteredStations = useMemo(() => {
    let result = stations;
    if (activeRegion) {
      result = result.filter((s) => s.region === activeRegion);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.kodLokasi.toLowerCase().includes(q)
      );
    }
    return result;
  }, [searchQuery, activeRegion]);

  // Region counts
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stations) {
      counts[s.region] = (counts[s.region] || 0) + 1;
    }
    return counts;
  }, []);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white/90 backdrop-blur-xl">
      {/* Mobile header with close */}
      {isMobile && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Stations</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      )}

      {/* Mobile search (desktop search is in header) */}
      {isMobile && (
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search stations..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg
                         placeholder:text-slate-400 text-slate-700 focus:outline-none focus:ring-2
                         focus:ring-blue-500/20 focus:border-blue-300 transition-all"
            />
          </div>
        </div>
      )}

      {/* Region filter pills */}
      <div className="px-4 py-3 flex gap-1.5 flex-wrap">
        <button
          onClick={() => onRegionChange(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
            activeRegion === null
              ? 'bg-slate-800 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {regions.map((region) => (
          <button
            key={region}
            onClick={() =>
              onRegionChange(activeRegion === region ? null : region)
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              activeRegion === region
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: regionColors[region] }}
            />
            {region[0]}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-b border-slate-100 mx-4" />

      {/* Station list */}
      <div className="flex-1 overflow-y-auto sidebar-scroll px-2 py-2">
        {filteredStations.length === 0 ? (
          <div className="text-center py-10">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No stations found</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredStations.map((station) => (
              <button
                key={station.id}
                onClick={() => {
                  onStationSelect(station);
                  if (isMobile) onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  activeStationId === station.id
                    ? 'bg-blue-50 border border-blue-100'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                {/* Region color dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: regionColors[station.region] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs font-bold text-slate-800 truncate">
                    {station.kodLokasi}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {station.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">
            {filteredStations.length} Station{filteredStations.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {regions.map((r) => (
              <div key={r} className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: regionColors[r] }}
                />
                <span className="text-[10px]">{regionCounts[r] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Desktop: fixed sidebar panel
  if (!isMobile) {
    return (
      <aside className="w-80 flex-shrink-0 border-r border-slate-200/60 h-full">
        {sidebarContent}
      </aside>
    );
  }

  // Mobile: slide-in drawer overlay
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[1100] bg-black/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed top-0 left-0 bottom-0 z-[1101] w-[300px] max-w-[85vw] shadow-2xl"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {sidebarContent}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
