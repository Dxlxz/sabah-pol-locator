import type { ReceiptResponse, ManualReceiptData } from './api';

const STORAGE_KEY = 'pol-receipt-history';
const MAX_ENTRIES = 50;

export interface ReceiptHistoryEntry {
    id: string;
    timestamp: string;
    station: string;
    kodLokasi: string;
    region: string;
    submittedBy: string;
    vehicleReg: string;
    odometerCurrent: number | null;
    manualData: ManualReceiptData;
    response: ReceiptResponse;
}

export function getReceiptHistory(): ReceiptHistoryEntry[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ReceiptHistoryEntry[];
    } catch {
        return [];
    }
}

export function addReceiptToHistory(entry: Omit<ReceiptHistoryEntry, 'id'>): void {
    const history = getReceiptHistory();
    const newEntry: ReceiptHistoryEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    history.unshift(newEntry);
    if (history.length > MAX_ENTRIES) {
        history.length = MAX_ENTRIES;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearReceiptHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get the most recent odometer reading for a given vehicle registration.
 * Returns null if no history exists for this vehicle.
 */
export function getLastOdometerForVehicle(vehicleReg: string): number | null {
    const history = getReceiptHistory();
    const normalized = vehicleReg.trim().toUpperCase();
    for (const entry of history) {
        if (entry.vehicleReg?.trim().toUpperCase() === normalized && entry.odometerCurrent != null) {
            return entry.odometerCurrent;
        }
    }
    return null;
}

/**
 * Calculate the average distance between refuels for a vehicle.
 * Needs at least 2 entries with odometer readings to compute.
 * Returns null if insufficient data.
 */
export function getAverageDistanceForVehicle(vehicleReg: string): number | null {
    const history = getReceiptHistory();
    const normalized = vehicleReg.trim().toUpperCase();

    // Get all odometer readings for this vehicle, most recent first
    const readings = history
        .filter(e => e.vehicleReg?.trim().toUpperCase() === normalized && e.odometerCurrent != null)
        .map(e => e.odometerCurrent as number);

    if (readings.length < 2) return null;

    // Calculate distances between consecutive readings
    const distances: number[] = [];
    for (let i = 0; i < readings.length - 1; i++) {
        const dist = readings[i] - readings[i + 1]; // newer - older = positive
        if (dist > 0) distances.push(dist);
    }

    if (distances.length === 0) return null;

    const total = distances.reduce((sum, d) => sum + d, 0);
    return Math.round(total / distances.length);
}
