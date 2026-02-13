import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera, X, Loader2, CheckCircle, AlertCircle, ExternalLink,
    ChevronRight, Save, Upload, ScanLine, Check, Fuel, Car, ClipboardCheck
} from 'lucide-react';
import type { Station } from '../data/stations';
import {
    submitReceipt, compressImage, scanReceipt,
    type ReceiptResponse, type ExtractedReceiptData,
} from '../lib/api';
import {
    addReceiptToHistory, getReceiptHistory,
    getLastOdometerForVehicle,
} from '../lib/receipt-history';

type Phase = 'idle' | 'submitting' | 'success' | 'error';
type Step = 1 | 2 | 3;
type ScanMode = 'pending' | 'scanning' | 'success' | 'error' | 'skipped';

interface ReceiptCaptureProps {
    station: Station;
    onClose: () => void;
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

const STEP_META: { label: string }[] = [
    { label: 'Photo' },
    { label: 'Fuel' },
    { label: 'Review' },
];

function StepIndicator({ current }: { current: Step }) {
    return (
        <div className="px-6 py-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/60">
            <div className="flex items-center justify-between">
                {STEP_META.map((meta, idx) => {
                    const stepNum = (idx + 1) as Step;
                    const isCompleted = current > stepNum;
                    const isActive = current === stepNum;

                    return (
                        <div key={idx} className="flex items-center flex-1 last:flex-initial">
                            {/* Step circle + label */}
                            <div className="flex flex-col items-center gap-1.5">
                                <div
                                    className={`
                                        w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                                        transition-all duration-300 ease-out
                                        ${isCompleted
                                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                                            : isActive
                                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-300'
                                                : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                                        }
                                    `}
                                >
                                    {isCompleted ? (
                                        <Check className="w-4.5 h-4.5" strokeWidth={3} />
                                    ) : (
                                        <span>{stepNum}</span>
                                    )}
                                </div>
                                <span
                                    className={`text-[11px] font-semibold tracking-wide uppercase transition-colors duration-300 ${
                                        isCompleted ? 'text-emerald-600' : isActive ? 'text-slate-900' : 'text-slate-400'
                                    }`}
                                >
                                    {meta.label}
                                </span>
                            </div>

                            {/* Connector line */}
                            {idx < STEP_META.length - 1 && (
                                <div className="flex-1 mx-3 mt-[-18px]">
                                    <div className="h-[2px] rounded-full bg-slate-200 relative overflow-hidden">
                                        <motion.div
                                            className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
                                            initial={false}
                                            animate={{ width: isCompleted ? '100%' : '0%' }}
                                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Submission Overlay ──────────────────────────────────────────────────────

const SUBMIT_STEPS = [
    { label: 'Uploading receipt...', delay: 0 },
    { label: 'Saving data...', delay: 1500 },
    { label: 'AI verification queued...', delay: 3000 },
];

function SubmissionOverlay() {
    const [activeIdx, setActiveIdx] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];

        SUBMIT_STEPS.forEach((step, idx) => {
            if (idx === 0) return;
            timers.push(
                setTimeout(() => {
                    setCompletedSteps(prev => new Set([...prev, idx - 1]));
                    setActiveIdx(idx);
                }, step.delay)
            );
        });

        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12 px-6"
        >
            {/* Pulsing circle */}
            <div className="relative mb-8">
                <motion.div
                    className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center"
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <motion.div
                        className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                    >
                        <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                    </motion.div>
                </motion.div>
            </div>

            <h3 className="text-lg font-semibold text-slate-900 mb-1">Submitting Receipt</h3>
            <p className="text-sm text-slate-500 mb-8">Please wait a moment...</p>

            {/* Progress steps */}
            <div className="w-full max-w-xs space-y-3">
                {SUBMIT_STEPS.map((step, idx) => {
                    const isCompleted = completedSteps.has(idx);
                    const isActive = activeIdx === idx && !isCompleted;
                    const isWaiting = idx > activeIdx;

                    return (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: isWaiting ? 0.4 : 1, y: 0 }}
                            transition={{ duration: 0.35, delay: idx * 0.15 }}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-300 ${
                                isCompleted
                                    ? 'bg-emerald-50'
                                    : isActive
                                        ? 'bg-blue-50'
                                        : 'bg-slate-50'
                            }`}
                        >
                            {isCompleted ? (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                >
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                </motion.div>
                            ) : isActive ? (
                                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                            ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                            )}
                            <span className={`text-sm font-medium ${
                                isCompleted ? 'text-emerald-700' : isActive ? 'text-blue-700' : 'text-slate-400'
                            }`}>
                                {step.label}
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}

// ─── Step 1: Photo & Vehicle ─────────────────────────────────────────────────

interface Step1Props {
    imagePreview: string | null;
    imageBase64: string | null;
    vehicleReg: string;
    odometerCurrent: string;
    odometerPrevious: string;
    submittedBy: string;
    useHistoryOdometer: boolean;
    isEditingOdometer: boolean;
    scanMode: ScanMode;
    scanError: string | null;
    extractedData: ExtractedReceiptData | null;
    isLoading: boolean;
    touchedFields: Set<string>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onRemoveImage: () => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onStartScan: () => void;
    onSkipScan: () => void;
    onVehicleRegChange: (value: string) => void;
    onOdometerCurrentChange: (value: string) => void;
    onOdometerPreviousChange: (value: string) => void;
    onSubmittedByChange: (value: string) => void;
    onToggleHistory: () => void;
    onStartEdit: () => void;
    onMarkTouched: (field: string) => void;
    onNext: () => void;
}

function Step1Content({
    imagePreview, imageBase64, vehicleReg, odometerCurrent, odometerPrevious,
    submittedBy, useHistoryOdometer, isEditingOdometer, scanMode, scanError,
    extractedData, isLoading, touchedFields, fileInputRef, onRemoveImage,
    onFileChange, onStartScan, onSkipScan, onVehicleRegChange,
    onOdometerCurrentChange, onOdometerPreviousChange, onSubmittedByChange,
    onToggleHistory, onStartEdit, onMarkTouched, onNext
}: Step1Props) {
    const showError = (field: string, condition: boolean) => touchedFields.has(field) && condition;
    const step1Valid = imageBase64 != null && vehicleReg.trim().length > 0 && odometerCurrent.trim().length > 0;

    return (
        <div className="space-y-4">
            {/* ── Photo Capture ── */}
            <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                    Receipt Photo <span className="text-red-500">*</span>
                </label>
                {!imagePreview ? (
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                            className={`h-24 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50 ${
                                showError('image', !imageBase64) ? 'border-red-400 bg-red-50/50' : 'border-slate-300 hover:border-slate-400'
                            }`}
                        >
                            <Upload className="w-6 h-6 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500">Gallery</span>
                        </button>
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={onFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                disabled={isLoading}
                            />
                            <div className="w-full h-24 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex flex-col items-center justify-center gap-1.5 shadow-sm shadow-blue-200">
                                <Camera className="w-6 h-6" />
                                <span className="text-xs font-medium">Camera</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="relative group">
                        <img
                            src={imagePreview}
                            alt="Receipt"
                            className="w-full h-36 object-cover rounded-xl border border-slate-200/80 shadow-sm"
                        />
                        <button
                            type="button"
                            onClick={onRemoveImage}
                            disabled={isLoading}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white transition-all disabled:opacity-50 shadow-sm group-hover:shadow-md"
                        >
                            <X className="w-4 h-4 text-slate-700" />
                        </button>
                    </div>
                )}

                {/* ── AI Scan Status ── */}
                {scanMode === 'scanning' && (
                    <div className="p-3 bg-blue-50 border border-blue-200/60 rounded-xl flex items-center gap-2.5">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
                        <span className="text-sm text-blue-700 font-medium">AI scanning receipt...</span>
                    </div>
                )}

                {scanMode === 'success' && extractedData && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center gap-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <div className="flex-1">
                            <span className="text-sm font-semibold text-emerald-700">Scanned!</span>
                            <span className="text-xs text-emerald-600 ml-2">
                                {extractedData.litres && `${extractedData.litres}L `}
                                {extractedData.amount && `RM${extractedData.amount} `}
                                {extractedData.fuelType && `• ${extractedData.fuelType}`}
                            </span>
                        </div>
                    </div>
                )}

                {scanMode === 'error' && (
                    <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span className="text-sm text-amber-700">{scanError || 'Scan failed'}</span>
                    </div>
                )}

                {/* ── AI Scan Choice ── */}
                {scanMode === 'pending' && imageBase64 && (
                    <div className="p-4 bg-violet-50/80 border border-violet-200/60 rounded-xl">
                        <p className="text-sm font-semibold text-slate-700 mb-3">Auto-fill receipt details with AI?</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={onStartScan}
                                disabled={isLoading}
                                className="py-2.5 px-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm shadow-violet-200"
                            >
                                <ScanLine className="w-4 h-4" />
                                Yes, Scan
                            </button>
                            <button
                                type="button"
                                onClick={onSkipScan}
                                disabled={isLoading}
                                className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium border border-slate-300 rounded-xl transition-colors"
                            >
                                No, Manual
                            </button>
                        </div>
                    </div>
                )}

                {scanMode === 'skipped' && (
                    <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between">
                        <span className="text-sm text-slate-500">Manual entry mode</span>
                        <button type="button" onClick={onStartScan} className="text-sm text-violet-600 font-semibold hover:text-violet-700 transition-colors">
                            Use AI
                        </button>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onFileChange}
                    className="hidden"
                />
            </div>

            {/* ── Vehicle Registration ── */}
            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                    Vehicle <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={vehicleReg}
                    onChange={(e) => onVehicleRegChange(e.target.value.toUpperCase())}
                    onBlur={() => onMarkTouched('vehicleReg')}
                    placeholder="SAB 1234"
                    disabled={isLoading}
                    className={`w-full px-3 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 text-sm ${
                        showError('vehicleReg', vehicleReg.trim().length === 0) ? 'border-red-400' : 'border-slate-300'
                    }`}
                />
            </div>

            {/* ── Current Odometer ── */}
            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                    Current Odometer (km) <span className="text-red-500">*</span>
                </label>
                <input
                    type="number"
                    inputMode="numeric"
                    value={odometerCurrent}
                    onChange={(e) => onOdometerCurrentChange(e.target.value)}
                    onBlur={() => onMarkTouched('odometerCurrent')}
                    placeholder="45230"
                    disabled={isLoading}
                    className={`w-full px-3 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 text-sm ${
                        showError('odometerCurrent', odometerCurrent.trim().length === 0) ? 'border-red-400' : 'border-slate-300'
                    }`}
                />
            </div>

            {/* ── Previous Odometer ── */}
            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                    Previous Odometer <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </label>

                {useHistoryOdometer && !isEditingOdometer && odometerPrevious && (
                    <div className="p-3 bg-blue-50 border border-blue-200/60 rounded-xl flex items-center justify-between">
                        <div>
                            <span className="text-lg font-bold text-blue-900">{parseInt(odometerPrevious).toLocaleString()}</span>
                            <span className="text-xs text-blue-600 ml-1">km</span>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={onStartEdit} className="text-xs text-blue-700 font-semibold hover:text-blue-800 transition-colors">Edit</button>
                            <button type="button" onClick={onToggleHistory} className="text-xs text-red-600 font-semibold hover:text-red-700 transition-colors">Skip</button>
                        </div>
                    </div>
                )}

                {useHistoryOdometer && !isEditingOdometer && !odometerPrevious && (
                    <div className="flex gap-2">
                        <button type="button" onClick={onStartEdit} className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl shadow-sm shadow-blue-200 transition-colors hover:bg-blue-700">Enter</button>
                        <button type="button" onClick={onToggleHistory} className="flex-1 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 rounded-xl transition-colors hover:bg-slate-200">Skip</button>
                    </div>
                )}

                {isEditingOdometer && (
                    <input
                        type="number"
                        inputMode="numeric"
                        value={odometerPrevious}
                        onChange={(e) => onOdometerPreviousChange(e.target.value)}
                        placeholder="Previous reading"
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    />
                )}

                {!useHistoryOdometer && (
                    <div>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={odometerPrevious}
                            onChange={(e) => onOdometerPreviousChange(e.target.value)}
                            placeholder="Optional"
                            disabled={isLoading}
                            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                        />
                        {vehicleReg.trim().length >= 3 && (
                            <button type="button" onClick={onToggleHistory} className="mt-2 text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors">
                                🔍 Lookup from history
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Your Name ── */}
            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                    Your Name <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </label>
                <input
                    type="text"
                    value={submittedBy}
                    onChange={(e) => onSubmittedByChange(e.target.value)}
                    placeholder="Anonymous"
                    disabled={isLoading}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 text-sm"
                />
            </div>

            {/* ── Next Button ── */}
            <button
                onClick={onNext}
                disabled={!step1Valid}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
                Next
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

// ─── Step 2: Fuel Details ────────────────────────────────────────────────────

interface Step2Props {
    litres: string;
    amount: string;
    pricePerLitre: number | null;
    receiptNo: string;
    dateOnReceipt: string;
    fuelType: string;
    isLoading: boolean;
    touchedFields: Set<string>;
    onLitresChange: (value: string) => void;
    onAmountChange: (value: string) => void;
    onReceiptNoChange: (value: string) => void;
    onDateChange: (value: string) => void;
    onFuelTypeChange: (value: string) => void;
    onMarkTouched: (field: string) => void;
    onNext: () => void;
    onBack: () => void;
}

function Step2Content({
    litres, amount, pricePerLitre, receiptNo, dateOnReceipt, fuelType,
    isLoading, touchedFields, onLitresChange, onAmountChange, onReceiptNoChange,
    onDateChange, onFuelTypeChange, onMarkTouched, onNext, onBack
}: Step2Props) {
    const showError = (field: string, condition: boolean) => touchedFields.has(field) && condition;
    const litresNum = parseFloat(litres) || null;
    const amountNum = parseFloat(amount) || null;
    const step2Valid = litresNum != null && litresNum > 0 && amountNum != null && amountNum > 0;

    return (
        <div className="space-y-4">
            {/* ── Litres & Amount ── */}
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Litres <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={litres}
                        onChange={(e) => onLitresChange(e.target.value)}
                        onBlur={() => onMarkTouched('litres')}
                        placeholder="0.00"
                        disabled={isLoading}
                        className={`w-full px-3 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                            showError('litres', litresNum == null || litresNum <= 0) ? 'border-red-400' : 'border-slate-300'
                        }`}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">Amount (MYR) <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={amount}
                        onChange={(e) => onAmountChange(e.target.value)}
                        onBlur={() => onMarkTouched('amount')}
                        placeholder="0.00"
                        disabled={isLoading}
                        className={`w-full px-3 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                            showError('amount', amountNum == null || amountNum <= 0) ? 'border-red-400' : 'border-slate-300'
                        }`}
                    />
                </div>
            </div>

            {/* ── Auto-calculated Price/Litre ── */}
            {pricePerLitre != null && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-700">Price/Litre</span>
                    <span className="text-lg font-bold text-emerald-900">RM {pricePerLitre.toFixed(2)}</span>
                </div>
            )}

            {/* ── Optional Fields ── */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Optional Details</p>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-600">Receipt No</label>
                        <input
                            type="text"
                            value={receiptNo}
                            onChange={(e) => onReceiptNoChange(e.target.value)}
                            placeholder="Optional"
                            disabled={isLoading}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-slate-600">Date</label>
                        <input
                            type="date"
                            value={dateOnReceipt}
                            onChange={(e) => onDateChange(e.target.value)}
                            disabled={isLoading}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-600">Fuel Type</label>
                    <select
                        value={fuelType}
                        onChange={(e) => onFuelTypeChange(e.target.value)}
                        disabled={isLoading}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    >
                        <option value="Petrol">Petrol</option>
                        <option value="Diesel">Diesel</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
            </div>

            {/* ── Navigation ── */}
            <div className="flex gap-2 pt-2">
                <button
                    onClick={onBack}
                    className="flex-1 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!step2Valid}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                    Review
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ─── Step 3: Review & Submit ─────────────────────────────────────────────────

interface Step3Props {
    vehicleReg: string;
    odometerCurrent: string;
    odometerPrevious: string;
    litres: string;
    amount: string;
    pricePerLitre: number | null;
    fuelType: string;
    stationName: string;
    imagePreview: string | null;
    isLoading: boolean;
    duplicateWarning: boolean;
    onSubmit: () => void;
    onBack: () => void;
    onCancelDuplicate: () => void;
}

function Step3Content({
    vehicleReg, odometerCurrent, odometerPrevious, litres, amount, pricePerLitre,
    fuelType, stationName, imagePreview,
    isLoading, duplicateWarning, onSubmit, onBack, onCancelDuplicate
}: Step3Props) {
    const odomCurrent = parseFloat(odometerCurrent) || null;
    const odomPrevious = parseFloat(odometerPrevious) || null;
    const distance = odomCurrent != null && odomPrevious != null && odomCurrent > odomPrevious
        ? odomCurrent - odomPrevious
        : null;
    const litresNum = parseFloat(litres) || null;
    const canSubmit = vehicleReg.trim().length > 0 && odometerCurrent.trim().length > 0 &&
                       litresNum != null && litresNum > 0 && parseFloat(amount) > 0;

    return (
        <div className="space-y-4">
            {/* ── Receipt Thumbnail + Station ── */}
            <div className="flex items-start gap-3">
                {imagePreview && (
                    <img
                        src={imagePreview}
                        alt="Receipt"
                        className="w-16 h-16 object-cover rounded-xl border border-slate-200/80 shadow-sm flex-shrink-0"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{stationName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fuelType}</p>
                </div>
            </div>

            {/* ── Summary Card ── */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden">
                {/* Vehicle & Odometer */}
                <div className="p-4 space-y-2.5">
                    <div className="flex items-center gap-2 mb-2">
                        <Car className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vehicle & Odometer</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Vehicle</span>
                        <span className="font-semibold text-slate-900">{vehicleReg}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Current Odometer</span>
                        <span className="font-semibold text-slate-900">{parseInt(odometerCurrent).toLocaleString()} km</span>
                    </div>
                    {odomPrevious != null && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Previous Odometer</span>
                            <span className="font-medium text-slate-700">{odomPrevious.toLocaleString()} km</span>
                        </div>
                    )}
                    {distance != null && (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Distance</span>
                            <span className="font-semibold text-blue-600">{distance.toFixed(0)} km</span>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-200/60" />

                {/* Fuel Details */}
                <div className="p-4 space-y-2.5">
                    <div className="flex items-center gap-2 mb-2">
                        <Fuel className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fuel Details</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Litres</span>
                        <span className="font-semibold text-slate-900">{litres} L</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Price/Litre</span>
                        <span className="font-medium text-slate-700">RM {pricePerLitre?.toFixed(2) ?? '—'}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-200/40">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="font-bold text-slate-900 text-base">RM {parseFloat(amount).toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* ── Duplicate Warning ── */}
            {duplicateWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/60 rounded-xl">
                    <p className="text-sm text-amber-800 font-medium mb-2.5">Submitted recently for this station. Continue?</p>
                    <div className="flex gap-2">
                        <button onClick={() => onSubmit()} className="flex-1 py-2.5 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors">Yes, Submit</button>
                        <button onClick={onCancelDuplicate} className="flex-1 py-2.5 text-sm font-medium bg-white border border-slate-300 rounded-xl transition-colors hover:bg-slate-50">Cancel</button>
                    </div>
                </div>
            )}

            {/* ── Navigation ── */}
            <div className="flex gap-2 pt-2">
                <button
                    onClick={onBack}
                    disabled={isLoading}
                    className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                    Back
                </button>
                <button
                    onClick={() => onSubmit()}
                    disabled={!canSubmit || isLoading}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 transition-all shadow-sm shadow-emerald-200"
                >
                    <Save className="w-4 h-4" />
                    Submit
                </button>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ReceiptCapture({ station, onClose }: ReceiptCaptureProps) {
    // --- Step state ---
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

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

    // AI verification always enabled (hidden from user per supervisor requirement)
    const enableAI = true;

    // Receipt Details
    const [receiptNo, setReceiptNo] = useState('');
    const [dateOnReceipt, setDateOnReceipt] = useState(() => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [fuelType, setFuelType] = useState('Petrol');
    const [litres, setLitres] = useState('');
    const [amount, setAmount] = useState('');

    // --- Phase & result state ---
    const [phase, setPhase] = useState<Phase>('idle');
    const [resultMessage, setResultMessage] = useState('');
    const [receiptResult, setReceiptResult] = useState<ReceiptResponse | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState(false);

    // --- AI Scan state ---
    const [scanMode, setScanMode] = useState<ScanMode>('pending');
    const [extractedData, setExtractedData] = useState<ExtractedReceiptData | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);

    // --- Previous Odometer state ---
    const [useHistoryOdometer, setUseHistoryOdometer] = useState(true);
    const [isEditingOdometer, setIsEditingOdometer] = useState(false);

    // --- Auto-fill previous odometer when vehicle reg changes ---
    useEffect(() => {
        if (useHistoryOdometer && vehicleReg.trim().length >= 3) {
            const prev = getLastOdometerForVehicle(vehicleReg);
            if (prev != null) {
                setOdometerPrevious(String(prev));
            }
        }
    }, [vehicleReg, useHistoryOdometer]);

    // --- Calculations ---
    const litresNum = parseFloat(litres) || null;
    const amountNum = parseFloat(amount) || null;

    const pricePerLitre = useMemo(() => {
        if (amountNum != null && litresNum != null && litresNum > 0) {
            return amountNum / litresNum;
        }
        return null;
    }, [amountNum, litresNum]);

    // --- Handlers ---
    const markTouched = useCallback((field: string) => {
        setTouchedFields(prev => new Set([...prev, field]));
    }, []);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
        try {
            const base64 = await compressImage(file);
            setImageBase64(base64);
            markTouched('image');
            setScanMode('pending');
            setExtractedData(null);
            setScanError(null);
        } catch {
            setImagePreview(null);
            setImageBase64(null);
            setResultMessage('Failed to process image. Try again.');
            setPhase('error');
        }
    }, [markTouched]);

    const handleStartScan = useCallback(async () => {
        if (!imageBase64) return;

        setScanMode('scanning');
        setScanError(null);
        try {
            const result = await scanReceipt({
                image: imageBase64,
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
            });

            if (result.success && result.extractedData) {
                setExtractedData(result.extractedData);
                setScanMode('success');
                if (result.extractedData.litres) setLitres(String(result.extractedData.litres));
                if (result.extractedData.amount) setAmount(String(result.extractedData.amount));
                if (result.extractedData.receiptNo) setReceiptNo(result.extractedData.receiptNo);
                if (result.extractedData.dateOnReceipt) setDateOnReceipt(result.extractedData.dateOnReceipt);
                if (result.extractedData.fuelType) setFuelType(result.extractedData.fuelType);
            } else {
                setScanMode('error');
                setScanError(result.message || 'Could not read receipt clearly');
            }
        } catch (err) {
            setScanMode('error');
            setScanError(err instanceof Error ? err.message : 'AI scan failed');
        }
    }, [imageBase64, station]);

    const handleSkipScan = useCallback(() => {
        setScanMode('skipped');
        setExtractedData(null);
        setScanError(null);
    }, []);

    const handleRemoveImage = useCallback(() => {
        setImagePreview(null);
        setImageBase64(null);
        setScanMode('pending');
        setExtractedData(null);
        setScanError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleToggleHistory = useCallback(() => {
        const willUseHistory = !useHistoryOdometer;
        setUseHistoryOdometer(willUseHistory);
        setIsEditingOdometer(false);

        if (willUseHistory) {
            const prev = getLastOdometerForVehicle(vehicleReg);
            setOdometerPrevious(prev != null ? String(prev) : '');
        } else {
            setOdometerPrevious('');
        }
    }, [vehicleReg, useHistoryOdometer]);

    const handleStartEditOdometer = useCallback(() => {
        setIsEditingOdometer(true);
    }, []);

    const handleNextStep = useCallback(() => {
        if (currentStep === 1) {
            ['image', 'vehicleReg', 'odometerCurrent'].forEach(markTouched);
            if (imageBase64 && vehicleReg.trim() && odometerCurrent.trim()) {
                setCurrentStep(2);
            }
        } else if (currentStep === 2) {
            ['litres', 'amount'].forEach(markTouched);
            if (litresNum != null && litresNum > 0 && amountNum != null && amountNum > 0) {
                setCurrentStep(3);
            }
        }
    }, [currentStep, imageBase64, vehicleReg, odometerCurrent, litresNum, amountNum, markTouched]);

    const handlePrevStep = useCallback(() => {
        if (currentStep === 2) setCurrentStep(1);
        else if (currentStep === 3) setCurrentStep(2);
    }, [currentStep]);

    const odomCurrent = parseFloat(odometerCurrent) || null;
    const odomPrevious = parseFloat(odometerPrevious) || null;
    const distance = odomCurrent != null && odomPrevious != null && odomCurrent > odomPrevious
        ? odomCurrent - odomPrevious
        : null;
    const fuelEfficiency = distance != null && litresNum != null && litresNum > 0
        ? distance / litresNum
        : null;

    const handleSubmit = useCallback(async (bypassDuplicateCheck = false) => {
        if (!imageBase64 || submitInFlight.current || !vehicleReg.trim() || !odometerCurrent.trim() || !litresNum || !amountNum) return;

        // Duplicate check
        if (!bypassDuplicateCheck) {
            const recentDuplicate = getReceiptHistory().find(entry =>
                entry.kodLokasi === station.kodLokasi &&
                entry.response.status === 'Saved' &&
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
                    litres: litresNum,
                    amount: amountNum,
                    pricePerLitre: pricePerLitre,
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

            addReceiptToHistory({
                timestamp: new Date().toISOString(),
                station: station.name,
                kodLokasi: station.kodLokasi,
                region: station.region,
                submittedBy: submittedBy.trim() || 'Anonymous',
                vehicleReg: vehicleReg.trim(),
                odometerCurrent: odomCurrent,
                manualData: {
                    receiptNo: receiptNo.trim() || null,
                    dateOnReceipt: dateOnReceipt.trim() || null,
                    fuelType: fuelType || null,
                    litres: litresNum,
                    amount: amountNum,
                    pricePerLitre: pricePerLitre,
                    vehicleReg: vehicleReg.trim(),
                    odometerCurrent: odomCurrent!,
                    odometerPrevious: odomPrevious,
                    distance,
                    fuelEfficiency,
                },
                response: result,
            });
        } catch (err) {
            setPhase('error');
            setResultMessage(err instanceof Error ? err.message : 'Failed to submit receipt.');
        } finally {
            submitInFlight.current = false;
        }
    }, [imageBase64, vehicleReg, odometerCurrent, litresNum, amountNum, pricePerLitre, odomCurrent, odomPrevious, distance, fuelEfficiency, submittedBy, enableAI, station, receiptNo, dateOnReceipt, fuelType]);

    const handleReset = useCallback(() => {
        setPhase('idle');
        setCurrentStep(1);
        setImagePreview(null);
        setImageBase64(null);
        setVehicleReg('');
        setOdometerCurrent('');
        setOdometerPrevious('');
        setSubmittedBy('');
        setReceiptNo('');
        setDateOnReceipt(new Date().toISOString().split('T')[0]);
        setFuelType('Petrol');
        setLitres('');
        setAmount('');
        setResultMessage('');
        setReceiptResult(null);
        setDuplicateWarning(false);
        setTouchedFields(new Set());
        setUseHistoryOdometer(true);
        setIsEditingOdometer(false);
        setScanMode('pending');
        setExtractedData(null);
        setScanError(null);
        submitInFlight.current = false;
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const isLoading = phase === 'submitting';

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200/60 receipt-modal-scroll"
            >
                {/* ── Header ── */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-slate-200/60 bg-white/95 backdrop-blur-xl">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Record Receipt</h2>
                        <p className="text-sm text-slate-500">{station.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* ── Step Indicator (only during idle phase) ── */}
                {phase === 'idle' && <StepIndicator current={currentStep} />}

                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {/* ── Submitting Phase: Full Overlay ── */}
                        {phase === 'submitting' && (
                            <SubmissionOverlay />
                        )}

                        {/* ── Success Phase ── */}
                        {phase === 'success' && receiptResult && (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="space-y-5"
                            >
                                {/* Celebration icon */}
                                <div className="flex justify-center">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                                        className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center"
                                    >
                                        <CheckCircle className="w-9 h-9 text-emerald-600" />
                                    </motion.div>
                                </div>

                                <div className="text-center">
                                    <h3 className="text-lg font-bold text-slate-900">Receipt Saved!</h3>
                                    <p className="text-sm text-slate-500 mt-1">{resultMessage}</p>
                                </div>

                                {/* Details card */}
                                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">Receipt ID</span>
                                        <span className="font-mono font-bold text-slate-900 text-xs bg-slate-200/80 px-2 py-0.5 rounded-md">{receiptResult.receiptId}</span>
                                    </div>
                                    {distance != null && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Distance</span>
                                            <span className="font-semibold text-slate-900">{distance.toFixed(0)} km</span>
                                        </div>
                                    )}
                                    {fuelEfficiency != null && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Fuel Efficiency</span>
                                            <span className="font-semibold text-emerald-600">{fuelEfficiency.toFixed(2)} km/L</span>
                                        </div>
                                    )}
                                    {receiptResult.imageUrl && (
                                        <a
                                            href={receiptResult.imageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors pt-2 border-t border-slate-200/60 font-medium"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            View Receipt Image
                                        </a>
                                    )}
                                </div>

                                <button
                                    onClick={handleReset}
                                    className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    Record Another Receipt
                                </button>
                            </motion.div>
                        )}

                        {/* ── Error Phase ── */}
                        {phase === 'error' && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200/60 rounded-xl">
                                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-bold text-red-900">Error</p>
                                        <p className="text-sm text-red-700">{resultMessage}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    Try Again
                                </button>
                            </motion.div>
                        )}

                        {/* ── Idle Phase: Step Wizard ── */}
                        {phase === 'idle' && (
                            <motion.div
                                key={`step-${currentStep}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {currentStep === 1 && (
                                    <Step1Content
                                        imagePreview={imagePreview}
                                        imageBase64={imageBase64}
                                        vehicleReg={vehicleReg}
                                        odometerCurrent={odometerCurrent}
                                        odometerPrevious={odometerPrevious}
                                        submittedBy={submittedBy}
                                        useHistoryOdometer={useHistoryOdometer}
                                        isEditingOdometer={isEditingOdometer}
                                        scanMode={scanMode}
                                        scanError={scanError}
                                        extractedData={extractedData}
                                        isLoading={isLoading}
                                        touchedFields={touchedFields}
                                        fileInputRef={fileInputRef}
                                        onRemoveImage={handleRemoveImage}
                                        onFileChange={handleFileChange}
                                        onStartScan={handleStartScan}
                                        onSkipScan={handleSkipScan}
                                        onVehicleRegChange={setVehicleReg}
                                        onOdometerCurrentChange={setOdometerCurrent}
                                        onOdometerPreviousChange={setOdometerPrevious}
                                        onSubmittedByChange={setSubmittedBy}
                                        onToggleHistory={handleToggleHistory}
                                        onStartEdit={handleStartEditOdometer}
                                        onMarkTouched={markTouched}
                                        onNext={handleNextStep}
                                    />
                                )}

                                {currentStep === 2 && (
                                    <Step2Content
                                        litres={litres}
                                        amount={amount}
                                        pricePerLitre={pricePerLitre}
                                        receiptNo={receiptNo}
                                        dateOnReceipt={dateOnReceipt}
                                        fuelType={fuelType}
                                        isLoading={isLoading}
                                        touchedFields={touchedFields}
                                        onLitresChange={setLitres}
                                        onAmountChange={setAmount}
                                        onReceiptNoChange={setReceiptNo}
                                        onDateChange={setDateOnReceipt}
                                        onFuelTypeChange={setFuelType}
                                        onMarkTouched={markTouched}
                                        onNext={handleNextStep}
                                        onBack={handlePrevStep}
                                    />
                                )}

                                {currentStep === 3 && (
                                    <Step3Content
                                        vehicleReg={vehicleReg}
                                        odometerCurrent={odometerCurrent}
                                        odometerPrevious={odometerPrevious}
                                        litres={litres}
                                        amount={amount}
                                        pricePerLitre={pricePerLitre}
                                        fuelType={fuelType}
                                        stationName={station.name}
                                        imagePreview={imagePreview}
                                        isLoading={isLoading}
                                        duplicateWarning={duplicateWarning}
                                        onSubmit={handleSubmit}
                                        onBack={handlePrevStep}
                                        onCancelDuplicate={() => setDuplicateWarning(false)}
                                    />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
}
