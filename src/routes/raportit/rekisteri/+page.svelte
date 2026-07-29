<script lang="ts">
	import SciName from '$lib/components/SciName.svelte';
	import { fetchPlantings } from '$lib/data';
	import { session } from '$lib/supabase';
	import { formatPlantedDate } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Planting } from '$lib/types';

	let plantings = $state<Planting[]>([]);
	let loading = $state(true);
	let groupBy = $state<'year' | 'genus'>('year');

	$effect(() => {
		if ($session) fetchPlantings().then((x) => {
			plantings = x;
			loading = false;
		});
	});

	const groups = $derived.by(() => {
		const map = new Map<string, Planting[]>();
		for (const p of plantings) {
			const key =
				groupBy === 'year'
					? (p.planted_year?.toString() ?? 'Ei vuotta')
					: (p.taxa?.genus ?? '—');
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(p);
		}
		return [...map.entries()].sort((a, b) =>
			groupBy === 'year' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
		);
	});
</script>

<svelte:head><title>{t.reports.registry} — {t.app.name}</title></svelte:head>

<div class="section section-wide">
	<p class="eyebrow no-print"><a href="/raportit">{t.reports.title}</a></p>

	<div class="head">
		<h1>{t.reports.registry}</h1>
		<div class="row no-print">
			<select bind:value={groupBy} aria-label="Ryhmittely">
				<option value="year">Ryhmittele: istutusvuosi</option>
				<option value="genus">Ryhmittele: suku</option>
			</select>
			<button class="btn btn-sm" type="button" onclick={() => window.print()}>
				{t.common.print}
			</button>
		</div>
	</div>

	{#if loading}
		<p class="muted">{t.common.loading}</p>
	{:else}
		{#each groups as [key, items] (key)}
			<section class="group">
				<h2>{key} <span class="data muted">{items.length}</span></h2>
				<div class="table-scroll">
					<table>
						<thead>
							<tr>
								<th>Tunnus</th>
								<th>Tieteellinen nimi</th>
								<th>Suomeksi</th>
								<th>Istutettu</th>
								<th>Kpl</th>
								<th>Koko</th>
								<th>Alkuperä</th>
								<th>Tila</th>
							</tr>
						</thead>
						<tbody>
							{#each items as planting (planting.id)}
								<tr>
									<td class="data">
										<a href="/istutus/{planting.id}">{planting.accession_code}</a>
									</td>
									<td><SciName taxon={planting.taxa} /></td>
									<td>{planting.taxa?.name_fi ?? '—'}</td>
									<td class="num">
										{formatPlantedDate(planting.planted_year, planting.planted_month)}
									</td>
									<td class="num">{planting.count_planted}</td>
									<td class="num">
										{planting.seedling_size_cm ? `${planting.seedling_size_cm} cm` : '—'}
									</td>
									<td>{planting.provenance ?? '—'}</td>
									<td>{t.enums.plantingStatus[planting.status]}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
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

	.head select {
		width: auto;
		min-height: 2.375rem;
		font-size: 0.875rem;
	}

	.group {
		margin-bottom: 1.75rem;
		break-inside: auto;
	}

	.group h2 {
		font-family: var(--font-data);
		font-size: 0.8125rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bark);
		padding-bottom: 0.35rem;
		margin-bottom: 0.5rem;
		border-bottom: 2px solid var(--hairline-strong);
		display: flex;
		justify-content: space-between;
	}

	td a {
		text-decoration: none;
		color: var(--moss);
	}
</style>
