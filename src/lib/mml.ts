import { PUBLIC_MML_API_KEY } from '$env/static/public';
import { ringAreaHectares, type Ring } from './geo';

/**
 * Maanmittauslaitos' property register, as an OGC API Features service.
 *
 * The registered boundary of a plot is public data, and typing a property
 * identifier is a great deal more accurate than tapping corners on an aerial
 * photo. The service answers in WGS84 GeoJSON with permissive CORS, so this
 * runs straight from the browser like every other query in the app — no proxy,
 * no server route.
 *
 * https://www.maanmittauslaitos.fi/kiinteistotietojen-kyselypalvelu-ogc-api
 */

const BASE =
	'https://avoin-paikkatieto.maanmittauslaitos.fi/kiinteisto-avoin/simple-features/v3';

/** The same key the basemaps use; without it there is nothing to query. */
export const hasMmlProperty = Boolean(PUBLIC_MML_API_KEY);

export const MML_PROPERTY_ATTRIBUTION = '© Maanmittauslaitos, kiinteistörekisterikartta';

/**
 * A property identifier has two faces: the one people write (710-547-1-180)
 * and the one the register stores (71054700010180, the four parts zero-padded
 * to 3-3-4-4). Accept either, plus whatever stray punctuation a copy-paste
 * brings along, and answer in the stored form the API filters on.
 */
export function parsePropertyCode(input: string): string | null {
	const cleaned = input.trim().replace(/[^\d-]/g, '');
	if (/^\d{14}$/.test(cleaned)) return cleaned;

	const parts = cleaned.split('-').filter((p) => p.length);
	if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) return null;

	const widths = [3, 3, 4, 4];
	if (parts.some((p, i) => p.length > widths[i])) return null;
	return parts.map((p, i) => p.padStart(widths[i], '0')).join('');
}

/** The written form, for headings and layer names. */
export function formatPropertyCode(code: string): string {
	if (!/^\d{14}$/.test(code)) return code;
	const parts = [code.slice(0, 3), code.slice(3, 6), code.slice(6, 10), code.slice(10, 14)];
	// Leading zeros are padding, not part of the number people say out loud.
	return parts.map((p) => String(Number(p))).join('-');
}

export type ParcelErrorKind = 'invalidCode' | 'noKey' | 'notFound' | 'failed';

export class ParcelError extends Error {
	kind: ParcelErrorKind;
	constructor(kind: ParcelErrorKind) {
		super(kind);
		this.kind = kind;
	}
}

export interface Parcel {
	/** Outer ring in WGS84, without the closing duplicate point. */
	ring: Ring;
	areaHectares: number;
}

export interface ParcelResult {
	code: string;
	presentation: string;
	/** Every parcel of the property, largest first. */
	parcels: Parcel[];
	/** What the register returned, ready to store as a map layer. */
	geojson: { type: 'FeatureCollection'; features: unknown[] };
	areaHectares: number;
}

interface Geometry {
	type: string;
	coordinates: unknown;
}

/** Outer rings only: a parcel's holes matter for area, not for an outline. */
function outerRings(geometry: Geometry | null | undefined): Ring[] {
	if (!geometry) return [];
	if (geometry.type === 'Polygon') {
		const ring = (geometry.coordinates as Ring[])[0];
		return Array.isArray(ring) ? [ring] : [];
	}
	if (geometry.type === 'MultiPolygon') {
		return (geometry.coordinates as Ring[][])
			.map((polygon) => polygon[0])
			.filter((ring): ring is Ring => Array.isArray(ring));
	}
	return [];
}

/** Drop the closing duplicate the register sends; the ring editor adds it back. */
function openRing(ring: Ring): Ring {
	const open = ring.map(([lon, lat]) => [lon, lat] as [number, number]);
	if (open.length < 2) return open;
	const [fx, fy] = open[0];
	const [lx, ly] = open[open.length - 1];
	if (fx === lx && fy === ly) open.pop();
	return open;
}

/**
 * Look up the parcels of one property.
 *
 * A property is not always one shape on the ground — a farm can hold several
 * detached parcels under a single identifier — so this returns all of them,
 * largest first, and lets the caller decide whether it wants the lot or just
 * the main parcel.
 */
export async function fetchProperty(input: string): Promise<ParcelResult> {
	if (!hasMmlProperty) throw new ParcelError('noKey');

	const code = parsePropertyCode(input);
	if (!code) throw new ParcelError('invalidCode');

	const url =
		`${BASE}/collections/PalstanSijaintitiedot/items` +
		`?kiinteistotunnus=${code}&limit=100&api-key=${encodeURIComponent(PUBLIC_MML_API_KEY)}`;

	let body: { features?: { geometry?: Geometry }[] };
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(String(res.status));
		body = await res.json();
	} catch {
		throw new ParcelError('failed');
	}

	const features = body.features ?? [];
	const parcels = features
		.flatMap((feature) => outerRings(feature.geometry))
		.map(openRing)
		.filter((ring) => ring.length >= 3)
		.map((ring) => ({ ring, areaHectares: ringAreaHectares(ring) }))
		.sort((a, b) => b.areaHectares - a.areaHectares);

	if (!parcels.length) throw new ParcelError('notFound');

	return {
		code,
		presentation: formatPropertyCode(code),
		parcels,
		geojson: { type: 'FeatureCollection', features },
		areaHectares: parcels.reduce((sum, p) => sum + p.areaHectares, 0)
	};
}
