<script lang="ts">
	import SciName from './SciName.svelte';
	import { formatDistance, formatPlantedDate } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Target } from '$lib/types';

	let {
		target,
		href,
		showDistance = true,
		compact = false
	}: {
		target: Target;
		href?: string;
		showDistance?: boolean;
		compact?: boolean;
	} = $props();

	const planting = $derived(target.planting);
	const tree = $derived(target.tree);

	// The stripe on the stake edge follows whichever record is being shown.
	const status = $derived(
		tree ? tree.status : planting.status === 'active' ? 'alive' : planting.status
	);

	const link = $derived(
		href ?? (tree ? `/puu/${tree.id}` : `/istutus/${planting.id}`)
	);
</script>

<a class="plate" data-status={status} href={link}>
	<span class="accession">{planting.accession_code ?? '—'}{tree?.label ? ` ${tree.label}` : ''}</span>

	<SciName taxon={planting.taxa} />
	{#if planting.taxa?.name_fi}
		<span class="vernacular">{planting.taxa.name_fi}</span>
	{/if}

	{#if !compact}
		<span class="plate-meta">
			<span>{formatPlantedDate(planting.planted_year, planting.planted_month)}</span>
			{#if tree}
				<span>{t.enums.treeStatus[tree.status]}</span>
			{:else}
				<span>{t.planting.specimens(planting.count_planted)}</span>
			{/if}
			{#if planting.origin_type === 'original'}
				<span class="original">{t.enums.originType.original}</span>
			{/if}
			{#if showDistance && target.distance_m != null}
				<span class="plate-distance">{formatDistance(target.distance_m)}</span>
			{/if}
		</span>
	{/if}
</a>

<style>
	.original {
		color: #d9ac52;
	}
</style>
