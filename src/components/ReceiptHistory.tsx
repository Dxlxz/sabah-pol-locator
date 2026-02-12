import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ExternalLink, ChevronRight, Fuel } from 'lucide-react';
import { getReceiptHistory, clearReceiptHistory, type ReceiptHistoryEntry } from '../lib/receipt-history';

interface ReceiptHistoryProps {
    open: boolean;
    onClose: () => void;
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        Processed: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
        'Review Needed': 'bg-amber-50 text-amber-700 border border-amber-200/60',
        Error: 'bg-red-50 text-red-700 border border-red-200/60',
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600 border border-slate-200/60'}`}>
            {status}
        </span>
    );
}

function HistoryDetail({ entry, onBack }: { entry: ReceiptHistoryEntry; onBack: () => void }) {
    const { response, manualData } = entry;

    return (
        <div className="space-y-4">
            <button onClick={onBack} className="text-xs text-blue-600 font-medium hover:underline">
                &larr; Back to list
            </button>

            <div className="flex items-center justify-between">
                <div>
                    <p className="font-mono font-bold text-slate-900">{entry.kodLokasi}</p>
                    <p className="text-xs text-slate-500">{entry.station}</p>
                </div>
                <StatusBadge status={response.status} />
            </div>

            <div className="text-xs text-slate-400">
                {new Date(entry.timestamp).toLocaleString()}
                {entry.submittedBy !== 'Anonymous' && ` \u2022 ${entry.submittedBy}`}
                {entry.vehicleReg && ` \u2022 ${entry.vehicleReg}`}
            </div>

            {entry.odometerCurrent != null && (
                <div className="flex items-center gap-3 text-xs text-slate-500 bg-slate-50/80 rounded-lg px-3 py-2 border border-slate-100/60">
                    <span className="font-mono font-medium">{entry.odometerCurrent.toLocaleString()} km</span>
                </div>
            )}

            {manualData && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Receipt Data</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {manualData.receiptNo && (
                            <div>
                                <p className="text-xs text-slate-400">Receipt No</p>
                                <p className="font-mono font-medium text-slate-800">{manualData.receiptNo}</p>
                            </div>
                        )}
                        {manualData.fuelType && (
                            <div>
                                <p className="text-xs text-slate-400">Fuel Type</p>
                                <div className="flex items-center gap-1">
                                    <Fuel className="w-3.5 h-3.5 text-slate-500" />
                                    <p className="font-medium text-slate-800">{manualData.fuelType}</p>
                                </div>
                            </div>
                        )}
                        {manualData.litres != null && (
                            <div>
                                <p className="text-xs text-slate-400">Litres</p>
                                <p className="font-medium text-slate-800">{manualData.litres} L</p>
                            </div>
                        )}
                        {manualData.amount != null && (
                            <div>
                                <p className="text-xs text-slate-400">Amount</p>
                                <p className="font-bold text-slate-900">RM {manualData.amount.toFixed(2)}</p>
                            </div>
                        )}
                        {manualData.pricePerLitre != null && (
                            <div>
                                <p className="text-xs text-slate-400">Price/Litre</p>
                                <p className="font-medium text-slate-800">RM {manualData.pricePerLitre.toFixed(2)}</p>
                            </div>
                        )}
                        {manualData.vehicleReg && (
                            <div>
                                <p className="text-xs text-slate-400">Vehicle Reg</p>
                                <p className="font-mono font-medium text-slate-800">{manualData.vehicleReg}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {response.imageUrl && (
                <a
                    href={response.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 border border-blue-200/60
                     rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                >
                    <ExternalLink className="w-4 h-4" />
                    View Receipt Image
                </a>
            )}
        </div>
    );
}

export function ReceiptHistory({ open, onClose }: ReceiptHistoryProps) {
    const [history, setHistory] = useState<ReceiptHistoryEntry[]>(() => getReceiptHistory());
    const [selectedEntry, setSelectedEntry] = useState<ReceiptHistoryEntry | null>(null);

    const handleClear = () => {
        clearReceiptHistory();
        setHistory([]);
        setSelectedEntry(null);
    };

    const refreshHistory = () => {
        setHistory(getReceiptHistory());
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-[1500] bg-black/20 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => { setSelectedEntry(null); onClose(); }}
                    />

                    {/* Panel */}
                    <motion.div
                        className="fixed bottom-0 left-0 right-0 z-[1501] bg-white/95 backdrop-blur-xl rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
                        onAnimationComplete={() => refreshHistory()}
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                            <div className="w-10 h-1 bg-slate-300 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-100 flex-shrink-0">
                            <h2 className="text-lg font-bold text-slate-900">Receipt History</h2>
                            <div className="flex items-center gap-2">
                                {history.length > 0 && !selectedEntry && (
                                    <button
                                        onClick={handleClear}
                                        className="p-2 rounded-full hover:bg-red-50 transition-colors"
                                        title="Clear history"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                )}
                                <button
                                    onClick={() => { setSelectedEntry(null); onClose(); }}
                                    className="p-2 -mr-2 rounded-full hover:bg-slate-100 transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto sidebar-scroll px-5 py-3">
                            {selectedEntry ? (
                                <HistoryDetail entry={selectedEntry} onBack={() => setSelectedEntry(null)} />
                            ) : history.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-sm text-slate-400">No receipts submitted yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {history.map((entry) => (
                                        <button
                                            key={entry.id}
                                            onClick={() => setSelectedEntry(entry)}
                                            className="w-full flex items-center gap-3 p-3 bg-slate-50/80 rounded-xl
                                             hover:bg-slate-100/80 transition-colors text-left border border-slate-100/60"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm font-bold text-slate-800 truncate">
                                                        {entry.kodLokasi}
                                                    </span>
                                                    <StatusBadge status={entry.response.status} />
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5 truncate">
                                                    {entry.station}
                                                    {entry.vehicleReg && <span className="ml-1.5 text-slate-400">&bull; {entry.vehicleReg}</span>}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {entry.manualData?.amount != null && (
                                                        <span className="ml-2 font-medium text-slate-600">
                                                            RM {entry.manualData.amount.toFixed(2)}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
