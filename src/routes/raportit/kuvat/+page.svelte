<script lang="ts">
	import { fetchPhotos, fetchPlantings } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { publicUrl, session } from '$lib/supabase';
	import { formatDate, scientificName } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Photo, Planting } from '$lib/types';

	let photos = $state<Photo[]>([]);
	let plantings = $state<Planting[]>([]);
	let loading = $state(true);

	$effect(() => {
		if ($session)
			Promise.all([fetchPhotos(), fetchPlantings(gardens.active?.id)]).then(([p, pl]) => {
				photos = p;
				plantings = pl;
				loading = false;
			});
	});

	const byId = $derived(new Map(plantings.map((p) => [p.id, p])));
</script>

<svelte:head><title>{t.reports.gallery} — {t.app.name}</title></svelte:head>

<div class="section section-wide">
	<p class="eyebrow no-print"><a href="/raportit">{t.reports.title}</a></p>

	<div class="head">
		<h1>{t.reports.gallery}</h1>
		<button class="btn btn-sm no-print" type="button" onclick={() => window.print()}>
			{t.common.print}
		</button>
	</div>

	{#if loading}
		<p class="muted">{t.common.loading}</p>
	{:else if !photos.length}
		<p class="empty">{t.reports.noData}</p>
	{:else}
		<ul class="gallery">
			{#each photos as photo (photo.id)}
				{@const planting = photo.planting_id ? byId.get(photo.planting_id) : null}
				<li>
					<a href={publicUrl('photos', photo.storage_path)} target="_blank" rel="noopener">
						<img
							src={publicUrl('photos', photo.thumb_path ?? photo.storage_path)}
							alt={photo.caption ?? ''}
							loading="lazy"
						/>
					</a>
					<p class="caption">
						{#if planting}
							<span class="sci">{scientificName(planting.taxa)}</span>
						{/if}
						<span class="data muted">{formatDate(photo.taken_at)}</span>
					</p>
				</li>
			{/each}
		</ul>
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

	.gallery {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
	}

	.gallery img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		display: block;
		border-radius: var(--radius);
		border: 1px solid var(--hairline);
	}

	.caption {
		margin: 0.35rem 0 0;
		font-size: 0.8125rem;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
</style>
