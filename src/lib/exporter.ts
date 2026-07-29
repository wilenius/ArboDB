/**
 * Table exports. CSV is written by hand — it is four lines of quoting rules and
 * avoids shipping a library on the field path. XLSX pulls in ExcelJS, but only
 * when the owner actually asks for a spreadsheet, so the phone never downloads
 * it. Both use the same column definitions, so a report exports exactly what
 * it shows.
 */

export interface Column<T> {
	key: string;
	header: string;
	value: (row: T) => string | number | null | undefined;
}

function csvCell(v: string | number | null | undefined): string {
	if (v == null) return '';
	const s = String(v);
	return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
	const head = columns.map((c) => csvCell(c.header)).join(';');
	const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(';'));
	// Semicolons and a BOM: what Excel in a Finnish locale expects.
	return '﻿' + [head, ...body].join('\r\n') + '\r\n';
}

function download(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv<T>(rows: T[], columns: Column<T>[], filename: string) {
	download(new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' }), filename);
}

export async function downloadXlsx<T>(
	rows: T[],
	columns: Column<T>[],
	filename: string,
	sheetName = 'Data'
) {
	const ExcelJS = (await import('exceljs')).default;
	const wb = new ExcelJS.Workbook();
	wb.creator = 'ArboDB';
	wb.created = new Date();
	const ws = wb.addWorksheet(sheetName.slice(0, 31));

	ws.columns = columns.map((c) => ({
		header: c.header,
		key: c.key,
		width: Math.max(12, Math.min(40, c.header.length + 6))
	}));
	ws.getRow(1).font = { bold: true };
	ws.views = [{ state: 'frozen', ySplit: 1 }];

	for (const row of rows) {
		const record: Record<string, unknown> = {};
		for (const c of columns) record[c.key] = c.value(row) ?? '';
		ws.addRow(record);
	}
	ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

	const buffer = await wb.xlsx.writeBuffer();
	download(
		new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		}),
		filename
	);
}

export function stamped(base: string, ext: string): string {
	return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
