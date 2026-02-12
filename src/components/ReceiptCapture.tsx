import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Send, Loader2, CheckCircle, AlertCircle, User, ExternalLink, Fuel, Receipt } from 'lucide-react';
import type { Station } from '../data/stations';
import { submitReceipt, compressImage, type ReceiptResponse } from '../lib/api';
import { addReceiptToHistory } from '../lib/receipt-history';

type SubmitState = 'idle' | 'submitting' | 'success' | 'error' | 'review';

interface ReceiptCaptureProps {
    station: Station;
    onClose: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: string | null | undefined }) {
    if (!confidence) return null;
    const colors = {
        high: 'bg-green-100 text-green-700 border-green-200',
        medium: 'bg-amber-100 text-amber-700 border-amber-200',
        low: 'bg-red-100 text-red-700 border-red-200',
    };
    const colorClass = colors[confidence as keyof typeof colors] || colors.low;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
            {confidence} confidence
        </span>
    );
}

export function ReceiptCapture({ station, onClose }: ReceiptCaptureProps) {
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [submittedBy, setSubmittedBy] = useState('');
    const [submitState, setSubmitState] = useState<SubmitState>('idle');
    const [resultMessage, setResultMessage] = useState('');
    const [receiptResult, setReceiptResult] = useState<ReceiptResponse | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);

        try {
            const base64 = await compressImage(file);
            setImageBase64(base64);
        } catch {
            setImagePreview(null);
            setImageBase64(null);
            setResultMessage('Failed to process image. Try again.');
            setSubmitState('error');
        }
    };

    const handleSubmit = async () => {
        if (!imageBase64) return;

        setSubmitState('submitting');
        setResultMessage('');
        setReceiptResult(null);

        try {
            const result = await submitReceipt({
                image: imageBase64,
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
                submittedBy: submittedBy.trim() || 'Anonymous',
                capturedAt: new Date().toISOString(),
            });

            setReceiptResult(result);

            // Save to local history
            addReceiptToHistory({
                timestamp: new Date().toISOString(),
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
                submittedBy: submittedBy.trim() || 'Anonymous',
                response: result,
            });

            if (result.status === 'Processed') {
                setSubmitState('success');
                setResultMessage(result.message || 'Receipt recorded successfully!');
            } else {
                setSubmitState('review');
                setResultMessage(result.message || 'Submitted for manual review.');
            }
        } catch (err) {
            setSubmitState('error');
            setResultMessage(
                err instanceof Error ? err.message : 'Failed to submit. Check your connection.'
            );
        }
    };

    const handleReset = () => {
        setImagePreview(null);
        setImageBase64(null);
        setSubmitState('idle');
        setResultMessage('');
        setReceiptResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const isDone = submitState === 'success' || submitState === 'review';
    const extracted = receiptResult?.extractedData;

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={isDone ? onClose : undefined}
            />

            {/* Modal */}
            <motion.div
                className="fixed inset-x-3 top-[10%] bottom-auto z-[2001] bg-white rounded-2xl shadow-2xl max-w-md mx-auto overflow-hidden"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Record Receipt</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{station.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Station info badge */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl">
                        <span className="text-xs font-mono font-bold text-blue-700">{station.kodLokasi}</span>
                        <span className="text-xs text-blue-500">&bull;</span>
                        <span className="text-xs text-blue-600 capitalize">{station.region} Zone</span>
                    </div>

                    {/* Camera capture */}
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                            id="receipt-camera"
                        />

                        {!imagePreview ? (
                            <label
                                htmlFor="receipt-camera"
                                className="flex flex-col items-center justify-center gap-3 w-full h-48
                           border-2 border-dashed border-gray-300 rounded-xl
                           cursor-pointer hover:border-blue-400 hover:bg-blue-50/50
                           transition-colors"
                            >
                                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Camera className="w-7 h-7 text-blue-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-gray-700">Take Photo of Receipt</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Tap to open camera</p>
                                </div>
                            </label>
                        ) : (
                            <div className="relative">
                                <img
                                    src={imagePreview}
                                    alt="Receipt preview"
                                    className="w-full max-h-56 object-contain rounded-xl bg-gray-50"
                                />
                                {!isDone && (
                                    <button
                                        onClick={handleReset}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Submitted By */}
                    {!isDone && (
                        <div>
                            <label htmlFor="submitted-by" className="block text-xs font-medium text-gray-600 mb-1.5">
                                Your Name (optional)
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    id="submitted-by"
                                    type="text"
                                    value={submittedBy}
                                    onChange={(e) => setSubmittedBy(e.target.value)}
                                    placeholder="e.g. Ahmad"
                                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl
                             focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                             placeholder:text-gray-300"
                                />
                            </div>
                        </div>
                    )}

                    {/* Result message */}
                    {resultMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${submitState === 'success'
                                    ? 'bg-green-50 text-green-700'
                                    : submitState === 'review'
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-red-50 text-red-700'
                                }`}
                        >
                            {submitState === 'success' ? (
                                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            ) : submitState === 'review' ? (
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            )}
                            <p>{resultMessage}</p>
                        </motion.div>
                    )}

                    {/* Extracted data card */}
                    {isDone && extracted && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="bg-gray-50 rounded-xl p-4 space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-gray-500" />
                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Extracted Data</span>
                                </div>
                                <ConfidenceBadge confidence={extracted.confidence} />
                            </div>

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

                            {/* View receipt image link */}
                            {receiptResult?.imageUrl && (
                                <a
                                    href={receiptResult.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-gray-200
                                     rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View Receipt Image
                                </a>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-gray-100">
                    {isDone ? (
                        <button
                            onClick={onClose}
                            className="w-full py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl
                         hover:bg-gray-200 transition-colors text-sm"
                        >
                            Done
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={!imageBase64 || submitState === 'submitting'}
                            className="w-full py-3 px-4 bg-blue-500 text-white font-medium rounded-xl
                         hover:bg-blue-600 transition-colors text-sm
                         disabled:opacity-40 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
                        >
                            {submitState === 'submitting' ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processing Receipt...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Submit Receipt
                                </>
                            )}
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
