import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera, X, Loader2, CheckCircle, AlertCircle, User, ExternalLink,
    ChevronDown, Save, Gauge, Sparkles,
} from 'lucide-react';
import type { Station } from '../data/stations';
import {
    submitReceipt, compressImage,
    type ReceiptResponse,
} from '../lib/api';
import {
    addReceiptToHistory, getReceiptHistory,
    getLastOdometerForVehicle, getAverageDistanceForVehicle,
} from '../lib/receipt-history';

type Phase = 'idle' | 'submitting' | 'success' | 'error';

interface ReceiptCaptureProps {
    station: Station;
    onClose: () => void;
}

export function ReceiptCapture({ station, onClose }: ReceiptCaptureProps) {
    // --- Image state ---
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const submitInFlight = useRef(false);

    // --- Form state ---
    const [vehicleReg, setVehicleReg] = useState('');
    const [odometerCurrent, setOdometerCurrent] = useState('');
    const [odometerPrevious, setOdometerPrevious] = useState('');
    const [submittedBy, setSubmittedBy] = useState('');
    const [enableAI, setEnableAI] = useState(true);

    // Manual entry fields
    const [receiptNo, setReceiptNo] = useState('');
    const [dateOnReceipt, setDateOnReceipt] = useState('');
    const [fuelType, setFuelType] = useState('');
    const [litres, setLitres] = useState('');
    const [amount, setAmount] = useState('');
    const [pricePerLitre, setPricePerLitre] = useState('');

    // --- Phase & result state ---
    const [phase, setPhase] = useState<Phase>('idle');
    const [resultMessage, setResultMessage] = useState('');
    const [receiptResult, setReceiptResult] = useState<ReceiptResponse | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState(false);

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
    const litresNum = parseFloat(litres) || null;
    const amountNum = parseFloat(amount) || null;

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

    // --- Can submit? ---
    const canSubmit = imageBase64 != null &&
                      vehicleReg.trim().length > 0 &&
                      odometerCurrent.trim().length > 0 &&
                      amountNum != null && amountNum > 0 &&
                      litresNum != null && litresNum > 0;

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

    const handleSubmit = async (bypassDuplicateCheck = false) => {
        if (!imageBase64 || submitInFlight.current || !canSubmit) return;

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
        setPhase('submitting');
        setResultMessage('');

        try {
            const result = await submitReceipt({
                image: imageBase64,
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
                submittedBy: submittedBy.trim() || 'Anonymous',
                capturedAt: new Date().toISOString(),
                enableAI,
                manualData: {
                    receiptNo: receiptNo.trim() || null,
                    dateOnReceipt: dateOnReceipt.trim() || null,
                    fuelType: fuelType || null,
                    litres: litresNum!,
                    amount: amountNum!,
                    pricePerLitre: parseFloat(pricePerLitre) || null,
                    vehicleReg: vehicleReg.trim(),
                    odometerCurrent: odomCurrent!,
                    odometerPrevious: odomPrevious,
                    distance,
                    fuelEfficiency,
                },
            });

            setReceiptResult(result);
            setResultMessage(result.message || 'Receipt recorded successfully');
            setPhase('success');

            // Save to local history
            addReceiptToHistory({
                timestamp: new Date().toISOString(),
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
                submittedBy: submittedBy.trim() || 'Anonymous',
                vehicleReg: vehicleReg.trim(),
                odometerCurrent: odomCurrent,
                response: result as any, // Compatible type
            });
        } catch (err) {
            setPhase('error');
            setResultMessage(err instanceof Error ? err.message : 'Failed to submit receipt.');
        } finally {
            submitInFlight.current = false;
        }
    };

    const handleReset = () => {
        setPhase('idle');
        setImagePreview(null);
        setImageBase64(null);
        setVehicleReg('');
        setOdometerCurrent('');
        setOdometerPrevious('');
        setSubmittedBy('');
        setReceiptNo('');
        setDateOnReceipt('');
        setFuelType('');
        setLitres('');
        setAmount('');
        setPricePerLitre('');
        setEnableAI(true);
        setResultMessage('');
        setReceiptResult(null);
        setDuplicateWarning(false);
        submitInFlight.current = false;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- Render phases ---
    const isLoading = phase === 'submitting';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60"
            >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Record Receipt</h2>
                        <p className="text-sm text-slate-600">{station.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <AnimatePresence mode="wait">
                        {/* Success Phase */}
                        {phase === 'success' && receiptResult && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200/60 rounded-xl">
                                    <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-medium text-emerald-900">Receipt Saved!</p>
                                        <p className="text-sm text-emerald-700">{resultMessage}</p>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Receipt ID:</span>
                                        <span className="font-mono font-medium text-slate-900">{receiptResult.receiptId}</span>
                                    </div>
                                    {distance != null && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600">Distance:</span>
                                            <span className="font-medium text-slate-900">{distance.toFixed(0)} km</span>
                                        </div>
                                    )}
                                    {fuelEfficiency != null && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600">Fuel Efficiency:</span>
                                            <span className="font-medium text-slate-900">{fuelEfficiency.toFixed(2)} km/L</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-200/60">
                                        <span className="text-slate-600">AI Verification:</span>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            receiptResult.aiVerification.status === 'Processing'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {receiptResult.aiVerification.status}
                                        </span>
                                    </div>
                                </div>

                                {receiptResult.imageUrl && (
                                    <a
                                        href={receiptResult.imageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        View Image
                                    </a>
                                )}

                                <button
                                    onClick={handleReset}
                                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors"
                                >
                                    Record Another
                                </button>
                            </motion.div>
                        )}

                        {/* Error Phase */}
                        {phase === 'error' && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-4"
                            >
                                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200/60 rounded-xl">
                                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="font-medium text-red-900">Submission Failed</p>
                                        <p className="text-sm text-red-700 mt-1">{resultMessage}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors"
                                >
                                    Try Again
                                </button>
                            </motion.div>
                        )}

                        {/* Idle/Submitting Phase - Main Form */}
                        {(phase === 'idle' || phase === 'submitting') && (
                            <motion.div
                                key="form"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-6"
                            >
                                {/* Image Capture */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Receipt Photo <span className="text-red-500">*</span>
                                    </label>
                                    {!imagePreview ? (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isLoading}
                                            className="w-full h-40 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 rounded-xl hover:border-slate-400 hover:bg-slate-50 transition-all disabled:opacity-50"
                                        >
                                            <Camera className="w-10 h-10 text-slate-400" />
                                            <span className="text-sm font-medium text-slate-600">Take Photo</span>
                                        </button>
                                    ) : (
                                        <div className="relative">
                                            <img src={imagePreview} alt="Receipt" className="w-full h-48 object-cover rounded-xl border border-slate-200/60" />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setImagePreview(null);
                                                    setImageBase64(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                disabled={isLoading}
                                                className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-colors disabled:opacity-50 shadow-sm"
                                            >
                                                <X className="w-4 h-4 text-slate-700" />
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                </div>

                                {/* Vehicle & Odometer */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700">
                                            Vehicle Reg <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={vehicleReg}
                                            onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                                            placeholder="SAB 1234"
                                            disabled={isLoading}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700">
                                            Odometer (km) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={odometerCurrent}
                                            onChange={(e) => setOdometerCurrent(e.target.value)}
                                            placeholder="45230"
                                            disabled={isLoading}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50"
                                        />
                                    </div>
                                </div>

                                {/* Previous Odometer (auto-filled) */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Previous Odometer (km)
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={odometerPrevious}
                                        onChange={(e) => setOdometerPrevious(e.target.value)}
                                        placeholder="Auto-filled from history"
                                        disabled={isLoading}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50"
                                    />
                                </div>

                                {/* Odometer Summary */}
                                {distance != null && (
                                    <div className="p-4 bg-blue-50 border border-blue-200/60 rounded-xl space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-blue-700">Distance:</span>
                                            <span className="font-semibold text-blue-900">{distance.toFixed(0)} km</span>
                                        </div>
                                        {fuelEfficiency != null && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-blue-700">Fuel Efficiency:</span>
                                                <span className="font-semibold text-blue-900">{fuelEfficiency.toFixed(2)} km/L</span>
                                            </div>
                                        )}
                                        {expectedNext != null && (
                                            <div className="flex items-center justify-between pt-2 border-t border-blue-200/60">
                                                <span className="text-blue-600 flex items-center gap-1">
                                                    <Gauge className="w-4 h-4" />
                                                    Est. Next Refuel:
                                                </span>
                                                <span className="font-medium text-blue-800">~{expectedNext.toFixed(0)} km</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Receipt Details */}
                                <div className="space-y-4 pt-2 border-t border-slate-200/60">
                                    <h3 className="text-sm font-semibold text-slate-900">Receipt Details</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-slate-700">Receipt No</label>
                                            <input
                                                type="text"
                                                value={receiptNo}
                                                onChange={(e) => setReceiptNo(e.target.value)}
                                                placeholder="REC-001"
                                                disabled={isLoading}
                                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-slate-700">Date</label>
                                            <input
                                                type="date"
                                                value={dateOnReceipt}
                                                onChange={(e) => setDateOnReceipt(e.target.value)}
                                                disabled={isLoading}
                                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700">Fuel Type</label>
                                        <div className="relative">
                                            <select
                                                value={fuelType}
                                                onChange={(e) => setFuelType(e.target.value)}
                                                disabled={isLoading}
                                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50 appearance-none"
                                            >
                                                <option value="">Select fuel type</option>
                                                <option value="Petrol">Petrol</option>
                                                <option value="Diesel">Diesel</option>
                                                <option value="Other">Other</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-slate-700">
                                                Litres <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step="0.01"
                                                value={litres}
                                                onChange={(e) => setLitres(e.target.value)}
                                                placeholder="45.5"
                                                disabled={isLoading}
                                                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50 ${
                                                    litresNum == null || litresNum <= 0 ? 'border-red-300' : 'border-slate-300'
                                                }`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-slate-700">
                                                Amount (MYR) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                step="0.01"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                placeholder="125.50"
                                                disabled={isLoading}
                                                className={`w-full px-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50 ${
                                                    amountNum == null || amountNum <= 0 ? 'border-red-300' : 'border-slate-300'
                                                }`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700">Price per Litre</label>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            value={pricePerLitre}
                                            onChange={(e) => setPricePerLitre(e.target.value)}
                                            placeholder="2.76"
                                            disabled={isLoading}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50"
                                        />
                                    </div>
                                </div>

                                {/* Submitted By */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Your Name (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={submittedBy}
                                        onChange={(e) => setSubmittedBy(e.target.value)}
                                        placeholder="Anonymous"
                                        disabled={isLoading}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50"
                                    />
                                </div>

                                {/* AI Toggle */}
                                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200/60 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-violet-600" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">AI Verification</p>
                                            <p className="text-xs text-slate-600">Verify data in background</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEnableAI(!enableAI)}
                                        disabled={isLoading}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 ${
                                            enableAI ? 'bg-violet-600' : 'bg-slate-300'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                enableAI ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Duplicate Warning */}
                                {duplicateWarning && (
                                    <div className="p-4 bg-amber-50 border border-amber-200/60 rounded-xl">
                                        <p className="text-sm text-amber-800 mb-3">
                                            You submitted a receipt for {station.name} less than 5 minutes ago. Continue?
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSubmit(true)}
                                                className="flex-1 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
                                            >
                                                Yes, Continue
                                            </button>
                                            <button
                                                onClick={() => setDuplicateWarning(false)}
                                                className="flex-1 py-2 px-4 bg-white hover:bg-slate-50 text-slate-700 font-medium border border-slate-300 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    onClick={() => handleSubmit()}
                                    disabled={!canSubmit || isLoading}
                                    className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Save Receipt
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
}
