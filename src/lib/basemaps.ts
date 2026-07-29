import { PUBLIC_MML_API_KEY } from '$env/static/public';
import type { StyleSpecification } from 'maplibre-gl';

/**
 * Basemaps.
 *
 * Positioning a seedling under a spruce canopy needs aerial imagery, and in
 * Finland that means Maanmittauslaitos' open WMTS. It requires a free API key,
 * so the app degrades gracefully: with a key you get the orthophoto and the
 * topographic map, without one you still get OpenStreetMap and every layer the
 * owner has imported himself.
 *
 * Note the tile template order — MML serves WMTS as {TileMatrix}/{TileRow}/
 * {TileCol}, which is z/y/x, not the z/x/y most XYZ services use.
 */

export const hasMml = Boolean(PUBLIC_MML_API_KEY);

const MML_BASE = 'https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0';

function mmlTiles(layer: string, ext: 'jpg' | 'png'): string {
	return `${MML_BASE}/${layer}/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.${ext}?api-key=${PUBLIC_MML_API_KEY}`;
}

export type BasemapId = 'aerial' | 'terrain' | 'osm' | 'blank';

interface BasemapDef {
	id: BasemapId;
	tiles: string[] | null;
	attribution: string;
	requiresMml: boolean;
	/** Aerial imagery is dark; markers and labels need light ink over it. */
	dark: boolean;
}

export const BASEMAPS: Record<BasemapId, BasemapDef> = {
	aerial: {
		id: 'aerial',
		tiles: [mmlTiles('ortokuva', 'jpg')],
		attribution: '© Maanmittauslaitos, ilmakuva',
		requiresMml: true,
		dark: true
	},
	terrain: {
		id: 'terrain',
		tiles: [mmlTiles('maastokartta', 'png')],
		attribution: '© Maanmittauslaitos, maastokartta',
		requiresMml: true,
		dark: false
	},
	osm: {
		id: 'osm',
		tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
		attribution: '© OpenStreetMap-tekijät',
		requiresMml: false,
		dark: false
	},
	blank: { id: 'blank', tiles: null, attribution: '', requiresMml: false, dark: false }
};

export const DEFAULT_BASEMAP: BasemapId = hasMml ? 'aerial' : 'osm';

export function availableBasemaps(): BasemapDef[] {
	return Object.values(BASEMAPS).filter((b) => !b.requiresMml || hasMml);
}

export function buildStyle(id: BasemapId): StyleSpecification {
	const def = BASEMAPS[id] ?? BASEMAPS.osm;
	const style: StyleSpecification = {
		version: 8,
		glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
		sources: {},
		layers: [
			{
				id: 'background',
				type: 'background',
				paint: { 'background-color': def.dark ? '#1b2b21' : '#eaeee4' }
			}
		]
	};

	if (def.tiles) {
		style.sources.basemap = {
			type: 'raster',
			tiles: def.tiles,
			tileSize: 256,
			maxzoom: 19,
			attribution: def.attribution
		};
		style.layers.push({ id: 'basemap', type: 'raster', source: 'basemap' });
	}

	return style;
}
