export type OriginType = 'planted' | 'original';
export type PlantingStatus = 'active' | 'removed' | 'dead';
export type TreeStatus = 'alive' | 'dead' | 'removed';
export type PositionSource = 'gps' | 'manual';
export type PlacementReason = 'acquired' | 'planted' | 'moved' | 'corrected';
export type ObservationKind =
	| 'growth'
	| 'care'
	| 'damage'
	| 'phenology'
	| 'weather'
	| 'other';

export interface Taxon {
	id: string;
	genus: string;
	species: string | null;
	infraspecific_rank: string | null;
	infraspecific_epithet: string | null;
	cultivar: string | null;
	name_fi: string | null;
	mustila_url: string | null;
	notes: string | null;
}

export type BoundarySource = 'drawn' | 'imported' | 'survey' | 'mml';

export interface Garden {
	id: string;
	name: string;
	notes: string | null;
	center_lat: number | null;
	center_lon: number | null;
	default_zoom: number;
	/** GeoJSON Polygon geometry in WGS84, or null until one is drawn. */
	boundary: { type: 'Polygon'; coordinates: [number, number][][] } | null;
	boundary_source: BoundarySource;
	sort_order: number;
}

export interface Planting {
	id: string;
	garden_id: string | null;
	/** Null while a field record is still waiting to be identified. */
	taxon_id: string | null;
	accession_code: string | null;
	/** Started next to the tree, still to be finished at a keyboard. */
	incomplete: boolean;
	planted_year: number | null;
	planted_month: number | null;
	count_planted: number;
	seedling_size_cm: number | null;
	propagation: string | null;
	provenance: string | null;
	origin_type: OriginType;
	status: PlantingStatus;
	status_changed_at: string | null;
	lat: number | null;
	lon: number | null;
	radius_m: number | null;
	published: boolean;
	notes: string | null;
	taxa?: Taxon;
	trees?: Tree[];
}

export interface Tree {
	id: string;
	planting_id: string;
	label: string | null;
	lat: number | null;
	lon: number | null;
	position_accuracy_m: number | null;
	position_source: PositionSource | null;
	status: TreeStatus;
	status_changed_at: string | null;
	notes: string | null;
	plantings?: Planting;
}

/**
 * One position a tree or a batch has held. The newest is the current one; the
 * rest are history. `corrected` rows are bookkeeping — the record was wrong,
 * not the tree in a different place — and are kept out of the timeline.
 */
export interface Placement {
	id: string;
	planting_id: string;
	tree_id: string | null;
	garden_id: string | null;
	lat: number | null;
	lon: number | null;
	accuracy_m: number | null;
	source: PositionSource | null;
	reason: PlacementReason;
	/** A pot or a nursery bed: alive and positioned, but not its final spot. */
	provisional: boolean;
	occurred_on: string;
	note: string | null;
	created_at: string;
	gardens?: Garden;
}

/** Only these three mean the tree was somewhere else; the fourth is a fix. */
export const MOVEMENT_REASONS: PlacementReason[] = ['acquired', 'planted', 'moved'];

export interface Tag {
	id: string;
	name: string;
	color: string;
}

export interface Observation {
	id: string;
	garden_id: string;
	/** Null for a diary entry about the plot rather than about a planting. */
	planting_id: string | null;
	tree_id: string | null;
	observed_at: string;
	kind: ObservationKind;
	height_cm: number | null;
	diameter_mm: number | null;
	body: string | null;
	/** Where it happened, for entries that are about a place, not a tree. */
	lat: number | null;
	lon: number | null;
	accuracy_m: number | null;
	radius_m: number | null;
	observation_tags?: { tag_id: string; tags?: Tag }[];
	plantings?: Planting;
	trees?: Tree;
	photos?: Photo[];
}

export interface Photo {
	id: string;
	observation_id: string | null;
	tree_id: string | null;
	planting_id: string | null;
	storage_path: string;
	thumb_path: string | null;
	taken_at: string | null;
	caption: string | null;
}

export interface MapLayer {
	id: string;
	name: string;
	kind: 'geojson' | 'image';
	storage_path: string | null;
	geojson: unknown | null;
	bounds: number[] | null;
	opacity: number;
	visible: boolean;
	sort_order: number;
}

/** A tree or a whole batch, whichever the observation is about. */
export interface Target {
	kind: 'tree' | 'planting';
	tree: Tree | null;
	planting: Planting;
	lat: number | null;
	lon: number | null;
	distance_m: number | null;
}
