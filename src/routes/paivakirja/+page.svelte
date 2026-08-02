<script lang="ts">
	/**
	 * One timeline for the whole plot.
	 *
	 * Deliberately not a second feed alongside the per-tree observations: it is
	 * the same rows, unfiltered. What happened in the arboretum this spring is
	 * one question, and answering it should not mean reading a tree log and a
	 * work log side by side and merging them by eye.
	 */
	import ObservationCard from '$lib/components/ObservationCard.svelte';
	import { fetchObservations } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { session } from '$lib/supabase';
	import { t } from '$lib/i18n';
	import type { Observation, ObservationKind } from '$lib/types';

	let observations = $state<Observation[]>([]);
	let loading = $state(true);
	let error = $state('');

	let scope = $state<'all' | 'garden' | 'planting'>('all');
	let kind = $state<ObservationKind | 'all'>('all');

	$effect(() => {
		if (!$session || !gardens.loaded) return;
		void gardens.active?.id;
		void scope;
		load();
	});

	async function load() {
		loading = true;
		try {
			observations = await fetchObservations({
				gardenId: gardens.active?.id,
				scope: scope === 'all' ? undefined : scope,
				limit: 200
			});
			error = '';
		} catch {
			error = t.errors.load;
		} finally {
			loading = false;
		}
	}

	const filtered = $derived(
		kind === 'all' ? observations : observations.filter((o) => o.kind === kind)
	);

	/** Grouped by month, so a season reads as a season rather than a list. */
	const months = $derived.by(() => {
		const out: { key: string; label: string; rows: Observation[] }[] = [];
		for (const row of filtered) {
			const d = new Date(row.observed_at);
			const key = `${d.getFullYear()}-${d.getMonth()}`;
			const label = `${t.months[d.getMonth()]} ${d.getFullYear()}`;
			const last = out[out.length - 1];
			if (last?.key === key) last.rows.push(row);
			else out.push({ key, label, rows: [row] });
		}
		return out;
	});
</script>

<svelte:head><title>{t.journal.title} — {t.app.name}</title></svelte:head>

<div class="section">
	<div class="head">
		<div>
			<p class="eyebrow">{t.journal.title}</p>
			<h1>{gardens.active?.name ?? t.app.name}</h1>
		</div>
		<a class="btn btn-primary" href="/havainto/uusi">{t.journal.new}</a>
	</div>

	<p class="lead">{t.journal.lead}</p>

	{#if error}<p class="notice notice-error">{error}</p>{/if}

	<div class="filters no-print">
		<div class="filter">
			<label class="filter-label" for="journal-scope">{t.journal.scopeLabel}</label>
			<select id="journal-scope" bind:value={scope}>
				<option value="all">{t.journal.scopeAll}</option>
				<option value="garden">{t.journal.scopeGarden}</option>
				<option value="planting">{t.journal.scopePlanting}</option>
			</select>
		</div>
		<div class="filter">
			<label class="filter-label" for="journal-kind">{t.observation.kind}</label>
			<select id="journal-kind" bind:value={kind}>
				<option value="all">{t.journal.kindAll}</option>
				{#each Object.entries(t.enums.kind) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if loading}
		<p class="muted">{t.common.loading}</p>
	{:else if !filtered.length}
		<p class="empty">{t.journal.empty}</p>
		<p class="muted small">{t.journal.examples}</p>
	{:else}
		{#each months as month (month.key)}
			<section class="month">
				<h2>{month.label}</h2>
				<div class="stack">
					{#each month.rows as observation (observation.id)}
						<ObservationCard
							{observation}
							showTarget
							ondeleted={(id) => {
								observations = observations.filter((row) => row.id !== id);
							}}
						/>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.lead {
		max-width: 52ch;
		color: var(--ink-soft);
		margin-top: 0;
	}

	.filters {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
		align-items: end;
		margin-bottom: 1rem;
	}

	.filter-label {
		display: block;
		font-family: var(--font-data);
		font-size: 0.625rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bark);
		margin-bottom: 0.2rem;
	}

	.month {
		margin-bottom: 1.75rem;
	}

	/* The month is a rule with a word on it, like a divider in a field book. */
	.month h2 {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--bark);
		margin: 0 0 0.6rem;
	}

	.month h2::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--hairline);
	}

	.small {
		font-size: 0.8125rem;
	}

	@media (min-width: 45rem) {
		.filters {
			grid-template-columns: 14rem 14rem;
		}
	}
</style>
