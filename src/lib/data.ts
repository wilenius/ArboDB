import { supabase } from './supabase';
import { distanceMeters } from './geo';
import type {
	MapFeature,
	MapLayer,
	Observation,
	Photo,
	Placement,
	PlacementReason,
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

// --- placements ------------------------------------------------------------

/**
 * Where this tree, or this batch, has stood. Oldest first: a timeline reads
 * forwards, unlike the observation feed.
 *
 * A tree's history is its own rows only. The batch centroid is a separate
 * track (`tree_id is null`) because a planting with individually tracked
 * specimens positions itself by them, not by the centroid.
 */
export async function fetchPlacements(target: {
	plantingId: string;
	treeId?: string | null;
}): Promise<Placement[]> {
	let q = supabase
		.from('placements')
		.select('*, gardens (id, name)')
		.eq('planting_id', target.plantingId);
	q = target.treeId ? q.eq('tree_id', target.treeId) : q.is('tree_id', null);
	const { data, error } = await q
		.order('occurred_on', { ascending: true })
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data as unknown as Placement[];
}

/**
 * Record a move. The trigger on `placements` pulls the tree's cached position
 * along with it, so nothing else has to be updated here — and deliberately so:
 * writing both by hand is how the two drift apart.
 */
export async function recordPlacement(values: {
	planting_id: string;
	tree_id?: string | null;
	garden_id?: string | null;
	lat: number;
	lon: number;
	accuracy_m?: number | null;
	source?: 'gps' | 'manual';
	reason: PlacementReason;
	provisional?: boolean;
	occurred_on: string;
	note?: string | null;
}): Promise<void> {
	const { error } = await supabase.from('placements').insert({
		tree_id: null,
		source: 'manual',
		provisional: false,
		...values
	});
	if (error) throw error;
}

/**
 * Plantings still standing in a pot or a nursery bed — that is, whose newest
 * placement is flagged provisional. Only the newest counts: a tree that spent
 * two years in a holding row and has since been planted out is not waiting for
 * anything.
 *
 * Resolved here rather than in SQL because it needs the latest row per target
 * and a few hundred placements is not worth a view for.
 */
export async function fetchProvisionalPlantingIds(
	plantingIds: string[]
): Promise<Set<string>> {
	const provisional = new Set<string>();
	if (!plantingIds.length) return provisional;

	const { data, error } = await supabase
		.from('placements')
		.select('planting_id, tree_id, provisional, occurred_on, created_at')
		.in('planting_id', plantingIds)
		.order('occurred_on', { ascending: false })
		.order('created_at', { ascending: false });
	if (error) throw error;

	// Rows arrive newest first, so the first sighting of a target is the one in
	// force and every later row for it is history.
	const seen = new Set<string>();
	for (const row of data ?? []) {
		const key = `${row.planting_id}:${row.tree_id ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		if (row.provisional) provisional.add(row.planting_id);
	}

	return provisional;
}

export async function fetchTags(): Promise<Tag[]> {
	const { data, error } = await supabase.from('tags').select('*').order('name');
	if (error) throw error;
	return data as Tag[];
}

const OBSERVATION_SELECT = `
	*,
	observation_tags ( tag_id, tags (*) ),
	photos (*),
	trees ( id, label, status ),
	plantings ( id, garden_id, accession_code, count_planted, incomplete, taxa (*) )
`;

export async function fetchObservations(opts: {
	plantingId?: string;
	treeId?: string;
	gardenId?: string | null;
	from?: string;
	to?: string;
	kind?: string;
	/** 'garden' keeps only diary entries; 'planting' only tree and batch ones. */
	scope?: 'garden' | 'planting';
	limit?: number;
} = {}): Promise<Observation[]> {
	// Observations carry their own garden_id since diary entries need not hang
	// off a planting at all, which also means the filter no longer has to reach
	// through an embedded resource with `!inner`.
	let q = supabase.from('observations').select(OBSERVATION_SELECT);
	if (opts.gardenId) q = q.eq('garden_id', opts.gardenId);
	if (opts.plantingId) q = q.eq('planting_id', opts.plantingId);
	if (opts.treeId) q = q.eq('tree_id', opts.treeId);
	if (opts.scope === 'garden') q = q.is('planting_id', null);
	if (opts.scope === 'planting') q = q.not('planting_id', 'is', null);
	if (opts.from) q = q.gte('observed_at', opts.from);
	if (opts.to) q = q.lte('observed_at', opts.to);
	if (opts.kind) q = q.eq('kind', opts.kind);
	q = q.order('observed_at', { ascending: false });
	if (opts.limit) q = q.limit(opts.limit);
	const { data, error } = await q;
	if (error) throw error;
	return data as unknown as Observation[];
}

export async function deleteObservation(observation: Observation): Promise<void> {
	const paths = (observation.photos ?? []).flatMap((photo) =>
		[photo.storage_path, photo.thumb_path].filter((path): path is string => Boolean(path))
	);
	const { error } = await supabase.from('observations').delete().eq('id', observation.id);
	if (error) throw error;

	// The record is the source of truth. If file cleanup fails, leave harmless
	// orphan objects rather than a visible observation with broken photos.
	if (paths.length) {
		const { error: storageError } = await supabase.storage
			.from('photos')
			.remove([...new Set(paths)]);
		if (storageError) console.error('Failed to remove observation photos', storageError);
	}
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

/** Hand-drawn paths, walls, lawns and fences for one plot. */
export async function fetchFeatures(gardenId?: string | null): Promise<MapFeature[]> {
	let q = supabase.from('features').select('*');
	if (gardenId) q = q.eq('garden_id', gardenId);
	const { data, error } = await q.order('sort_order').order('created_at');
	if (error) throw error;
	return data as MapFeature[];
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
