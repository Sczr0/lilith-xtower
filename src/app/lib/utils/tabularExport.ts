export type TabularExportCell = string | number | boolean | null | undefined;

export type TabularExportData = {
  headers: string[];
  rows: TabularExportCell[][];
};

type ExportOptions = {
  bom?: boolean;
  eol?: '\n' | '\r\n';
};

const DEFAULT_EOL: ExportOptions['eol'] = '\r\n';

function normalizeEol(value: unknown): ExportOptions['eol'] {
  return value === '\n' ? '\n' : DEFAULT_EOL;
}

function normalizeCell(value: TabularExportCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function escapeCsvCell(value: string): string {
  if (value === '') return '';
  const needsQuote = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function sanitizeTsvCell(value: string): string {
  if (!value) return '';
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

export function exportTabularDataToCsv(data: TabularExportData, options?: ExportOptions): string {
  const bom = options?.bom === true ? '\ufeff' : '';
  const eol = normalizeEol(options?.eol);

  const lines: string[] = [];
  lines.push(data.headers.map((h) => escapeCsvCell(normalizeCell(h))).join(','));
  for (const row of data.rows) {
    lines.push(row.map((cell) => escapeCsvCell(normalizeCell(cell))).join(','));
  }
  return bom + lines.join(eol);
}

export function exportTabularDataToTsv(data: TabularExportData, options?: ExportOptions): string {
  const bom = options?.bom === true ? '\ufeff' : '';
  const eol = normalizeEol(options?.eol);

  const lines: string[] = [];
  lines.push(data.headers.map((h) => sanitizeTsvCell(normalizeCell(h))).join('\t'));
  for (const row of data.rows) {
    lines.push(row.map((cell) => sanitizeTsvCell(normalizeCell(cell))).join('\t'));
  }
  return bom + lines.join(eol);
}

