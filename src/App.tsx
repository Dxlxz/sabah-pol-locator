import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Navigation, X, ExternalLink, Layers, Camera, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import { stations, type Station } from './data/stations';
import { useIsMobile } from './hooks/use-mobile';
import { ReceiptCapture } from './components/ReceiptCapture';
import { ReceiptHistory } from './components/ReceiptHistory';

// Fuel pump SVG for map markers (white stroke, 18x18 inside 36px circle)
const fuelSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`;

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

// Available basemaps
const basemaps = [
  {
    id: 'streets',
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  {
    id: 'topo',
    name: 'Topo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
  },
] as const;

// Floating basemap switcher control
function BasemapControl({
  activeId,
  onChange,
}: {
  activeId: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors border border-gray-200"
      >
        <Layers className="w-5 h-5 text-gray-700" />
      </button>

      {open && (
        <div className="absolute top-12 right-0 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden min-w-[140px]">
          {basemaps.map((bm) => (
            <button
              key={bm.id}
              onClick={() => { onChange(bm.id); setOpen(false); }}
              className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${activeId === bm.id
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-700 hover:bg-gray-50'
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
      {/* KodLokasi — primary */}
      <h3 className={`font-mono font-black text-gray-900 ${isPopup ? 'text-lg' : 'text-2xl'}`}>
        {station.kodLokasi}
      </h3>

      {/* Station name */}
      <p className={`text-gray-600 mt-0.5 ${isPopup ? 'text-sm' : 'text-sm mt-1'}`}>
        {station.name}
      </p>

      {/* Coordinates */}
      <p className={`font-mono text-gray-400 ${isPopup ? 'text-xs mt-1.5' : 'text-xs mt-2'}`}>
        {station.lat.toFixed(4)}°N, {station.lng.toFixed(4)}°E
      </p>

      {/* Action buttons */}
      <div className={`flex flex-col ${isPopup ? 'gap-1.5 mt-2.5' : 'gap-2 mt-4'}`}>
        {/* KodLokasi map link — primary */}
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

        {/* Google Maps link — secondary */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full bg-gray-100 text-gray-700 font-medium no-underline hover:bg-gray-200 transition-colors ${isPopup ? 'py-2 rounded-lg text-xs' : 'py-3 rounded-xl text-sm'
            }`}
        >
          <Navigation className={isPopup ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          Google Maps
        </a>

        {/* Record Receipt — accent action */}
        {onRecordReceipt && (
          <button
            onClick={onRecordReceipt}
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
}: {
  station: Station;
  isMobile: boolean;
  onSelect: (s: Station) => void;
}) {
  const map = useMap();

  const markerIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="custom-marker" style="background-color: #3b82f6;">
          ${fuelSvg}
        </div>
        <div class="marker-label">${station.kodLokasi}</div>
      `,
      iconSize: [40, 56],
      iconAnchor: [20, 56],
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
          <StationInfo station={station} variant="popup" onRecordReceipt={() => onSelect(station)} />
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
          {/* Backdrop — tap to dismiss */}
          <motion.div
            className="fixed inset-0 z-[1000] bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[1001] bg-white rounded-t-2xl shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-4">
              {/* Close button — top right */}
              <div className="flex justify-end mb-1">
                <button onClick={onClose} className="p-1 -mr-1 -mt-1">
                  <X className="w-5 h-5 text-gray-400" />
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

// Main app — full-screen map with station markers
function App() {
  const isMobile = useIsMobile();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [activeBasemap, setActiveBasemap] = useState('streets');
  const [receiptStation, setReceiptStation] = useState<Station | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const currentBasemap = basemaps.find(b => b.id === activeBasemap) || basemaps[0];

  // When "Record Receipt" is tapped in bottom sheet, it calls onClose which
  // triggers the receipt flow. We need a handler that opens the receipt modal.
  const handleOpenReceipt = (station: Station) => {
    setSelectedStation(null); // close bottom sheet
    setReceiptStation(station);
  };

  return (
    <div className="h-screen w-screen relative">
      {/* History button — top left */}
      <div className="absolute top-4 left-4 z-[1000]">
        <button
          onClick={() => setHistoryOpen(true)}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors border border-gray-200"
          title="Receipt History"
        >
          <History className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      <BasemapControl activeId={activeBasemap} onChange={setActiveBasemap} />

      <MapContainer
        bounds={allStationsBounds}
        style={{ height: '100%', width: '100%' }}
        zoomControl={!isMobile}
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

        {stations.map((station) => (
          <StationMarker
            key={station.id}
            station={station}
            isMobile={isMobile}
            onSelect={isMobile ? setSelectedStation : handleOpenReceipt}
          />
        ))}
      </MapContainer>

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
