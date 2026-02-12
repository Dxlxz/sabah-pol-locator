import type { ReceiptResponse } from './api';

const STORAGE_KEY = 'pol-receipt-history';
const MAX_ENTRIES = 50;

export interface ReceiptHistoryEntry {
    id: string;
    timestamp: string;
    station: string;
    kodLokasi: string;
    region: string;
    submittedBy: string;
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
    // Keep only the most recent entries
    if (history.length > MAX_ENTRIES) {
        history.length = MAX_ENTRIES;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearReceiptHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
}
