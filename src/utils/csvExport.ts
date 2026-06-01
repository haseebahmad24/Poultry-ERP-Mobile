import { Share } from 'react-native';
import type { TrialBalanceRow } from '@/api/trialBalance';
import type { JournalEntry } from '@/api/journalEntries';
import type { APBill } from '@/api/accountsPayable';
import type { ARInvoice } from '@/api/accountsReceivable';

function esc(val: string | number | undefined | null): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | undefined | null)[]): string {
  return cells.map(esc).join(',');
}

export async function exportTrialBalanceCSV(opts: {
  rows: TrialBalanceRow[];
  companyName?: string;
  asOf?: string;
  totalDebit?: number;
  totalCredit?: number;
}): Promise<void> {
  const { rows, companyName, asOf, totalDebit, totalCredit } = opts;

  const lines: string[] = [
    row('Company', companyName ?? ''),
    row('As of', asOf ?? ''),
    '',
    row('Account Code', 'Account Name', 'Level', 'Debit', 'Credit'),
    ...rows.map((r) =>
      row(r.account_code ?? '', r.account_name ?? '', r.level ?? 0, r.debit ?? '', r.credit ?? '')
    ),
    '',
    row('', 'TOTAL', '', totalDebit ?? '', totalCredit ?? ''),
  ];

  const csv = lines.join('\n');
  const filename = `trial-balance-${asOf ?? 'export'}.csv`;
  await Share.share({ message: csv, title: filename });
}

export async function exportJournalEntriesCSV(opts: {
  entries: JournalEntry[];
  companyName?: string;
  from?: string;
  to?: string;
  type?: string;
}): Promise<void> {
  const { entries, companyName, from, to, type } = opts;

  const lines: string[] = [
    row('Company', companyName ?? ''),
    row('Type', type ?? 'All'),
    ...(from ? [row('From', from)] : []),
    ...(to ? [row('To', to)] : []),
    '',
    row('Voucher Type', 'Voucher No', 'Date', 'Account', 'Debit', 'Credit', 'Narration', 'Status'),
  ];

  for (const e of entries) {
    const jelines = e.lines ?? [];
    if (jelines.length === 0) {
      lines.push(row(
        e.voucher_type ?? '', e.voucher_no ?? '', e.dt ?? '',
        '', e.total_debit ?? '', e.total_credit ?? '',
        e.narration ?? '', e.status ?? ''
      ));
    } else {
      for (const l of jelines) {
        lines.push(row(
          e.voucher_type ?? '', e.voucher_no ?? '', e.dt ?? '',
          l.account ?? '', l.debit ?? '', l.credit ?? '',
          l.narration ?? e.narration ?? '', e.status ?? ''
        ));
      }
    }
  }

  const csv = lines.join('\n');
  const filename = `journal-entries${from ? `-${from}` : ''}.csv`;
  await Share.share({ message: csv, title: filename });
}

export async function exportAPBillsCSV(opts: {
  bills: APBill[];
  companyName?: string;
}): Promise<void> {
  const { bills, companyName } = opts;
  const lines: string[] = [
    row('Company', companyName ?? ''),
    '',
    row('Bill #', 'Vendor', 'Date', 'Due Date', 'Amount', 'Paid', 'Outstanding', 'Status'),
    ...bills.map((b) =>
      row(b.bill_number ?? b.id, b.vendor ?? '', b.dt ?? '', b.due_date ?? '',
        b.amount ?? '', b.paid ?? '', b.outstanding ?? '', b.status ?? '')
    ),
  ];
  await Share.share({ message: lines.join('\n'), title: 'ap-bills.csv' });
}

export async function exportARInvoicesCSV(opts: {
  invoices: ARInvoice[];
  companyName?: string;
}): Promise<void> {
  const { invoices, companyName } = opts;
  const lines: string[] = [
    row('Company', companyName ?? ''),
    '',
    row('Invoice #', 'Customer', 'Date', 'Due Date', 'Amount', 'Paid', 'Outstanding', 'Status'),
    ...invoices.map((i) =>
      row(i.invoice_number ?? i.id, i.customer ?? '', i.dt ?? '', i.due_date ?? '',
        i.amount ?? '', i.paid ?? '', i.outstanding ?? '', i.status ?? '')
    ),
  ];
  await Share.share({ message: lines.join('\n'), title: 'ar-invoices.csv' });
}
