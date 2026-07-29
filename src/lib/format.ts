import { t } from './i18n';
import type { Observation, Planting, Taxon, Tree } from './types';

/**
 * Scientific names are assembled in one place so that every screen renders
 * them identically. The parts are returned separately because the cultivar
 * epithet is set upright inside an otherwise italic name — a botanical
 * convention the CSS honours via .sci .cv.
 */
export function scientificParts(taxon: Taxon | undefined | null): {
	italic: string;
	cultivar: string | null;
} {
	if (!taxon) return { italic: '—', cultivar: null };
	const italic = [
		taxon.genus,
		taxon.species,
		taxon.infraspecific_rank,
		taxon.infraspecific_epithet
	]
		.filter(Boolean)
		.join(' ');
	return { italic, cultivar: taxon.cultivar ? `'${taxon.cultivar}'` : null };
}

export function scientificName(taxon: Taxon | undefined | null): string {
	const { italic, cultivar } = scientificParts(taxon);
	return cultivar ? `${italic} ${cultivar}` : italic;
}

/** "Lehtikuusi A" — how the owner would refer to a specimen out loud. */
export function specimenName(planting: Planting | undefined, tree: Tree | null): string {
	const base = planting?.taxa?.name_fi || scientificName(planting?.taxa) || '—';
	const label = tree?.label;
	return label ? `${base} ${label}` : base;
}

export function formatDistance(m: number | null | undefined): string {
	if (m == null) return '—';
	if (m < 10) return `${m.toFixed(1)} m`;
	if (m < 1000) return `${Math.round(m)} m`;
	return `${(m / 1000).toFixed(1)} km`;
}

export function formatPlantedDate(
	year: number | null,
	month: number | null
): string {
	if (!year) return '—';
	if (!month) return String(year);
	return `${String(month).padStart(2, '0')}/${year}`;
}

const dateFmt = new Intl.DateTimeFormat('fi-FI', {
	day: 'numeric',
	month: 'numeric',
	year: 'numeric'
});
const dateTimeFmt = new Intl.DateTimeFormat('fi-FI', {
	day: 'numeric',
	month: 'numeric',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});

export function formatDate(iso: string | null | undefined): string {
	return iso ? dateFmt.format(new Date(iso)) : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
	return iso ? dateTimeFmt.format(new Date(iso)) : '—';
}

/** Value for a datetime-local input, in the browser's own timezone. */
export function toLocalInput(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
		d.getHours()
	)}:${pad(d.getMinutes())}`;
}

export function formatCoord(lat: number | null, lon: number | null): string {
	if (lat == null || lon == null) return t.tree.noPosition;
	return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function formatMeasurement(obs: Observation): string | null {
	const parts: string[] = [];
	if (obs.height_cm != null) {
		parts.push(
			obs.height_cm >= 100
				? `${(obs.height_cm / 100).toFixed(2).replace('.', ',')} m`
				: `${obs.height_cm} cm`
		);
	}
	if (obs.diameter_mm != null) parts.push(`⌀ ${obs.diameter_mm} mm`);
	return parts.length ? parts.join(' · ') : null;
}

/** Readable text colour against an arbitrary tag colour. */
export function contrastInk(hex: string): string {
	const h = hex.replace('#', '');
	if (h.length !== 6) return '#000';
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
	const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	return L > 0.45 ? '#16241c' : '#f4f8f0';
}
