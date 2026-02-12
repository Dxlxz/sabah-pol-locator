import { useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Navigation, X, ExternalLink, Layers, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import { stations, regionColors, type Station } from './data/stations';
import { useIsMobile } from './hooks/use-mobile';
import { ReceiptCapture } from './components/ReceiptCapture';
import { ReceiptHistory } from './components/ReceiptHistory';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

// Fuel pump SVG for map markers (white stroke, 16x16 inside 32px circle)
const fuelSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`;

// Pre-compute bounds for all stations
const allStationsBounds = L.latLngBounds(
  stations.map(s => [s.lat, s.lng])
);

// Fits the map to show all stations on mount
function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, bounds]);
  return null;
}

// Flies map to a specific station
function FlyToStation({ station }: { station: Station | null }) {
  const map = useMap();
  useEffect(() => {
    if (station) {
      map.flyTo([station.lat, station.lng], 14, { duration: 0.8 });
    }
  }, [map, station]);
  return null;
}

// Available basemaps
const basemaps = [
  {
    id: 'light',
    name: 'Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  {
    id: 'dark',
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  },
] as const;

// Compact basemap switcher — bottom right
function BasemapControl({
  activeId,
  onChange,
}: {
  activeId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-6 right-4 z-[1000]">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg flex items-center justify-center
                   hover:bg-white transition-colors border border-slate-200/60"
      >
        <Layers className="w-4 h-4 text-slate-600" />
      </button>

      {open && (
        <div className="absolute bottom-11 right-0 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200/60 overflow-hidden min-w-[120px]">
          {basemaps.map((bm) => (
            <button
              key={bm.id}
              onClick={() => { onChange(bm.id); setOpen(false); }}
              className={`w-full px-3.5 py-2 text-left text-xs font-medium transition-colors ${activeId === bm.id
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              {bm.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Shared station info content used by both popup and bottom sheet
function StationInfo({
  station,
  variant,
  onRecordReceipt,
}: {
  station: Station;
  variant: 'popup' | 'sheet';
  onRecordReceipt?: () => void;
}) {
  const isPopup = variant === 'popup';
  const kodLokasiUrl = `https://map.kodlokasi.my/${station.kodLokasi}`;
  const googleMapsUrl = `https://www.google.com/maps?q=${station.lat},${station.lng}`;

  return (
    <>
      {/* Region badge + KodLokasi */}
      <div className="flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: regionColors[station.region] }}
        />
        <h3 className={`font-mono font-black text-slate-900 ${isPopup ? 'text-lg' : 'text-2xl'}`}>
          {station.kodLokasi}
        </h3>
      </div>

      {/* Station name */}
      <p className={`text-slate-500 mt-0.5 ${isPopup ? 'text-sm' : 'text-sm mt-1'}`}>
        {station.name}
      </p>

      {/* Coordinates */}
      <p className={`font-mono text-slate-400 ${isPopup ? 'text-xs mt-1.5' : 'text-xs mt-2'}`}>
        {station.lat.toFixed(4)}°N, {station.lng.toFixed(4)}°E
      </p>

      {/* Action buttons */}
      <div className={`flex flex-col ${isPopup ? 'gap-1.5 mt-2.5' : 'gap-2 mt-4'}`}>
        <a
          href={kodLokasiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full bg-blue-500 text-white font-medium no-underline hover:bg-blue-600 transition-colors ${isPopup ? 'py-2 rounded-lg text-xs' : 'py-3 rounded-xl text-sm'
            }`}
        >
          <ExternalLink className={isPopup ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          KodLokasi Map
        </a>

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full bg-slate-100 text-slate-700 font-medium no-underline hover:bg-slate-200 transition-colors ${isPopup ? 'py-2 rounded-lg text-xs' : 'py-3 rounded-xl text-sm'
            }`}
        >
          <Navigation className={isPopup ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          Google Maps
        </a>

        {onRecordReceipt && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRecordReceipt();
            }}
            className={`flex items-center justify-center gap-2 w-full bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors ${isPopup ? 'py-2 rounded-lg text-xs' : 'py-3 rounded-xl text-sm'
              }`}
          >
            <Camera className={isPopup ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
            Record Receipt
          </button>
        )}
      </div>
    </>
  );
}

// Renders a single station marker with region-colored fuel icon
function StationMarker({
  station,
  isMobile,
  onSelect,
  onRecordReceipt,
}: {
  station: Station;
  isMobile: boolean;
  onSelect: (s: Station) => void;
  onRecordReceipt: (s: Station) => void;
}) {
  const map = useMap();

  const markerIcon = useMemo(() => {
    const color = regionColors[station.region] || '#6366f1';
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="custom-marker" style="background-color: ${color};">
          ${fuelSvg}
        </div>
        <div class="marker-label">${station.kodLokasi}</div>
      `,
      iconSize: [36, 50],
      iconAnchor: [18, 50],
    });
  }, [station]);

  const handleClick = () => {
    map.flyTo([station.lat, station.lng], 14, { duration: 0.8 });
    onSelect(station);
  };

  return (
    <Marker
      position={[station.lat, station.lng]}
      icon={markerIcon}
      eventHandlers={{ click: handleClick }}
    >
      {!isMobile && (
        <Popup className="station-popup" minWidth={250} maxWidth={300}>
          <StationInfo station={station} variant="popup" onRecordReceipt={() => onRecordReceipt(station)} />
        </Popup>
      )}
    </Marker>
  );
}

// Mobile slide-up panel showing station info
function MobileBottomSheet({
  station,
  onClose,
  onRecordReceipt,
}: {
  station: Station | null;
  onClose: () => void;
  onRecordReceipt: () => void;
}) {
  return (
    <AnimatePresence>
      {station && (
        <>
          <motion.div
            className="fixed inset-0 z-[1000] bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[1001] bg-white rounded-t-2xl shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            <div className="px-5 pb-4">
              <div className="flex justify-end mb-1">
                <button onClick={onClose} className="p-1 -mr-1 -mt-1">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <StationInfo station={station} variant="sheet" onRecordReceipt={onRecordReceipt} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Main app
function App() {
  const isMobile = useIsMobile();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [activeBasemap, setActiveBasemap] = useState('light');
  const [receiptStation, setReceiptStation] = useState<Station | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<Station | null>(null);

  const currentBasemap = basemaps.find(b => b.id === activeBasemap) || basemaps[0];

  const handleOpenReceipt = useCallback((station: Station) => {
    setSelectedStation(null);
    setReceiptStation(station);
  }, []);

  const handleStationSelect = useCallback((station: Station) => {
    setFlyTarget(station);
    setSelectedStation(station);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onHistoryOpen={() => setHistoryOpen(true)}
        onSidebarToggle={() => setSidebarOpen(true)}
        isMobile={isMobile}
      />

      {/* Content: sidebar + map */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeRegion={activeRegion}
          onRegionChange={setActiveRegion}
          activeStationId={selectedStation?.id ?? null}
          onStationSelect={handleStationSelect}
          isMobile={isMobile}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Map */}
        <div className="flex-1 relative">
          <BasemapControl activeId={activeBasemap} onChange={setActiveBasemap} />

          <MapContainer
            bounds={allStationsBounds}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            minZoom={5}
            maxBounds={[[-90, -180], [90, 180]]}
            maxBoundsViscosity={1.0}
          >
            <TileLayer
              key={currentBasemap.id}
              attribution={currentBasemap.attribution}
              url={currentBasemap.url}
              noWrap={true}
            />
            <FitBounds bounds={allStationsBounds} />
            <FlyToStation station={flyTarget} />

            {stations.map((station) => (
              <StationMarker
                key={station.id}
                station={station}
                isMobile={isMobile}
                onSelect={handleStationSelect}
                onRecordReceipt={handleOpenReceipt}
              />
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && (
        <MobileBottomSheet
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          onRecordReceipt={() => {
            if (selectedStation) handleOpenReceipt(selectedStation);
          }}
        />
      )}

      {/* Receipt capture modal */}
      {receiptStation && (
        <ReceiptCapture
          station={receiptStation}
          onClose={() => setReceiptStation(null)}
        />
      )}

      {/* Receipt history panel */}
      <ReceiptHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}

export default App;
