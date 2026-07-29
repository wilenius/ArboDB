<script lang="ts">
	import SciName from '$lib/components/SciName.svelte';
	import Plate from '$lib/components/Plate.svelte';
	import { supabase } from '$lib/supabase';
	import { formatDate, formatPlantedDate } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Garden, Observation, Planting, Target } from '$lib/types';

	/**
	 * The public face of the arboretum. It reads with the anon key, so row level
	 * security — not this component — decides what is visible: only plantings the
	 * owner has flagged `published`, and only their taxa, specimens and
	 * observations. Nothing here needs an account.
	 */

	let plantings = $state<Planting[]>([]);
	let observations = $state<Observation[]>([]);
	let publicGardens = $state<Garden[]>([]);
	let loading = $state(true);

	$effect(() => {
		load();
	});

	async function load() {
		const [{ data: p }, { data: o }, { data: g }] = await Promise.all([
			supabase
				.from('plantings')
				.select('*, taxa (*), trees (*)')
				.order('planted_year', { ascending: true, nullsFirst: false }),
			supabase
				.from('observations')
				.select('*, plantings ( id, accession_code, taxa (*) ), trees ( id, label, status )')
				.order('observed_at', { ascending: false })
				.limit(20),
			// RLS only exposes a garden once something in it is published.
			supabase.from('gardens').select('*').order('sort_order')
		]);
		plantings = (p ?? []) as Planting[];
		observations = (o ?? []) as Observation[];
		publicGardens = (g ?? []) as Garden[];
		loading = false;
	}

	const gardenNames = $derived(publicGardens.map((x) => x.name).join(' · '));

	function asTarget(p: Planting): Target {
		return { kind: 'planting', tree: null, planting: p, lat: p.lat, lon: p.lon, distance_m: null };
	}

	const specimens = $derived(plantings.reduce((n, p) => n + (p.count_planted ?? 0), 0));
	const genera = $derived(new Set(plantings.map((p) => p.taxa?.genus).filter(Boolean)).size);
</script>

<svelte:head><title>{t.publicSite.title}</title></svelte:head>

<div class="public">
	<header class="public-head">
		<div class="section">
			<p class="eyebrow">{gardenNames || t.app.name}</p>
			<h1>{t.publicSite.title}</h1>
			<p class="intro">{t.publicSite.intro}</p>
			<p class="stats data">
				{plantings.length} istutusta · {specimens} tainta · {genera} sukua
			</p>
		</div>
	</header>

	<div class="section">
		{#if loading}
			<p class="muted">{t.common.loading}</p>
		{:else if !plantings.length}
			<p class="empty">{t.publicSite.empty}</p>
		{:else}
			<ul class="grid">
				{#each plantings as planting (planting.id)}
					<li>
						<div class="plate-static">
							<Plate target={asTarget(planting)} showDistance={false} href="#" />
						</div>
						<dl class="mini">
							<div>
								<dt>Istutettu</dt>
								<dd class="data">
									{formatPlantedDate(planting.planted_year, planting.planted_month)}
								</dd>
							</div>
							{#if planting.provenance}
								<div><dt>Alkuperä</dt><dd>{planting.provenance}</dd></div>
							{/if}
							{#if planting.taxa?.mustila_url}
								<div>
									<dt>Lisätietoa</dt>
									<dd>
										<a href={planting.taxa.mustila_url} target="_blank" rel="noopener">Mustila ↗</a>
									</dd>
								</div>
							{/if}
						</dl>
					</li>
				{/each}
			</ul>

			{#if observations.length}
				<h2 class="obs-heading">{t.observation.latest}</h2>
				<ul class="obs-list">
					{#each observations as observation (observation.id)}
						<li>
							<span class="kind" data-kind={observation.kind}>
								{t.enums.kind[observation.kind]}
							</span>
							<time class="data muted" datetime={observation.observed_at}>
								{formatDate(observation.observed_at)}
							</time>
							<SciName taxon={observation.plantings?.taxa} />
							{#if observation.body}
								<p>{observation.body}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}

		<hr class="rule" />
		<p><a href="/kirjaudu">{t.publicSite.backToApp}</a></p>
	</div>
</div>

<style>
	.public-head {
		background: var(--paper-sunk);
		border-bottom: 1px solid var(--hairline);
		padding: 1.5rem 0 1.75rem;
		margin-bottom: 1.5rem;
	}

	.intro {
		max-width: 34rem;
		color: var(--ink-soft);
	}

	.stats {
		margin: 0;
		color: var(--bark);
	}

	.grid {
		list-style: none;
		margin: 0 0 2rem;
		padding: 0;
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
	}

	/* Nothing on the public page is clickable through to the private app. */
	.plate-static :global(a.plate) {
		cursor: default;
		pointer-events: none;
	}

	.mini {
		margin: 0.5rem 0 0 0.15rem;
	}

	.mini > div {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: 0.5rem;
		padding: 0.15rem 0;
		font-size: 0.8125rem;
	}

	dt {
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--bark);
		font-family: var(--font-data);
		padding-top: 0.1rem;
	}

	dd {
		margin: 0;
	}

	.obs-heading {
		margin-bottom: 0.75rem;
	}

	.obs-list {
		list-style: none;
		margin: 0 0 1.5rem;
		padding: 0;
		border-top: 1px solid var(--hairline);
	}

	.obs-list li {
		padding: 0.7rem 0;
		border-bottom: 1px solid var(--hairline);
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.obs-list p {
		flex-basis: 100%;
		margin: 0.2rem 0 0;
		color: var(--ink-soft);
	}
</style>
