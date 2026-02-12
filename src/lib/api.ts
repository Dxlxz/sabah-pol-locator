// n8n webhook API wrapper for POL Receipt submission (single-phase async with optional AI)

const WEBHOOK_URL = 'https://n8n2.earthinfo.com.my/webhook/pol-receipt';

// --- Manual entry data structure ---
export interface ManualReceiptData {
    receiptNo: string | null;
    dateOnReceipt: string | null;
    fuelType: string | null;
    litres: number;              // Required
    amount: number;              // Required
    pricePerLitre: number | null;
    vehicleReg: string;          // Required
    odometerCurrent: number;     // Required
    odometerPrevious: number | null;
    distance: number | null;
    fuelEfficiency: number | null;
}

// --- Submit payload (single phase) ---
export interface SubmitPayload {
    image: string;              // base64 encoded JPEG
    station: string;
    kodLokasi: string;
    region: string;
    submittedBy: string;
    capturedAt: string;
    manualData: ManualReceiptData;
    enableAI?: boolean;         // Optional, default true
}

// --- Response types ---
export interface ReceiptResponse {
    success: boolean;
    receiptId: string;
    status: 'Saved';
    message: string;
    verificationStatus: string;
    aiVerification: {
        enabled: boolean;
        status: 'Processing' | 'Not Requested' | 'Completed' | 'Failed' | 'Unavailable';
    };
    imageUrl: string | null;
}

// --- Submit receipt (upload image + save manual data + optional AI) ---
export async function submitReceipt(payload: SubmitPayload): Promise<ReceiptResponse> {
    const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ReceiptResponse = await response.json();

    if (data.success === false) {
        throw new Error(data.message || 'Receipt submission failed');
    }

    return data;
}

/**
 * Converts a File to a base64 string (without the data URI prefix).
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the "data:image/...;base64," prefix
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Compresses an image file to reduce size before upload.
 * Target: max 1200px wide, JPEG quality 0.7
 */
export function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context failed'));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Image load failed'));
        };

        img.src = url;
    });
}
