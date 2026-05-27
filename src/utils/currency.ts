import { getDateFormatSync } from './settings';

export function formatCurrency(amount: number): string {
  if (amount === 0) return 'PKR 0';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}PKR ${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}PKR ${(abs / 1_000_000).toFixed(2)}M`;
  }
  return `${sign}PKR ${abs.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const fmt = getDateFormatSync();
    if (fmt === 'dmy') {
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    if (fmt === 'mdy') {
      return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    const fmt = getDateFormatSync();
    if (fmt === 'dmy') {
      return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
    }
    if (fmt === 'mdy') {
      return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
