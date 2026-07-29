import { supabase } from './supabase';
import { PUBLIC_MAP_CENTER_LAT, PUBLIC_MAP_CENTER_LON, PUBLIC_MAP_ZOOM } from '$env/static/public';
import type { Garden } from './types';

/**
 * The garden currently being looked at.
 *
 * One garden is all the MVP needs, so the picker only appears once a second one
 * exists — but everything downstream reads the active garden rather than
 * assuming there is exactly one, so adding a second plot is a data change
 * rather than a rewrite.
 */

const STORAGE_KEY = 'arbodb-garden';

/**
 * An unset env variable is `''`, and `Number('')` is 0 — while a misspelt one is
 * NaN. Neither is caught by `??`, so both have to be rejected explicitly or the
 * map opens on null island.
 */
function num(raw: string | undefined, fallback: number): number {
	const n = Number(raw);
	return raw && Number.isFinite(n) ? n : fallback;
}

class GardenStore {
	all = $state<Garden[]>([]);
	activeId = $state<string | null>(null);
	loaded = $state(false);

	active = $derived(this.all.find((g) => g.id === this.activeId) ?? this.all[0] ?? null);
	/** Only worth showing a picker when there is something to pick between. */
	multiple = $derived(this.all.length > 1);

	async load() {
		const { data, error } = await supabase
			.from('gardens')
			.select('*')
			.order('sort_order')
			.order('name');
		if (error) throw error;

		this.all = (data ?? []) as Garden[];

		let remembered: string | null = null;
		try {
			remembered = localStorage.getItem(STORAGE_KEY);
		} catch {
			/* private mode */
		}
		this.activeId =
			(remembered && this.all.some((g) => g.id === remembered) ? remembered : null) ??
			this.all[0]?.id ??
			null;
		this.loaded = true;
	}

	select(id: string) {
		this.activeId = id;
		try {
			localStorage.setItem(STORAGE_KEY, id);
		} catch {
			/* private mode */
		}
	}

	/** Where the map should open for a garden: its centre, or the env fallback. */
	view(garden: Garden | null = this.active): { lat: number; lon: number; zoom: number } {
		return {
			lat: garden?.center_lat ?? num(PUBLIC_MAP_CENTER_LAT, 60.09336),
			lon: garden?.center_lon ?? num(PUBLIC_MAP_CENTER_LON, 23.02110),
			zoom: garden?.default_zoom ?? num(PUBLIC_MAP_ZOOM, 17)
		};
	}
}

export const gardens = new GardenStore();
