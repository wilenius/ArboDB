<script lang="ts">
	import TagChip from './TagChip.svelte';
	import SciName from './SciName.svelte';
	import { publicUrl } from '$lib/supabase';
	import { formatCoord, formatDateTime, formatMeasurement } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Observation } from '$lib/types';

	let {
		observation,
		showTarget = false,
		selectable = false,
		selected = false,
		onselect
	}: {
		observation: Observation;
		showTarget?: boolean;
		selectable?: boolean;
		selected?: boolean;
		onselect?: (checked: boolean) => void;
	} = $props();

	const tags = $derived(
		(observation.observation_tags ?? []).map((ot) => ot.tags).filter(Boolean)
	);
	const measurement = $derived(formatMeasurement(observation));
	const photos = $derived(observation.photos ?? []);
</script>

<article class="obs card" class:selected>
	<header class="obs-head">
		{#if selectable}
			<input
				type="checkbox"
				checked={selected}
				onchange={(e) => onselect?.(e.currentTarget.checked)}
				aria-label={t.tag.bulk}
			/>
		{/if}
		<span class="kind" data-kind={observation.kind}>{t.enums.kind[observation.kind]}</span>
		<time class="data muted" datetime={observation.observed_at}>
			{formatDateTime(observation.observed_at)}
		</time>
		{#if measurement}
			<span class="data measurement">{measurement}</span>
		{/if}
	</header>

	{#if showTarget}
		{#if observation.plantings}
			<p class="target">
				<a
					href={observation.trees
						? `/puu/${observation.trees.id}`
						: `/istutus/${observation.plantings.id}`}
				>
					<SciName taxon={observation.plantings.taxa} />
				</a>
				<span class="data muted">
					{observation.plantings.accession_code}{observation.trees?.label
						? ` ${observation.trees.label}`
						: ''}
				</span>
			</p>
		{:else}
			<!-- A diary entry: about a spot on the ground, or about the plot as a
			     whole. Saying which is the only way to tell the two apart. -->
			<p class="target">
				<span class="scope">
					{observation.lat != null ? t.journal.targetSpot : t.journal.targetGarden}
				</span>
				{#if observation.lat != null && observation.lon != null}
					<span class="data muted">
						{formatCoord(observation.lat, observation.lon)}{observation.radius_m
							? ` · r ${Math.round(observation.radius_m)} m`
							: ''}
					</span>
				{/if}
			</p>
		{/if}
	{/if}

	{#if observation.body}
		<p class="body">{observation.body}</p>
	{/if}

	{#if photos.length}
		<div class="thumbs">
			{#each photos as photo (photo.id)}
				<a href={publicUrl('photos', photo.storage_path)} target="_blank" rel="noopener">
					<img
						src={publicUrl('photos', photo.thumb_path ?? photo.storage_path)}
						alt={photo.caption ?? ''}
						loading="lazy"
					/>
				</a>
			{/each}
		</div>
	{/if}

	{#if tags.length}
		<div class="tags">
			{#each tags as tag (tag!.id)}
				<TagChip tag={tag!} />
			{/each}
		</div>
	{/if}
</article>

<style>
	.obs {
		padding: 0.8rem 0.9rem;
	}

	.selected {
		border-color: var(--moss);
		box-shadow: inset 0 0 0 1px var(--moss);
	}

	.obs-head {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}

	.obs-head input[type='checkbox'] {
		margin-right: 0.1rem;
	}

	.measurement {
		margin-left: auto;
		color: var(--moss);
		font-weight: 500;
	}

	.target {
		margin: 0.5rem 0 0;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.target a {
		text-decoration: none;
		color: var(--ink);
		border-bottom: 1px solid var(--hairline-strong);
	}

	/* Set upright, not in the display italic a scientific name gets: a plot is
	   not a taxon, and the eye should not have to read it to know that. */
	.scope {
		font-size: 0.9375rem;
		color: var(--ink-soft);
	}

	.body {
		margin: 0.5rem 0 0;
		line-height: 1.5;
		white-space: pre-wrap;
	}

	.thumbs {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.65rem;
		overflow-x: auto;
		padding-bottom: 0.2rem;
	}

	.thumbs img {
		width: 5.5rem;
		height: 5.5rem;
		object-fit: cover;
		border-radius: 2px;
		border: 1px solid var(--hairline);
		display: block;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.65rem;
	}
</style>
