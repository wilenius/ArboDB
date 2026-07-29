export type OriginType = 'planted' | 'original';
export type PlantingStatus = 'active' | 'removed' | 'dead';
export type TreeStatus = 'alive' | 'dead' | 'removed';
export type PositionSource = 'gps' | 'manual';
export type ObservationKind = 'growth' | 'care' | 'damage' | 'phenology' | 'other';

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

export interface Planting {
	id: string;
	taxon_id: string;
	accession_code: string | null;
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

export interface Tag {
	id: string;
	name: string;
	color: string;
}

export interface Observation {
	id: string;
	planting_id: string;
	tree_id: string | null;
	observed_at: string;
	kind: ObservationKind;
	height_cm: number | null;
	diameter_mm: number | null;
	body: string | null;
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
