<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Plate from '$lib/components/Plate.svelte';
	import TagChip from '$lib/components/TagChip.svelte';
	import { buildTargets, fetchPlantings, fetchTags, targetKey } from '$lib/data';
	import { geo } from '$lib/geolocation.svelte';
	import { supabase, session } from '$lib/supabase';
	import { uploadPhoto } from '$lib/photos';
	import { toLocalInput } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { ObservationKind, Planting, Tag, Target } from '$lib/types';

	let plantings = $state<Planting[]>([]);
	let tags = $state<Tag[]>([]);
	let target = $state<Target | null>(null);
	let query = $state('');
	let loading = $state(true);

	// Form state
	let observedAt = $state(toLocalInput(new Date()));
	let kind = $state<ObservationKind>('growth');
	let heightCm = $state('');
	let diameterMm = $state('');
	let body = $state('');
	let chosenTags = $state<Set<string>>(new Set());
	let files = $state<File[]>([]);
	let newTagName = $state('');

	let busy = $state(false);
	let error = $state('');
	let uploadNote = $state('');

	onMount(() => geo.start());
	onDestroy(() => geo.stop());

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		loading = true;
		try {
			[plantings, tags] = await Promise.all([fetchPlantings(), fetchTags()]);
			error = '';
		} catch {
			error = t.errors.load;
		} finally {
			loading = false;
		}
	}

	const here = $derived(geo.fix ? { lat: geo.fix.lat, lon: geo.fix.lon } : null);
	const targets = $derived(buildTargets(plantings, here));

	// Preselect from the link that brought us here (a plate, a map marker).
	$effect(() => {
		if (target || !targets.length) return;
		const treeId = page.url.searchParams.get('tree');
		const plantingId = page.url.searchParams.get('planting');
		if (treeId) target = targets.find((x) => x.tree?.id === treeId) ?? null;
		else if (plantingId)
			target = targets.find((x) => x.kind === 'planting' && x.planting.id === plantingId) ?? null;
	});

	const candidates = $derived(
		query.trim()
			? targets.filter((x) => {
					const q = query.toLowerCase();
					const tx = x.planting.taxa;
					return (
						(tx?.name_fi ?? '').toLowerCase().includes(q) ||
						(tx?.genus ?? '').toLowerCase().includes(q) ||
						(x.planting.accession_code ?? '').toLowerCase().includes(q)
					);
				})
			: targets.slice(0, 6)
	);

	function toggleTag(id: string) {
		const next = new Set(chosenTags);
		next.has(id) ? next.delete(id) : next.add(id);
		chosenTags = next;
	}

	async function addTag() {
		const name = newTagName.trim();
		if (!name) return;
		const { data, error: err } = await supabase
			.from('tags')
			.insert({ name, color: '#2F5D3F' })
			.select('*')
			.single();
		if (err) return;
		tags = [...tags, data as Tag].sort((a, b) => a.name.localeCompare(b.name, 'fi'));
		toggleTag(data.id);
		newTagName = '';
	}

	function addFiles(list: FileList | null) {
		if (!list) return;
		files = [...files, ...Array.from(list)];
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!target) return;
		busy = true;
		error = '';
		try {
			const { data: obs, error: err } = await supabase
				.from('observations')
				.insert({
					planting_id: target.planting.id,
					tree_id: target.tree?.id ?? null,
					observed_at: new Date(observedAt).toISOString(),
					kind,
					height_cm: heightCm === '' ? null : Number(heightCm),
					diameter_mm: diameterMm === '' ? null : Number(diameterMm),
					body: body.trim() || null
				})
				.select('id')
				.single();
			if (err) throw err;

			if (chosenTags.size) {
				const { error: tagErr } = await supabase
					.from('observation_tags')
					.insert([...chosenTags].map((tag_id) => ({ observation_id: obs.id, tag_id })));
				if (tagErr) throw tagErr;
			}

			// Photos are resized on the phone before they leave it; see lib/photos.
			for (const [i, file] of files.entries()) {
				uploadNote = `${t.observation.photos} ${i + 1}/${files.length}…`;
				const uploaded = await uploadPhoto(file, `observations/${obs.id}`);
				const { error: photoErr } = await supabase.from('photos').insert({
					observation_id: obs.id,
					planting_id: target.planting.id,
					tree_id: target.tree?.id ?? null,
					...uploaded
				});
				if (photoErr) throw photoErr;
			}

			goto(target.tree ? `/puu/${target.tree.id}` : `/istutus/${target.planting.id}`);
		} catch {
			error = files.length ? t.errors.upload : t.errors.save;
			busy = false;
			uploadNote = '';
		}
	}
</script>

<svelte:head><title>{t.observation.new} — {t.app.name}</title></svelte:head>

<div class="section narrow">
	<h1>{t.observation.new}</h1>

	{#if error}<p class="notice notice-error">{error}</p>{/if}

	{#if !target}
		<p class="eyebrow">Valitse kohde</p>
		<input
			type="search"
			bind:value={query}
			placeholder="{t.common.search}: laji tai tunnus"
			aria-label={t.common.search}
		/>
		{#if loading}
			<p class="muted">{t.common.loading}</p>
		{:else}
			<ul class="picker">
				{#each candidates as candidate (targetKey(candidate))}
					<li>
						<button type="button" class="picker-btn" onclick={() => (target = candidate)}>
							<Plate target={candidate} href="#" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<div class="chosen">
			<Plate {target} href="#" />
			<button class="btn btn-sm no-print" type="button" onclick={() => (target = null)}>
				Vaihda kohde
			</button>
			<p class="muted small">
				{target.tree ? t.observation.targetTree : t.observation.targetPlanting}
			</p>
		</div>

		<form onsubmit={save}>
			<div class="field">
				<label for="kind">{t.observation.kind}</label>
				<div class="kinds" role="radiogroup" aria-labelledby="kind">
					{#each Object.entries(t.enums.kind) as [value, label] (value)}
						<button
							type="button"
							class="kind-btn"
							data-kind={value}
							aria-pressed={kind === value}
							onclick={() => (kind = value as ObservationKind)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<div class="field">
				<label for="body">{t.observation.body}</label>
				<textarea
					id="body"
					bind:value={body}
					placeholder={t.observation.bodyPlaceholder}
					rows="5"
				></textarea>
			</div>

			<div class="field-grid">
				<div class="field">
					<label for="height">{t.observation.height}</label>
					<input id="height" type="number" inputmode="numeric" min="0" bind:value={heightCm} />
				</div>
				<div class="field">
					<label for="diameter">{t.observation.diameter}</label>
					<input id="diameter" type="number" inputmode="numeric" min="0" bind:value={diameterMm} />
				</div>
				<div class="field">
					<label for="observed">{t.observation.observedAt}</label>
					<input id="observed" type="datetime-local" bind:value={observedAt} />
				</div>
			</div>

			<div class="field">
				<span class="field-label">{t.observation.tags}</span>
				<div class="tag-picker">
					{#each tags as tag (tag.id)}
						<TagChip
							{tag}
							interactive
							pressed={chosenTags.has(tag.id)}
							onclick={() => toggleTag(tag.id)}
						/>
					{/each}
				</div>
				<div class="new-tag">
					<input bind:value={newTagName} placeholder={t.tag.new} aria-label={t.tag.new} />
					<button class="btn btn-sm" type="button" onclick={addTag} disabled={!newTagName.trim()}>
						{t.common.add}
					</button>
				</div>
			</div>

			<div class="field">
				<span class="field-label">{t.observation.photos}</span>
				<!-- capture="environment" opens the rear camera straight away on a
				     phone, which is the whole point when standing at the tree. -->
				<input
					type="file"
					accept="image/*"
					capture="environment"
					multiple
					onchange={(e) => addFiles(e.currentTarget.files)}
				/>
				{#if files.length}
					<ul class="files">
						{#each files as file, i (file.name + i)}
							<li>
								<img src={URL.createObjectURL(file)} alt="" />
								<button
									type="button"
									aria-label={t.common.delete}
									onclick={() => (files = files.filter((_, j) => j !== i))}>×</button
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			{#if uploadNote}<p class="notice">{uploadNote}</p>{/if}

			<div class="actions">
				<button class="btn btn-primary btn-block" type="submit" disabled={busy}>
					{busy ? t.common.saving : t.common.save}
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.narrow {
		max-width: 40rem;
	}

	.picker {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.picker-btn {
		display: block;
		width: 100%;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		text-align: left;
	}

	.chosen {
		margin-bottom: 1.25rem;
	}

	.chosen .btn {
		margin-top: 0.5rem;
	}

	.small {
		font-size: 0.75rem;
		margin: 0.4rem 0 0;
	}

	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.kind-btn {
		font-family: var(--font-data);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 0 0.7rem;
		min-height: var(--tap);
		border-radius: var(--radius);
		border: 1px solid var(--hairline-strong);
		background: var(--paper-raised);
		color: var(--bark);
		cursor: pointer;
	}

	.kind-btn[aria-pressed='true'] {
		background: var(--moss);
		border-color: var(--moss);
		color: #f4f8f0;
	}

	.tag-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 0.5rem;
	}

	.new-tag {
		display: flex;
		gap: 0.4rem;
	}

	.new-tag input {
		flex: 1;
		min-width: 0;
	}

	.files {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.5rem 0 0;
		padding: 0;
	}

	.files li {
		position: relative;
	}

	.files img {
		width: 5rem;
		height: 5rem;
		object-fit: cover;
		border-radius: 2px;
		border: 1px solid var(--hairline-strong);
		display: block;
	}

	.files button {
		position: absolute;
		top: -0.4rem;
		right: -0.4rem;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 1px solid var(--hairline-strong);
		background: var(--paper-raised);
		color: var(--ink);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}

	.actions {
		margin-top: 1.25rem;
	}
</style>
