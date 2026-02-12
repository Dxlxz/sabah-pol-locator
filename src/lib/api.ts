// n8n webhook API wrapper for POL Receipt submission

const WEBHOOK_URL = 'https://n8n2.earthinfo.com.my/webhook/pol-receipt';

export interface ReceiptPayload {
    image: string; // base64 encoded JPEG
    station: string;
    kodLokasi: string;
    region: string;
    submittedBy: string;
    capturedAt: string;
}

export interface ExtractedReceiptData {
    receiptNo: string | null;
    dateOnReceipt: string | null;
    fuelType: string | null;
    litres: number | null;
    amount: number | null;
    pricePerLitre: number | null;
    vehicleReg: string | null;
    rawText: string | null;
    confidence: 'high' | 'medium' | 'low' | null;
}

export interface ReceiptResponse {
    success: boolean;
    status: 'Processed' | 'Review Needed' | 'Error';
    receiptNo?: string | null;
    message: string;
    extractedData?: ExtractedReceiptData | null;
    imageUrl?: string | null;
}

export async function submitReceipt(payload: ReceiptPayload): Promise<ReceiptResponse> {
    const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ReceiptResponse = await response.json();

    // Handle workflow-level errors (success: false from error path)
    if (data.success === false && data.status === 'Error') {
        throw new Error(data.message || 'Receipt processing failed');
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
