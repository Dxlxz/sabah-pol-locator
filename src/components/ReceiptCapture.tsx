import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera, X, Loader2, CheckCircle, AlertCircle, User, ExternalLink,
    ChevronDown, Save, Sparkles, ChevronRight, ChevronLeft,
    Calculator
} from 'lucide-react';
import type { Station } from '../data/stations';
import {
    submitReceipt, compressImage,
    type ReceiptResponse,
} from '../lib/api';
import {
    addReceiptToHistory, getReceiptHistory,
    getLastOdometerForVehicle,
} from '../lib/receipt-history';

type Phase = 'idle' | 'submitting' | 'success' | 'error';
type Step = 1 | 2 | 3;

interface ReceiptCaptureProps {
    station: Station;
    onClose: () => void;
}

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
    const [enableAI, setEnableAI] = useState(true);
    
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

    // Auto-calculate Price per Litre
    const pricePerLitre = useMemo(() => {
        if (amountNum != null && litresNum != null && litresNum > 0) {
            return amountNum / litresNum;
        }
        return null;
    }, [amountNum, litresNum]);

    const distance = odomCurrent != null && odomPrevious != null && odomCurrent > odomPrevious
        ? odomCurrent - odomPrevious
        : null;

    const fuelEfficiency = distance != null && litresNum != null && litresNum > 0
        ? distance / litresNum
        : null;

    // --- Step validation ---
    const step1Valid = imageBase64 != null && 
                       vehicleReg.trim().length > 0 && 
                       odometerCurrent.trim().length > 0;
    
    const step2Valid = litresNum != null && litresNum > 0 &&
                       amountNum != null && amountNum > 0;

    const canSubmit = step1Valid && step2Valid;

    // --- Handlers ---
    const markTouched = (field: string) => {
        setTouchedFields(prev => new Set([...prev, field]));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
        try {
            const base64 = await compressImage(file);
            setImageBase64(base64);
            markTouched('image');
        } catch {
            setImagePreview(null);
            setImageBase64(null);
            setResultMessage('Failed to process image. Try again.');
            setPhase('error');
        }
    };

    const handleNextStep = () => {
        // Mark all step 1 fields as touched when moving to step 2
        if (currentStep === 1) {
            ['image', 'vehicleReg', 'odometerCurrent'].forEach(markTouched);
            if (step1Valid) setCurrentStep(2);
        } else if (currentStep === 2) {
            ['litres', 'amount'].forEach(markTouched);
            if (step2Valid) setCurrentStep(3);
        }
    };

    const handlePrevStep = () => {
        if (currentStep === 2) setCurrentStep(1);
        else if (currentStep === 3) setCurrentStep(2);
    };

    const handleSubmit = async (bypassDuplicateCheck = false) => {
        if (!imageBase64 || submitInFlight.current || !canSubmit) return;

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
                    litres: litresNum!,
                    amount: amountNum!,
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

            // Save to local history
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
                    litres: litresNum!,
                    amount: amountNum!,
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
    };

    const handleReset = () => {
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
        setEnableAI(true);
        setResultMessage('');
        setReceiptResult(null);
        setDuplicateWarning(false);
        setTouchedFields(new Set());
        submitInFlight.current = false;
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- Render helpers ---
    const isLoading = phase === 'submitting';
    const showError = (field: string, condition: boolean) => touchedFields.has(field) && condition;

    // --- Step 1: Photo & Vehicle ---
    const Step1Content = () => (
        <div className="space-y-6">
            {/* Photo Capture */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                    Receipt Photo <span className="text-red-500">*</span>
                </label>
                {!imagePreview ? (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className={`w-full h-40 flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50 ${
                            showError('image', !imageBase64) ? 'border-red-400 bg-red-50/50' : 'border-slate-300 hover:border-slate-400'
                        }`}
                    >
                        <Camera className="w-10 h-10 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">Take Photo of Receipt</span>
                        <span className="text-xs text-slate-400">Required</span>
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

            {/* Vehicle Registration */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                    Vehicle Registration <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={vehicleReg}
                    onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                    onBlur={() => markTouched('vehicleReg')}
                    placeholder="e.g., SAB 1234"
                    disabled={isLoading}
                    className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50 ${
                        showError('vehicleReg', vehicleReg.trim().length === 0) ? 'border-red-400' : 'border-slate-300'
                    }`}
                />
                {showError('vehicleReg', vehicleReg.trim().length === 0) && (
                    <p className="text-xs text-red-600">Please enter vehicle registration</p>
                )}
            </div>

            {/* Current Odometer */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                    Current Odometer (km) <span className="text-red-500">*</span>
                </label>
                <input
                    type="number"
                    inputMode="numeric"
                    value={odometerCurrent}
                    onChange={(e) => setOdometerCurrent(e.target.value)}
                    onBlur={() => markTouched('odometerCurrent')}
                    placeholder="e.g., 45230"
                    disabled={isLoading}
                    className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50 ${
                        showError('odometerCurrent', odometerCurrent.trim().length === 0) ? 'border-red-400' : 'border-slate-300'
                    }`}
                />
                {showError('odometerCurrent', odometerCurrent.trim().length === 0) && (
                    <p className="text-xs text-red-600">Please enter current odometer reading</p>
                )}
            </div>

            {/* Previous Odometer (Auto-filled) */}
            {odometerPrevious && (
                <div className="p-3 bg-blue-50 border border-blue-200/60 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-blue-900">Previous Odometer</p>
                            <p className="text-xs text-blue-700">Auto-filled from history</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-blue-900">{parseInt(odometerPrevious).toLocaleString()} km</span>
                            <button
                                type="button"
                                onClick={() => setOdometerPrevious('')}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                                Edit
                            </button>
                        </div>
                    </div>
                    {distance != null && (
                        <div className="mt-2 pt-2 border-t border-blue-200/60 flex items-center justify-between text-sm">
                            <span className="text-blue-700">Distance traveled:</span>
                            <span className="font-semibold text-blue-900">{distance.toFixed(0)} km</span>
                        </div>
                    )}
                </div>
            )}

            {/* Navigation */}
            <button
                onClick={handleNextStep}
                disabled={!step1Valid}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                Next: Fuel Details
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );

    // --- Step 2: Fuel Details ---
    const Step2Content = () => (
        <div className="space-y-6">
            {/* Litres & Amount */}
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
                        onBlur={() => markTouched('litres')}
                        placeholder="45.5"
                        disabled={isLoading}
                        className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50 ${
                            showError('litres', litresNum == null || litresNum <= 0) ? 'border-red-400' : 'border-slate-300'
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
                        onBlur={() => markTouched('amount')}
                        placeholder="125.50"
                        disabled={isLoading}
                        className={`w-full px-4 py-3 bg-white border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-50 ${
                            showError('amount', amountNum == null || amountNum <= 0) ? 'border-red-400' : 'border-slate-300'
                        }`}
                    />
                </div>
            </div>

            {/* Auto-calculated Price per Litre */}
            {pricePerLitre != null && (
                <div className="p-4 bg-emerald-50 border border-emerald-200/60 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Calculator className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-900">Auto-calculated</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-emerald-700">Price per Litre:</span>
                        <span className="text-2xl font-bold text-emerald-900">RM {pricePerLitre.toFixed(2)}</span>
                    </div>
                </div>
            )}

            {/* Receipt Details Header */}
            <div className="pt-2 border-t border-slate-200/60">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Additional Details (Optional)</h3>
                
                <div className="space-y-4">
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
                                <option value="Petrol">Petrol</option>
                                <option value="Diesel">Diesel</option>
                                <option value="Other">Other</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
                <button
                    onClick={handlePrevStep}
                    className="flex-1 py-3.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={handleNextStep}
                    disabled={!step2Valid}
                    className="flex-1 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    Next: Review
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );

    // --- Step 3: Review & Submit ---
    const Step3Content = () => (
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
                <h3 className="font-semibold text-slate-900">Receipt Summary</h3>
                
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-600">Vehicle:</span>
                        <span className="font-medium text-slate-900">{vehicleReg}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">Odometer:</span>
                        <span className="font-medium text-slate-900">{parseInt(odometerCurrent).toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">Fuel:</span>
                        <span className="font-medium text-slate-900">{litres} L @ RM {pricePerLitre?.toFixed(2)}/L</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">Total:</span>
                        <span className="font-bold text-slate-900">RM {parseFloat(amount).toFixed(2)}</span>
                    </div>
                    {distance != null && (
                        <div className="flex justify-between pt-2 border-t border-slate-200/60">
                            <span className="text-slate-600">Distance:</span>
                            <span className="font-medium text-slate-900">{distance.toFixed(0)} km</span>
                        </div>
                    )}
                    {fuelEfficiency != null && (
                        <div className="flex justify-between">
                            <span className="text-slate-600">Efficiency:</span>
                            <span className="font-medium text-slate-900">{fuelEfficiency.toFixed(2)} km/L</span>
                        </div>
                    )}
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

            {/* AI Verification */}
            <div className="p-4 bg-violet-50 border border-violet-200/60 rounded-xl">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <p className="font-medium text-slate-900">AI Verification</p>
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
                        <p className="text-sm text-slate-600">
                            {enableAI 
                                ? "AI will verify your receipt data against the photo in the background. You'll receive a notification if any discrepancies are found."
                                : "AI verification is disabled. Only manual data will be saved."
                            }
                        </p>
                    </div>
                </div>
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

            {/* Navigation */}
            <div className="flex gap-3">
                <button
                    onClick={handlePrevStep}
                    className="flex-1 py-3.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                </button>
                <button
                    onClick={() => handleSubmit()}
                    disabled={!canSubmit || isLoading}
                    className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            </div>
        </div>
    );

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

                {/* Progress Indicator */}
                {phase === 'idle' && (
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200/60">
                        <div className="flex items-center justify-between text-xs font-medium">
                            <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${currentStep >= 1 ? 'bg-slate-900 text-white' : 'bg-slate-300'}`}>1</div>
                                <span className="hidden sm:inline">Photo & Vehicle</span>
                            </div>
                            <div className="h-0.5 w-8 bg-slate-300"></div>
                            <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${currentStep >= 2 ? 'bg-slate-900 text-white' : 'bg-slate-300'}`}>2</div>
                                <span className="hidden sm:inline">Fuel Details</span>
                            </div>
                            <div className="h-0.5 w-8 bg-slate-300"></div>
                            <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-slate-900' : 'text-slate-400'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${currentStep >= 3 ? 'bg-slate-900 text-white' : 'bg-slate-300'}`}>3</div>
                                <span className="hidden sm:inline">Review</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-6">
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

                        {/* Form Steps */}
                        {phase === 'idle' && (
                            <motion.div
                                key={`step-${currentStep}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                {currentStep === 1 && <Step1Content />}
                                {currentStep === 2 && <Step2Content />}
                                {currentStep === 3 && <Step3Content />}
                            </motion.div>
                        )}

                        {/* Submitting */}
                        {phase === 'submitting' && (
                            <motion.div
                                key="submitting"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-12"
                            >
                                <Loader2 className="w-12 h-12 text-slate-900 animate-spin mb-4" />
                                <p className="text-lg font-medium text-slate-900">Saving Receipt...</p>
                                <p className="text-sm text-slate-600">Uploading to Google Drive and Sheets</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
}
