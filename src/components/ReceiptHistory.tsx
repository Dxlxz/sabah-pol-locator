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
        Processed: 'bg-green-100 text-green-700',
        'Review Needed': 'bg-amber-100 text-amber-700',
        Error: 'bg-red-100 text-red-700',
    };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
}

function HistoryDetail({ entry, onBack }: { entry: ReceiptHistoryEntry; onBack: () => void }) {
    const { response } = entry;
    const extracted = response.extractedData;

    return (
        <div className="space-y-4">
            <button onClick={onBack} className="text-xs text-blue-600 font-medium hover:underline">
                &larr; Back to list
            </button>

            <div className="flex items-center justify-between">
                <div>
                    <p className="font-mono font-bold text-gray-900">{entry.kodLokasi}</p>
                    <p className="text-xs text-gray-500">{entry.station}</p>
                </div>
                <StatusBadge status={response.status} />
            </div>

            <div className="text-xs text-gray-400">
                {new Date(entry.timestamp).toLocaleString()}
                {entry.submittedBy !== 'Anonymous' && ` \u2022 ${entry.submittedBy}`}
            </div>

            {extracted && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Extracted Data</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {extracted.receiptNo && (
                            <div>
                                <p className="text-xs text-gray-400">Receipt No</p>
                                <p className="font-mono font-medium text-gray-800">{extracted.receiptNo}</p>
                            </div>
                        )}
                        {extracted.fuelType && (
                            <div>
                                <p className="text-xs text-gray-400">Fuel Type</p>
                                <div className="flex items-center gap-1">
                                    <Fuel className="w-3.5 h-3.5 text-gray-500" />
                                    <p className="font-medium text-gray-800">{extracted.fuelType}</p>
                                </div>
                            </div>
                        )}
                        {extracted.litres != null && (
                            <div>
                                <p className="text-xs text-gray-400">Litres</p>
                                <p className="font-medium text-gray-800">{extracted.litres} L</p>
                            </div>
                        )}
                        {extracted.amount != null && (
                            <div>
                                <p className="text-xs text-gray-400">Amount</p>
                                <p className="font-bold text-gray-900">RM {extracted.amount.toFixed(2)}</p>
                            </div>
                        )}
                        {extracted.pricePerLitre != null && (
                            <div>
                                <p className="text-xs text-gray-400">Price/Litre</p>
                                <p className="font-medium text-gray-800">RM {extracted.pricePerLitre.toFixed(2)}</p>
                            </div>
                        )}
                        {extracted.vehicleReg && (
                            <div>
                                <p className="text-xs text-gray-400">Vehicle Reg</p>
                                <p className="font-mono font-medium text-gray-800">{extracted.vehicleReg}</p>
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
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 border border-blue-200
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
                        className="fixed inset-0 z-[1500] bg-black/30 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => { setSelectedEntry(null); onClose(); }}
                    />

                    {/* Panel */}
                    <motion.div
                        className="fixed bottom-0 left-0 right-0 z-[1501] bg-white rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
                        onAnimationComplete={() => refreshHistory()}
                    >
                        {/* Handle bar */}
                        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                            <div className="w-10 h-1 bg-gray-300 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100 flex-shrink-0">
                            <h2 className="text-lg font-bold text-gray-900">Receipt History</h2>
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
                                    className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-5 py-3">
                            {selectedEntry ? (
                                <HistoryDetail entry={selectedEntry} onBack={() => setSelectedEntry(null)} />
                            ) : history.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-sm text-gray-400">No receipts submitted yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {history.map((entry) => (
                                        <button
                                            key={entry.id}
                                            onClick={() => setSelectedEntry(entry)}
                                            className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-xl
                                             hover:bg-gray-100 transition-colors text-left"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-sm font-bold text-gray-800 truncate">
                                                        {entry.kodLokasi}
                                                    </span>
                                                    <StatusBadge status={entry.response.status} />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.station}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {entry.response.extractedData?.amount != null && (
                                                        <span className="ml-2 font-medium text-gray-600">
                                                            RM {entry.response.extractedData.amount.toFixed(2)}
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
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
