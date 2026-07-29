/**
 * Geography helpers.
 *
 * Two jobs: measuring how far the owner is standing from a tree, and getting
 * Finnish map material into WGS84. Finnish orthophotos and property maps come
 * in ETRS-TM35FIN (EPSG:3067), so an imported GeoTIFF world file or a GeoJSON
 * exported from a Finnish GIS needs converting before MapLibre can use it.
 * The transverse Mercator maths is short enough to keep in-repo rather than
 * pull in proj4 for two call sites.
 */

const EARTH_R = 6371008.8;

export function distanceMeters(
	aLat: number,
	aLon: number,
	bLat: number,
	bLon: number
): number {
	const φ1 = (aLat * Math.PI) / 180;
	const φ2 = (bLat * Math.PI) / 180;
	const Δφ = φ2 - φ1;
	const Δλ = ((bLon - aLon) * Math.PI) / 180;
	const s =
		Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
	return 2 * EARTH_R * Math.asin(Math.sqrt(s));
}

/** Compass bearing from a to b, degrees clockwise from north. */
export function bearingDegrees(
	aLat: number,
	aLon: number,
	bLat: number,
	bLon: number
): number {
	const φ1 = (aLat * Math.PI) / 180;
	const φ2 = (bLat * Math.PI) / 180;
	const Δλ = ((bLon - aLon) * Math.PI) / 180;
	const y = Math.sin(Δλ) * Math.cos(φ2);
	const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
	return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export const COMPASS_FI = ['P', 'PI', 'I', 'KA', 'E', 'LO', 'L', 'LU'];

export function compassPoint(bearing: number): string {
	return COMPASS_FI[Math.round(bearing / 45) % 8];
}

// --- ETRS-TM35FIN (EPSG:3067) ↔ WGS84 -------------------------------------
// GRS80 ellipsoid, central meridian 27°E, scale 0.9996, false easting 500 km.

const A = 6378137.0;
const F = 1 / 298.257222101;
const K0 = 0.9996;
const LON0 = (27 * Math.PI) / 180;
const FE = 500000;

const N = F / (2 - F);
const A_RECT = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);

const α = [
	N / 2 - (2 / 3) * N ** 2 + (5 / 16) * N ** 3,
	(13 / 48) * N ** 2 - (3 / 5) * N ** 3,
	(61 / 240) * N ** 3
];
const β = [
	N / 2 - (2 / 3) * N ** 2 + (37 / 96) * N ** 3,
	(1 / 48) * N ** 2 + (1 / 15) * N ** 3,
	(17 / 480) * N ** 3
];
const δ = [
	2 * N - (2 / 3) * N ** 2 - 2 * N ** 3,
	(7 / 3) * N ** 2 - (8 / 5) * N ** 3,
	(56 / 15) * N ** 3
];

/** EPSG:3067 easting/northing → [lon, lat] in degrees. */
export function tm35finToWgs84(east: number, north: number): [number, number] {
	const ξ = north / (A_RECT * K0);
	const η = (east - FE) / (A_RECT * K0);

	let ξ1 = ξ;
	let η1 = η;
	for (let j = 0; j < 3; j++) {
		const s = 2 * (j + 1);
		ξ1 -= β[j] * Math.sin(s * ξ) * Math.cosh(s * η);
		η1 -= β[j] * Math.cos(s * ξ) * Math.sinh(s * η);
	}

	const β2 = Math.asin(Math.sin(ξ1) / Math.cosh(η1));
	const l = Math.asin(Math.tanh(η1) / Math.cos(β2));

	let φ = β2;
	for (let j = 0; j < 3; j++) φ += δ[j] * Math.sin(2 * (j + 1) * β2);

	return [((LON0 + l) * 180) / Math.PI, (φ * 180) / Math.PI];
}

/** [lon, lat] in degrees → EPSG:3067 [easting, northing]. */
export function wgs84ToTm35fin(lon: number, lat: number): [number, number] {
	const φ = (lat * Math.PI) / 180;
	const l = (lon * Math.PI) / 180 - LON0;

	const e = Math.sqrt(F * (2 - F));
	const t = Math.sinh(e * Math.atanh((e * Math.tan(φ)) / Math.sqrt(1 + Math.tan(φ) ** 2)));
	const τ = Math.tan(φ) * Math.sqrt(1 + t ** 2) - t * Math.sqrt(1 + Math.tan(φ) ** 2);

	let ξ = Math.atan2(τ, Math.cos(l));
	let η = Math.asinh(Math.sin(l) / Math.sqrt(τ ** 2 + Math.cos(l) ** 2));

	let ξ2 = ξ;
	let η2 = η;
	for (let j = 0; j < 3; j++) {
		const s = 2 * (j + 1);
		ξ2 += α[j] * Math.sin(s * ξ) * Math.cosh(s * η);
		η2 += α[j] * Math.cos(s * ξ) * Math.sinh(s * η);
	}

	return [A_RECT * K0 * η2 + FE, A_RECT * K0 * ξ2];
}

/**
 * Coordinates in Finnish GIS exports are large numbers; WGS84 degrees are not.
 * That difference is a reliable way to guess which system a file is in.
 */
export function looksLikeTm35fin(x: number, y: number): boolean {
	return Math.abs(x) > 1000 || Math.abs(y) > 1000;
}

/** Reproject a GeoJSON geometry tree in place-ish, returning a new object. */
export function reprojectGeoJson<T>(node: T): T {
	const convert = (coords: unknown): unknown => {
		if (!Array.isArray(coords)) return coords;
		if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
			const [x, y] = coords as number[];
			return looksLikeTm35fin(x, y) ? tm35finToWgs84(x, y) : [x, y];
		}
		return coords.map(convert);
	};

	const walk = (obj: any): any => {
		if (Array.isArray(obj)) return obj.map(walk);
		if (obj && typeof obj === 'object') {
			const out: any = {};
			for (const [k, v] of Object.entries(obj)) {
				out[k] = k === 'coordinates' ? convert(v) : walk(v);
			}
			return out;
		}
		return obj;
	};

	return walk(node);
}

/** Bounding box [W, S, E, N] of any GeoJSON object. */
export function geoJsonBounds(geo: any): [number, number, number, number] | null {
	let w = Infinity,
		s = Infinity,
		e = -Infinity,
		n = -Infinity;

	const visit = (c: any) => {
		if (!Array.isArray(c)) return;
		if (typeof c[0] === 'number' && typeof c[1] === 'number') {
			w = Math.min(w, c[0]);
			e = Math.max(e, c[0]);
			s = Math.min(s, c[1]);
			n = Math.max(n, c[1]);
			return;
		}
		c.forEach(visit);
	};

	const walk = (obj: any) => {
		if (Array.isArray(obj)) return obj.forEach(walk);
		if (obj && typeof obj === 'object') {
			for (const [k, v] of Object.entries(obj)) {
				if (k === 'coordinates') visit(v);
				else walk(v);
			}
		}
	};

	walk(geo);
	return Number.isFinite(w) ? [w, s, e, n] : null;
}

// --- polygon measures ------------------------------------------------------
// Used for hand-drawn garden boundaries. Projecting to TM35FIN before applying
// the shoelace formula keeps the numbers honest at Finnish latitudes, where a
// degree of longitude is barely half a degree of latitude on the ground.

export type Ring = [number, number][];

/** Area of a WGS84 ring in hectares. */
export function ringAreaHectares(ring: Ring): number {
	if (ring.length < 3) return 0;
	const projected = ring.map(([lon, lat]) => wgs84ToTm35fin(lon, lat));
	let twiceArea = 0;
	for (let i = 0; i < projected.length; i++) {
		const [x1, y1] = projected[i];
		const [x2, y2] = projected[(i + 1) % projected.length];
		twiceArea += x1 * y2 - x2 * y1;
	}
	return Math.abs(twiceArea / 2) / 10000;
}

/** Perimeter of a WGS84 ring in metres. */
export function ringPerimeterMeters(ring: Ring): number {
	if (ring.length < 2) return 0;
	let total = 0;
	for (let i = 0; i < ring.length; i++) {
		const [lon1, lat1] = ring[i];
		const [lon2, lat2] = ring[(i + 1) % ring.length];
		total += distanceMeters(lat1, lon1, lat2, lon2);
	}
	return total;
}

/**
 * Area centroid of a ring, which is where the map should open. A plain average
 * of the vertices would drift towards whichever edge the owner clicked most
 * while drawing.
 */
export function ringCentroid(ring: Ring): [number, number] | null {
	if (ring.length < 3) return null;
	const projected = ring.map(([lon, lat]) => wgs84ToTm35fin(lon, lat));
	let twiceArea = 0;
	let cx = 0;
	let cy = 0;
	for (let i = 0; i < projected.length; i++) {
		const [x1, y1] = projected[i];
		const [x2, y2] = projected[(i + 1) % projected.length];
		const cross = x1 * y2 - x2 * y1;
		twiceArea += cross;
		cx += (x1 + x2) * cross;
		cy += (y1 + y2) * cross;
	}
	if (twiceArea === 0) {
		// Degenerate ring (all points collinear): fall back to the mean.
		const n = ring.length;
		return [
			ring.reduce((s, p) => s + p[0], 0) / n,
			ring.reduce((s, p) => s + p[1], 0) / n
		];
	}
	const [lon, lat] = tm35finToWgs84(cx / (3 * twiceArea), cy / (3 * twiceArea));
	return [lon, lat];
}

/** Wrap a drawn ring as a GeoJSON Polygon, closing it if the user did not. */
export function ringToPolygon(ring: Ring): { type: 'Polygon'; coordinates: Ring[] } | null {
	if (ring.length < 3) return null;
	const closed = [...ring];
	const [fx, fy] = closed[0];
	const [lx, ly] = closed[closed.length - 1];
	if (fx !== lx || fy !== ly) closed.push([fx, fy]);
	return { type: 'Polygon', coordinates: [closed] };
}

/** The drawable ring inside a stored Polygon, without the closing duplicate. */
export function polygonToRing(polygon: unknown): Ring {
	const coords = (polygon as { coordinates?: Ring[] } | null)?.coordinates?.[0];
	if (!Array.isArray(coords) || coords.length < 3) return [];
	const ring = [...coords];
	const [fx, fy] = ring[0];
	const [lx, ly] = ring[ring.length - 1];
	if (fx === lx && fy === ly) ring.pop();
	return ring;
}

/**
 * A world file (.jgw / .pgw / .tfw) pins a plain image to the ground: pixel
 * size, rotation, and the centre of the top-left pixel, six numbers on six
 * lines. Combined with the image's pixel dimensions it gives us the corner
 * coordinates MapLibre wants.
 */
export interface WorldFile {
	pixelSizeX: number;
	rotationY: number;
	rotationX: number;
	pixelSizeY: number;
	originX: number;
	originY: number;
}

export function parseWorldFile(text: string): WorldFile | null {
	const n = text
		.split(/\r?\n/)
		.map((l) => parseFloat(l.trim()))
		.filter((v) => Number.isFinite(v));
	if (n.length < 6) return null;
	return {
		pixelSizeX: n[0],
		rotationY: n[1],
		rotationX: n[2],
		pixelSizeY: n[3],
		originX: n[4],
		originY: n[5]
	};
}

/**
 * Corner coordinates for an image overlay, clockwise from top-left, in the
 * order MapLibre's image source expects.
 */
export function worldFileCorners(
	wf: WorldFile,
	widthPx: number,
	heightPx: number,
	crs: 'tm35fin' | 'wgs84'
): [number, number][] {
	// World file origin is the *centre* of the top-left pixel; shift by half a
	// pixel to reach the actual image corner.
	const x0 = wf.originX - wf.pixelSizeX / 2;
	const y0 = wf.originY - wf.pixelSizeY / 2;
	const x1 = x0 + wf.pixelSizeX * widthPx;
	const y1 = y0 + wf.pixelSizeY * heightPx;

	const raw: [number, number][] = [
		[x0, y0],
		[x1, y0],
		[x1, y1],
		[x0, y1]
	];

	return crs === 'tm35fin' ? raw.map(([x, y]) => tm35finToWgs84(x, y)) : raw;
}
