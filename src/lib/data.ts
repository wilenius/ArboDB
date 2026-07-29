import { supabase } from './supabase';
import { distanceMeters } from './geo';
import type {
	MapLayer,
	Observation,
	Photo,
	Planting,
	Tag,
	Target,
	Taxon,
	Tree
} from './types';

const PLANTING_SELECT = `
	*,
	taxa (*),
	trees (*)
`;

export async function fetchTaxa(): Promise<Taxon[]> {
	const { data, error } = await supabase
		.from('taxa')
		.select('*')
		.order('genus')
		.order('species', { nullsFirst: true });
	if (error) throw error;
	return data as Taxon[];
}

/** Scoped to one garden when given; every screen passes the active one. */
export async function fetchPlantings(gardenId?: string | null): Promise<Planting[]> {
	let q = supabase.from('plantings').select(PLANTING_SELECT);
	if (gardenId) q = q.eq('garden_id', gardenId);
	const { data, error } = await q
		.order('planted_year', { ascending: false, nullsFirst: false })
		.order('accession_code', { ascending: false });
	if (error) throw error;
	return data as Planting[];
}

export async function fetchPlanting(id: string): Promise<Planting> {
	const { data, error } = await supabase
		.from('plantings')
		.select(PLANTING_SELECT)
		.eq('id', id)
		.single();
	if (error) throw error;
	return data as Planting;
}

export async function fetchTree(id: string): Promise<Tree> {
	const { data, error } = await supabase
		.from('trees')
		.select(`*, plantings (*, taxa (*))`)
		.eq('id', id)
		.single();
	if (error) throw error;
	return data as Tree;
}

export async function fetchTags(): Promise<Tag[]> {
	const { data, error } = await supabase.from('tags').select('*').order('name');
	if (error) throw error;
	return data as Tag[];
}

const observationSelect = (innerPlanting: boolean) => `
	*,
	observation_tags ( tag_id, tags (*) ),
	photos (*),
	trees ( id, label, status ),
	plantings${innerPlanting ? '!inner' : ''} ( id, garden_id, accession_code, count_planted, taxa (*) )
`;

export async function fetchObservations(opts: {
	plantingId?: string;
	treeId?: string;
	gardenId?: string | null;
	from?: string;
	to?: string;
	kind?: string;
	limit?: number;
} = {}): Promise<Observation[]> {
	// Observations hang off plantings, so a garden filter has to reach through
	// the embedded resource — and it must be an inner join, or PostgREST keeps
	// every parent row and merely blanks the embedded one.
	let q = supabase.from('observations').select(observationSelect(Boolean(opts.gardenId)));
	if (opts.gardenId) q = q.eq('plantings.garden_id', opts.gardenId);
	if (opts.plantingId) q = q.eq('planting_id', opts.plantingId);
	if (opts.treeId) q = q.eq('tree_id', opts.treeId);
	if (opts.from) q = q.gte('observed_at', opts.from);
	if (opts.to) q = q.lte('observed_at', opts.to);
	if (opts.kind) q = q.eq('kind', opts.kind);
	q = q.order('observed_at', { ascending: false });
	if (opts.limit) q = q.limit(opts.limit);
	const { data, error } = await q;
	if (error) throw error;
	// The select string is built at runtime for the inner join, so supabase-js
	// cannot infer the row shape here and needs the widening cast.
	return data as unknown as Observation[];
}

export async function fetchPhotos(): Promise<Photo[]> {
	const { data, error } = await supabase
		.from('photos')
		.select('*')
		.order('taken_at', { ascending: false, nullsFirst: false })
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data as Photo[];
}

export async function fetchMapLayers(): Promise<MapLayer[]> {
	const { data, error } = await supabase
		.from('map_layers')
		.select('*')
		.order('sort_order');
	if (error) throw error;
	return data as MapLayer[];
}

/**
 * Everything that can be stood next to, flattened into one list: individually
 * tracked trees where they exist, plus the centroid of any batch that has no
 * individuals. Distances are computed here rather than in Postgres — a couple
 * of hundred rows is nothing, and it keeps the query a plain PostgREST select.
 */
export function buildTargets(
	plantings: Planting[],
	here: { lat: number; lon: number } | null
): Target[] {
	const out: Target[] = [];

	for (const planting of plantings) {
		const trees = planting.trees ?? [];
		if (trees.length) {
			for (const tree of trees) {
				out.push({
					kind: 'tree',
					tree,
					planting,
					lat: tree.lat,
					lon: tree.lon,
					distance_m:
						here && tree.lat != null && tree.lon != null
							? distanceMeters(here.lat, here.lon, tree.lat, tree.lon)
							: null
				});
			}
		} else {
			out.push({
				kind: 'planting',
				tree: null,
				planting,
				lat: planting.lat,
				lon: planting.lon,
				distance_m:
					here && planting.lat != null && planting.lon != null
						? distanceMeters(here.lat, here.lon, planting.lat, planting.lon)
						: null
			});
		}
	}

	// Positioned targets first, nearest at the top; unpositioned ones sink to
	// the bottom in a stable alphabetical order so they stay findable.
	out.sort((a, b) => {
		if (a.distance_m == null && b.distance_m == null) {
			return (a.planting.accession_code ?? '').localeCompare(
				b.planting.accession_code ?? ''
			);
		}
		if (a.distance_m == null) return 1;
		if (b.distance_m == null) return -1;
		return a.distance_m - b.distance_m;
	});

	return out;
}

export function targetKey(target: Target): string {
	return target.kind === 'tree' ? `tree:${target.tree!.id}` : `planting:${target.planting.id}`;
}

// --- tag maintenance -------------------------------------------------------

/** Move every observation on `fromId` to `toId`, then drop the empty tag. */
export async function mergeTags(fromId: string, toId: string) {
	const { data: rows, error } = await supabase
		.from('observation_tags')
		.select('observation_id')
		.eq('tag_id', fromId);
	if (error) throw error;

	const links = (rows ?? []).map((r) => ({ observation_id: r.observation_id, tag_id: toId }));
	if (links.length) {
		const { error: upErr } = await supabase
			.from('observation_tags')
			.upsert(links, { onConflict: 'observation_id,tag_id', ignoreDuplicates: true });
		if (upErr) throw upErr;
	}

	const { error: delErr } = await supabase.from('tags').delete().eq('id', fromId);
	if (delErr) throw delErr;
}

export async function bulkTag(observationIds: string[], tagId: string, add: boolean) {
	if (!observationIds.length) return;
	if (add) {
		const { error } = await supabase
			.from('observation_tags')
			.upsert(
				observationIds.map((observation_id) => ({ observation_id, tag_id: tagId })),
				{ onConflict: 'observation_id,tag_id', ignoreDuplicates: true }
			);
		if (error) throw error;
	} else {
		const { error } = await supabase
			.from('observation_tags')
			.delete()
			.eq('tag_id', tagId)
			.in('observation_id', observationIds);
		if (error) throw error;
	}
}
