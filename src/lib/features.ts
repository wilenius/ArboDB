/**
 * How a drawn feature looks on the map.
 *
 * The palette is picked to survive an aerial photograph rather than to match
 * the app's paper-and-moss interface: over a summer canopy, moss green is
 * invisible. Each kind gets a hue that does not occur in the imagery beneath
 * it, and the dashed/solid split carries meaning on its own — a dashed line is
 * something you walk along or that keeps things out, a solid one is built.
 *
 * `line-dasharray` is not a data-driven property in MapLibre, so the kinds are
 * split into two line layers by pattern and the colour varies within each. That
 * is the whole reason DASHED exists as a set rather than a flag per kind.
 */
import type { FeatureKind } from './types';

export interface FeatureStyle {
	color: string;
	width: number;
}

export const FEATURE_STYLE: Record<FeatureKind, FeatureStyle> = {
	path: { color: '#e0c07a', width: 2.5 },
	wall: { color: '#b9b3a6', width: 3.5 },
	fence: { color: '#d98a6a', width: 2 },
	ditch: { color: '#7fc4e0', width: 2 },
	lawn: { color: '#9ad06f', width: 1.5 },
	bed: { color: '#c99b6a', width: 1.5 },
	building: { color: '#cfc6b4', width: 1.5 },
	other: { color: '#c9a9e0', width: 2 }
};

/** Walked or barrier-like: drawn as a dashed line. */
export const DASHED_KINDS: FeatureKind[] = ['path', 'fence', 'other'];

/** A MapLibre `match` expression mapping kind to colour, for data-driven paint. */
export function colorByKind(): unknown[] {
	const pairs = Object.entries(FEATURE_STYLE).flatMap(([kind, style]) => [kind, style.color]);
	return ['match', ['get', 'kind'], ...pairs, FEATURE_STYLE.other.color];
}

export function widthByKind(): unknown[] {
	const pairs = Object.entries(FEATURE_STYLE).flatMap(([kind, style]) => [kind, style.width]);
	return ['match', ['get', 'kind'], ...pairs, FEATURE_STYLE.other.width];
}
