import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera, X, Loader2, CheckCircle, AlertCircle, User, ExternalLink,
    Search, ChevronDown, RotateCcw, Save, Gauge,
} from 'lucide-react';
import type { Station } from '../data/stations';
import {
    scanReceipt, confirmReceipt, compressImage,
    type ReceiptResponse,
} from '../lib/api';
import {
    addReceiptToHistory, getReceiptHistory,
    getLastOdometerForVehicle, getAverageDistanceForVehicle,
} from '../lib/receipt-history';

type Phase = 'idle' | 'scanning' | 'reviewing' | 'confirming' | 'success' | 'error' | 'rejected';

interface ReceiptCaptureProps {
    station: Station;
    onClose: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: string | null | undefined }) {
    if (!confidence) return null;
    const colors: Record<string, string> = {
        high: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
        medium: 'bg-amber-50 text-amber-700 border-amber-200/60',
        low: 'bg-red-50 text-red-700 border-red-200/60',
        invalid: 'bg-red-50 text-red-700 border-red-200/60',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[confidence] || colors.low}`}>
            {confidence}
        </span>
    );
}

export function ReceiptCapture({ station, onClose }: ReceiptCaptureProps) {
    // --- Image state ---
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const submitInFlight = useRef(false);

    // --- Capture form state ---
    const [vehicleReg, setVehicleReg] = useState('');
    const [odometerCurrent, setOdometerCurrent] = useState('');
    const [odometerPrevious, setOdometerPrevious] = useState('');
    const [submittedBy, setSubmittedBy] = useState('');

    // --- Phase & result state ---
    const [phase, setPhase] = useState<Phase>('idle');
    const [resultMessage, setResultMessage] = useState('');
    const [receiptResult, setReceiptResult] = useState<ReceiptResponse | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState(false);

    // --- Review form state (editable OCR fields) ---
    const [editReceiptNo, setEditReceiptNo] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editFuelType, setEditFuelType] = useState('');
    const [editLitres, setEditLitres] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editPricePerLitre, setEditPricePerLitre] = useState('');
    const [editVehicleReg, setEditVehicleReg] = useState('');
    const [ocrRawText, setOcrRawText] = useState('');
    const [ocrConfidence, setOcrConfidence] = useState('');

    // --- Auto-fill previous odometer when vehicle reg changes ---
    useEffect(() => {
        if (vehicleReg.trim().length >= 3) {
            const prev = getLastOdometerForVehicle(vehicleReg);
            if (prev != null) {
                setOdometerPrevious(String(prev));
            }
        }
    }, [vehicleReg]);

    // --- Calculations ---
    const odomCurrent = parseFloat(odometerCurrent) || null;
    const odomPrevious = parseFloat(odometerPrevious) || null;
    const litresNum = parseFloat(editLitres) || null;
    const amountNum = parseFloat(editAmount) || null;

    const distance = odomCurrent != null && odomPrevious != null && odomCurrent > odomPrevious
        ? odomCurrent - odomPrevious
        : null;

    const fuelEfficiency = distance != null && litresNum != null && litresNum > 0
        ? distance / litresNum
        : null;

    const avgDistance = useMemo(() => {
        if (vehicleReg.trim().length < 3) return null;
        return getAverageDistanceForVehicle(vehicleReg);
    }, [vehicleReg]);

    const expectedNext = odomCurrent != null && avgDistance != null
        ? odomCurrent + avgDistance
        : null;

    // --- Can scan? ---
    const canScan = imageBase64 != null && vehicleReg.trim().length > 0 && odometerCurrent.trim().length > 0;

    // --- Can confirm? ---
    const canConfirm = amountNum != null && amountNum > 0 && litresNum != null && litresNum > 0;

    // --- Handlers ---
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
            setPhase('error');
        }
    };

    const handleScan = async () => {
        if (!imageBase64 || submitInFlight.current) return;
        submitInFlight.current = true;
        setPhase('scanning');
        setResultMessage('');
        setReceiptResult(null);

        try {
            const result = await scanReceipt({
                mode: 'scan',
                image: imageBase64,
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
                vehicleReg: vehicleReg.trim(),
                submittedBy: submittedBy.trim() || 'Anonymous',
                capturedAt: new Date().toISOString(),
            });

            setReceiptResult(result);

            if (result.status === 'Rejected') {
                setPhase('rejected');
                setResultMessage(result.message || 'This does not appear to be a fuel receipt.');
                return;
            }

            // Populate review form from OCR results
            const ext = result.extractedData;
            if (ext) {
                setEditReceiptNo(ext.receiptNo || '');
                setEditDate(ext.dateOnReceipt || '');
                setEditFuelType(ext.fuelType || '');
                setEditLitres(ext.litres != null ? String(ext.litres) : '');
                setEditAmount(ext.amount != null ? String(ext.amount) : '');
                setEditPricePerLitre(ext.pricePerLitre != null ? String(ext.pricePerLitre) : '');
                setEditVehicleReg(ext.vehicleReg || vehicleReg.trim());
                setOcrRawText(ext.rawText || '');
                setOcrConfidence(ext.confidence || 'medium');
            } else {
                setEditVehicleReg(vehicleReg.trim());
                setOcrConfidence('low');
            }

            setPhase('reviewing');
        } catch (err) {
            setPhase('error');
            setResultMessage(err instanceof Error ? err.message : 'Failed to scan receipt.');
        } finally {
            submitInFlight.current = false;
        }
    };

    const handleConfirm = async (bypassDuplicateCheck = false) => {
        if (!imageBase64 || submitInFlight.current) return;

        // Duplicate check
        if (!bypassDuplicateCheck) {
            const recentDuplicate = getReceiptHistory().find(entry =>
                entry.kodLokasi === station.kodLokasi &&
                entry.response.status === 'Processed' &&
                Date.now() - new Date(entry.timestamp).getTime() < 5 * 60 * 1000
            );
            if (recentDuplicate) {
                setDuplicateWarning(true);
                return;
            }
        }

        setDuplicateWarning(false);
        submitInFlight.current = true;
        setPhase('confirming');
        setResultMessage('');

        try {
            const result = await confirmReceipt({
                mode: 'confirm',
                image: imageBase64,
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
                submittedBy: submittedBy.trim() || 'Anonymous',
                capturedAt: new Date().toISOString(),
                confirmedData: {
                    receiptNo: editReceiptNo.trim() || null,
                    dateOnReceipt: editDate.trim() || null,
                    fuelType: editFuelType.trim() || null,
                    litres: litresNum,
                    amount: amountNum,
                    pricePerLitre: parseFloat(editPricePerLitre) || null,
                    vehicleReg: editVehicleReg.trim() || vehicleReg.trim(),
                    odometerCurrent: odomCurrent!,
                    odometerPrevious: odomPrevious,
                    distance,
                    fuelEfficiency: fuelEfficiency != null ? Math.round(fuelEfficiency * 100) / 100 : null,
                },
                ocrConfidence,
                rawText: ocrRawText,
            });

            setReceiptResult(result);

            // Save to local history
            addReceiptToHistory({
                timestamp: new Date().toISOString(),
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
                submittedBy: submittedBy.trim() || 'Anonymous',
                vehicleReg: editVehicleReg.trim() || vehicleReg.trim(),
                odometerCurrent: odomCurrent,
                response: result,
            });

            setPhase('success');
            setResultMessage(result.message || 'Receipt recorded successfully!');
        } catch (err) {
            setPhase('error');
            setResultMessage(err instanceof Error ? err.message : 'Failed to save receipt.');
        } finally {
            submitInFlight.current = false;
        }
    };

    const handleRescan = () => {
        // Go back to idle but keep vehicle reg + odometer
        setImagePreview(null);
        setImageBase64(null);
        setPhase('idle');
        setResultMessage('');
        setReceiptResult(null);
        setDuplicateWarning(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- Render helpers ---
    const isReviewing = phase === 'reviewing';
    const isSuccess = phase === 'success';
    const isCapture = phase === 'idle' || phase === 'error';

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                className="fixed inset-0 z-[2000] bg-black/30 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={isSuccess ? onClose : undefined}
            />

            {/* Modal */}
            <motion.div
                className="fixed inset-x-3 top-[5%] bottom-auto z-[2001] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md mx-auto overflow-hidden"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">
                            {isReviewing ? 'Review Receipt' : isSuccess ? 'Receipt Saved' : 'Record Receipt'}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {station.kodLokasi} &bull; {station.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto sidebar-scroll">

                    {/* ============== CAPTURE PHASE ============== */}
                    {isCapture && (
                        <>
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
                                        className="flex flex-col items-center justify-center gap-2 w-full h-36
                                            border-2 border-dashed border-slate-200 rounded-xl
                                            cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                            <Camera className="w-6 h-6 text-blue-500" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-slate-700">Take Photo of Receipt</p>
                                            <p className="text-xs text-slate-400">Tap to open camera</p>
                                        </div>
                                    </label>
                                ) : (
                                    <div className="relative">
                                        <img
                                            src={imagePreview}
                                            alt="Receipt preview"
                                            className="w-full max-h-40 object-contain rounded-xl bg-slate-50"
                                        />
                                        <button
                                            onClick={handleRescan}
                                            className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Vehicle Reg */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    Vehicle Registration <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={vehicleReg}
                                    onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                                    placeholder="e.g. SAB 1234"
                                    className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl
                                        focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300
                                        placeholder:text-slate-300 transition-all"
                                />
                            </div>

                            {/* Odometer Current */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    Current Odometer (km) <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={odometerCurrent}
                                        onChange={(e) => setOdometerCurrent(e.target.value)}
                                        placeholder="e.g. 45230"
                                        className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300
                                            placeholder:text-slate-300 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Odometer Previous */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    Previous Odometer (km)
                                    {odomPrevious != null && (
                                        <span className="text-slate-400 font-normal ml-1">auto-filled</span>
                                    )}
                                </label>
                                <div className="relative">
                                    <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={odometerPrevious}
                                        onChange={(e) => setOdometerPrevious(e.target.value)}
                                        placeholder="From last refuel"
                                        className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-slate-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300
                                            placeholder:text-slate-300 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Submitted By */}
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    Your Name <span className="text-slate-400 font-normal">(optional)</span>
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={submittedBy}
                                        onChange={(e) => setSubmittedBy(e.target.value)}
                                        placeholder="e.g. Ahmad"
                                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300
                                            placeholder:text-slate-300 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Error message */}
                            {phase === 'error' && resultMessage && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-start gap-2.5 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200/60"
                                >
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <p>{resultMessage}</p>
                                </motion.div>
                            )}
                        </>
                    )}

                    {/* ============== SCANNING PHASE ============== */}
                    {phase === 'scanning' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                            <div className="text-center">
                                <p className="text-sm font-medium text-slate-700">Analyzing receipt...</p>
                                <p className="text-xs text-slate-400 mt-1">AI is extracting data from your photo</p>
                            </div>
                        </div>
                    )}

                    {/* ============== REJECTED PHASE ============== */}
                    {phase === 'rejected' && (
                        <div className="space-y-4">
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-start gap-2.5 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200/60"
                            >
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>{resultMessage}</p>
                            </motion.div>
                            {imagePreview && (
                                <img src={imagePreview} alt="Rejected" className="w-full max-h-32 object-contain rounded-xl bg-slate-50 opacity-50" />
                            )}
                        </div>
                    )}

                    {/* ============== REVIEW PHASE ============== */}
                    {isReviewing && (
                        <>
                            {/* Image thumbnail */}
                            {imagePreview && (
                                <img src={imagePreview} alt="Receipt" className="w-full max-h-28 object-contain rounded-xl bg-slate-50" />
                            )}

                            {/* Editable OCR fields */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Receipt Data</span>
                                    <ConfidenceBadge confidence={ocrConfidence} />
                                </div>

                                {/* Receipt No */}
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Receipt No</label>
                                    <input
                                        type="text"
                                        value={editReceiptNo}
                                        onChange={(e) => setEditReceiptNo(e.target.value)}
                                        placeholder="—"
                                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                                    />
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Date on Receipt</label>
                                    <input
                                        type="date"
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                                    />
                                </div>

                                {/* Fuel Type dropdown */}
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Fuel Type</label>
                                    <div className="relative">
                                        <select
                                            value={editFuelType}
                                            onChange={(e) => setEditFuelType(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg appearance-none bg-white
                                                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                                        >
                                            <option value="">Select...</option>
                                            <option value="Petrol">Petrol</option>
                                            <option value="Diesel">Diesel</option>
                                            <option value="Other">Other</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Litres + Amount row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">
                                            Litres <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            value={editLitres}
                                            onChange={(e) => setEditLitres(e.target.value)}
                                            placeholder="0.00"
                                            className={`w-full px-3 py-2 text-sm font-mono border rounded-lg
                                                focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all
                                                ${!editLitres.trim() ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-blue-300'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">
                                            Amount (RM) <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            placeholder="0.00"
                                            className={`w-full px-3 py-2 text-sm font-mono border rounded-lg
                                                focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all
                                                ${!editAmount.trim() ? 'border-red-300 focus:border-red-400' : 'border-slate-200 focus:border-blue-300'}`}
                                        />
                                    </div>
                                </div>

                                {/* Price/Litre */}
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Price per Litre (RM)</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        step="0.01"
                                        value={editPricePerLitre}
                                        onChange={(e) => setEditPricePerLitre(e.target.value)}
                                        placeholder="—"
                                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                                    />
                                </div>

                                {/* Vehicle Reg */}
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Vehicle Reg</label>
                                    <input
                                        type="text"
                                        value={editVehicleReg}
                                        onChange={(e) => setEditVehicleReg(e.target.value.toUpperCase())}
                                        className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Odometer summary */}
                            <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <Gauge className="w-4 h-4 text-slate-500" />
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Odometer</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-xs text-slate-400">Previous</p>
                                        <p className="font-mono font-medium text-slate-700">
                                            {odomPrevious != null ? `${odomPrevious.toLocaleString()} km` : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">Current</p>
                                        <p className="font-mono font-medium text-slate-700">
                                            {odomCurrent != null ? `${odomCurrent.toLocaleString()} km` : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">Distance</p>
                                        <p className="font-mono font-bold text-slate-800">
                                            {distance != null ? `${distance.toLocaleString()} km` : '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400">Fuel Efficiency</p>
                                        <p className="font-mono font-bold text-emerald-700">
                                            {fuelEfficiency != null ? `${fuelEfficiency.toFixed(2)} km/L` : '—'}
                                        </p>
                                    </div>
                                </div>
                                {expectedNext != null && (
                                    <p className="text-xs text-slate-400 pt-1 border-t border-slate-200/60">
                                        Est. next refuel: ~{expectedNext.toLocaleString()} km
                                    </p>
                                )}
                            </div>

                            {/* Duplicate warning */}
                            {duplicateWarning && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 rounded-xl text-sm bg-amber-50 text-amber-700 border border-amber-200/60 space-y-2"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                        <p>You submitted a receipt to this station recently. Submit again?</p>
                                    </div>
                                    <div className="flex gap-2 ml-7">
                                        <button
                                            onClick={() => handleConfirm(true)}
                                            className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                                        >
                                            Submit Anyway
                                        </button>
                                        <button
                                            onClick={() => setDuplicateWarning(false)}
                                            className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}

                    {/* ============== CONFIRMING PHASE ============== */}
                    {phase === 'confirming' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                            <div className="text-center">
                                <p className="text-sm font-medium text-slate-700">Saving receipt...</p>
                                <p className="text-xs text-slate-400 mt-1">Uploading image and writing to database</p>
                            </div>
                        </div>
                    )}

                    {/* ============== SUCCESS PHASE ============== */}
                    {isSuccess && (
                        <div className="space-y-4">
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-start gap-2.5 p-3 rounded-xl text-sm bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            >
                                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <p>{resultMessage}</p>
                            </motion.div>

                            {/* Summary stats */}
                            {(distance != null || fuelEfficiency != null) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="flex items-center justify-center gap-4 py-3"
                                >
                                    {distance != null && (
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-slate-800">{distance.toLocaleString()} km</p>
                                            <p className="text-xs text-slate-400">Distance</p>
                                        </div>
                                    )}
                                    {distance != null && fuelEfficiency != null && (
                                        <div className="w-px h-8 bg-slate-200" />
                                    )}
                                    {fuelEfficiency != null && (
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-emerald-600">{fuelEfficiency.toFixed(2)} km/L</p>
                                            <p className="text-xs text-slate-400">Efficiency</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* View receipt image link */}
                            {receiptResult?.imageUrl && (
                                <a
                                    href={receiptResult.imageUrl}
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
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100">
                    {/* Capture phase: Scan button */}
                    {isCapture && (
                        <button
                            onClick={handleScan}
                            disabled={!canScan}
                            className="w-full py-3 px-4 bg-blue-500 text-white font-medium rounded-xl
                                hover:bg-blue-600 transition-colors text-sm
                                disabled:opacity-40 disabled:cursor-not-allowed
                                flex items-center justify-center gap-2"
                        >
                            <Search className="w-4 h-4" />
                            Scan Receipt
                        </button>
                    )}

                    {/* Review phase: Confirm + Re-scan buttons */}
                    {isReviewing && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleRescan}
                                className="flex-shrink-0 px-4 py-3 bg-slate-100 text-slate-600 font-medium rounded-xl
                                    hover:bg-slate-200 transition-colors text-sm flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Re-scan
                            </button>
                            <button
                                onClick={() => handleConfirm()}
                                disabled={!canConfirm}
                                className="flex-1 py-3 px-4 bg-emerald-500 text-white font-medium rounded-xl
                                    hover:bg-emerald-600 transition-colors text-sm
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                    flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Confirm & Save
                            </button>
                        </div>
                    )}

                    {/* Rejected: Try Again */}
                    {phase === 'rejected' && (
                        <button
                            onClick={handleRescan}
                            className="w-full py-3 px-4 bg-red-500 text-white font-medium rounded-xl
                                hover:bg-red-600 transition-colors text-sm flex items-center justify-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Try Again
                        </button>
                    )}

                    {/* Success: Done */}
                    {isSuccess && (
                        <button
                            onClick={onClose}
                            className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-medium rounded-xl
                                hover:bg-slate-200 transition-colors text-sm"
                        >
                            Done
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
