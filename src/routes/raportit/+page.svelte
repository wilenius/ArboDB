<script lang="ts">
	import { fetchObservations, fetchPlantings, fetchTaxa } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { session } from '$lib/supabase';
	import { t } from '$lib/i18n';

	let summary = $state({ taxa: 0, plantings: 0, trees: 0, specimens: 0, observations: 0, published: 0 });
	let loading = $state(true);

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		const [taxa, plantings, observations] = await Promise.all([
			fetchTaxa(),
			fetchPlantings(gardens.active?.id),
			fetchObservations({ gardenId: gardens.active?.id })
		]);
		summary = {
			taxa: taxa.length,
			plantings: plantings.length,
			trees: plantings.reduce((n, p) => n + (p.trees?.length ?? 0), 0),
			specimens: plantings.reduce((n, p) => n + (p.count_planted ?? 0), 0),
			observations: observations.length,
			published: plantings.filter((p) => p.published).length
		};
		loading = false;
	}

	const REPORTS = [
		{ href: '/raportit/rekisteri', title: t.reports.registry, help: t.reports.registryHelp },
		{ href: '/raportit/havainnot', title: t.reports.observations, help: t.reports.observationsHelp },
		{ href: '/raportit/kasvu', title: t.reports.growth, help: t.reports.growthHelp },
		{ href: '/raportit/kuvat', title: t.reports.gallery, help: t.reports.galleryHelp }
	];
</script>

<svelte:head><title>{t.reports.title} — {t.app.name}</title></svelte:head>

<div class="section">
	<h1>{t.reports.title}</h1>

	<!-- The registry's shape in six numbers. Mono, tabular, no chart: these are
	     counts to be read, not magnitudes to be compared. -->
	<dl class="tallies">
		<div><dt>{t.reports.taxaCount}</dt><dd class="data">{loading ? '—' : summary.taxa}</dd></div>
		<div><dt>{t.reports.plantingCount}</dt><dd class="data">{loading ? '—' : summary.plantings}</dd></div>
		<div><dt>{t.reports.treeCount}</dt><dd class="data">{loading ? '—' : summary.trees}</dd></div>
		<div><dt>{t.reports.specimenCount}</dt><dd class="data">{loading ? '—' : summary.specimens}</dd></div>
		<div><dt>{t.reports.observationCount}</dt><dd class="data">{loading ? '—' : summary.observations}</dd></div>
		<div><dt>{t.planting.published}</dt><dd class="data">{loading ? '—' : summary.published}</dd></div>
	</dl>

	<ul class="reports">
		{#each REPORTS as report (report.href)}
			<li>
				<a href={report.href}>
					<strong>{report.title}</strong>
					<span class="muted">{report.help}</span>
				</a>
			</li>
		{/each}
	</ul>

	<hr class="rule" />

	<p>
		<a href="/julkinen">{t.reports.publicView} ↗</a>
		<span class="muted small"> — {t.publicSite.intro}</span>
	</p>
</div>

<style>
	.tallies {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: 1px;
		margin: 1.25rem 0 1.5rem;
		background: var(--hairline);
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.tallies > div {
		background: var(--paper-raised);
		padding: 0.7rem 0.8rem 0.8rem;
	}

	dt {
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--bark);
		font-family: var(--font-data);
	}

	dd {
		margin: 0.15rem 0 0;
		font-size: 1.6rem;
		font-weight: 500;
		letter-spacing: -0.03em;
	}

	.reports {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
	}

	.reports a {
		display: block;
		padding: 0.85rem 0.95rem;
		border: 1px solid var(--hairline-strong);
		border-left-width: 3px;
		border-left-color: var(--moss);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--ink);
		background: var(--paper-raised);
		height: 100%;
	}

	.reports a:hover {
		background: color-mix(in oklab, var(--moss) 7%, var(--paper-raised));
	}

	.reports strong {
		display: block;
		font-family: var(--font-display);
		font-size: 1.0625rem;
		font-weight: 500;
		margin-bottom: 0.15rem;
	}

	.reports span {
		font-size: 0.8125rem;
	}

	.small {
		font-size: 0.8125rem;
	}
</style>
