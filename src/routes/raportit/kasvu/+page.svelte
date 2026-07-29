<script lang="ts">
	import GrowthChart from '$lib/components/GrowthChart.svelte';
	import { fetchObservations } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { session } from '$lib/supabase';
	import { t } from '$lib/i18n';
	import type { Observation } from '$lib/types';

	let observations = $state<Observation[]>([]);
	let loading = $state(true);

	$effect(() => {
		if ($session)
			fetchObservations({ gardenId: gardens.active?.id }).then((x) => {
				observations = x;
				loading = false;
			});
	});

	// One chart per planting: comparing a magnolia's height with a spruce's says
	// nothing, but comparing specimens inside one batch says a lot.
	const byPlanting = $derived.by(() => {
		const measured = observations.filter(
			(o) => o.height_cm != null || o.diameter_mm != null
		);
		const map = new Map<string, Observation[]>();
		for (const o of measured) {
			if (!map.has(o.planting_id)) map.set(o.planting_id, []);
			map.get(o.planting_id)!.push(o);
		}
		return [...map.values()]
			.filter((group) => group.length > 1)
			.sort((a, b) => b.length - a.length);
	});
</script>

<svelte:head><title>{t.reports.growth} — {t.app.name}</title></svelte:head>

<div class="section">
	<p class="eyebrow no-print"><a href="/raportit">{t.reports.title}</a></p>

	<div class="head">
		<h1>{t.reports.growth}</h1>
		<button class="btn btn-sm no-print" type="button" onclick={() => window.print()}>
			{t.common.print}
		</button>
	</div>

	{#if loading}
		<p class="muted">{t.common.loading}</p>
	{:else if !byPlanting.length}
		<p class="empty">{t.reports.noData}</p>
	{:else}
		{#each byPlanting as group (group[0].planting_id)}
			{@const planting = group[0].plantings}
			<section class="chart-block">
				<p class="chart-target">
					<a href="/istutus/{group[0].planting_id}">
						<span class="data">{planting?.accession_code}</span>
					</a>
					{#if planting?.taxa?.name_fi}
						<span class="vernacular">{planting.taxa.name_fi}</span>
					{/if}
				</p>
				<GrowthChart observations={group} taxon={planting?.taxa ?? null} />
			</section>
		{/each}
	{/if}
</div>

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}

	.chart-block {
		margin-bottom: 1.5rem;
		break-inside: avoid;
	}

	.chart-target {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin: 0 0 0.35rem;
	}

	.chart-target a {
		text-decoration: none;
		color: var(--ink);
		font-size: 1.05rem;
		border-bottom: 1px solid var(--hairline-strong);
	}
</style>
