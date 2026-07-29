<script lang="ts">
	import TagChip from '$lib/components/TagChip.svelte';
	import ObservationCard from '$lib/components/ObservationCard.svelte';
	import { bulkTag, fetchObservations, fetchTags, mergeTags } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { supabase, session } from '$lib/supabase';
	import { t } from '$lib/i18n';
	import type { Observation, Tag } from '$lib/types';

	/**
	 * Classification lives on tags, never in a fixed column, so this screen is
	 * where the vocabulary gets reshaped: rename, recolour, merge two tags into
	 * one, and retag a batch of observations at once.
	 */

	let tags = $state<Tag[]>([]);
	let observations = $state<Observation[]>([]);
	let usage = $state<Record<string, number>>({});
	let error = $state('');
	let message = $state('');
	let busy = $state(false);

	let newName = $state('');
	let newColor = $state('#2F5D3F');

	let editing = $state<Tag | null>(null);
	let mergeSource = $state<Tag | null>(null);
	let mergeTargetId = $state('');

	// Bulk retagging
	let filterTagId = $state('');
	let selected = $state<Set<string>>(new Set());
	let bulkTagId = $state('');

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		try {
			[tags, observations] = await Promise.all([
				fetchTags(),
				fetchObservations({ gardenId: gardens.active?.id })
			]);
			const tally: Record<string, number> = {};
			for (const o of observations) {
				for (const link of o.observation_tags ?? []) {
					tally[link.tag_id] = (tally[link.tag_id] ?? 0) + 1;
				}
			}
			usage = tally;
			error = '';
		} catch {
			error = t.errors.load;
		}
	}

	function flash(text: string) {
		message = text;
		setTimeout(() => (message = ''), 2500);
	}

	async function create() {
		if (!newName.trim()) return;
		const { error: err } = await supabase
			.from('tags')
			.insert({ name: newName.trim(), color: newColor });
		if (err) {
			error = t.errors.save;
			return;
		}
		newName = '';
		await load();
	}

	async function saveEdit() {
		if (!editing) return;
		const { error: err } = await supabase
			.from('tags')
			.update({ name: editing.name.trim(), color: editing.color })
			.eq('id', editing.id);
		if (err) {
			error = t.errors.save;
			return;
		}
		editing = null;
		await load();
		flash(t.common.saved);
	}

	async function remove(tag: Tag) {
		if (!confirm(t.common.confirmDelete)) return;
		await supabase.from('tags').delete().eq('id', tag.id);
		await load();
	}

	async function runMerge() {
		if (!mergeSource || !mergeTargetId) return;
		busy = true;
		try {
			await mergeTags(mergeSource.id, mergeTargetId);
			mergeSource = null;
			mergeTargetId = '';
			await load();
			flash(t.common.saved);
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}

	const listed = $derived(
		filterTagId
			? observations.filter((o) =>
					(o.observation_tags ?? []).some((link) => link.tag_id === filterTagId)
				)
			: observations
	);

	function toggleSelect(id: string, on: boolean) {
		const next = new Set(selected);
		on ? next.add(id) : next.delete(id);
		selected = next;
	}

	async function runBulk(add: boolean) {
		if (!bulkTagId || !selected.size) return;
		busy = true;
		try {
			await bulkTag([...selected], bulkTagId, add);
			selected = new Set();
			await load();
			flash(t.common.saved);
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{t.tag.many} — {t.app.name}</title></svelte:head>

<div class="section">
	<p class="eyebrow"><a href="/rekisteri">{t.registry.title}</a></p>
	<h1>{t.tag.many}</h1>

	{#if error}<p class="notice notice-error">{error}</p>{/if}
	{#if message}<p class="notice notice-ok">{message}</p>{/if}

	<section class="card">
		<div class="new-tag">
			<input bind:value={newName} placeholder={t.tag.new} aria-label={t.tag.name} />
			<input type="color" bind:value={newColor} aria-label={t.tag.color} class="color" />
			<button class="btn btn-primary" type="button" onclick={create} disabled={!newName.trim()}>
				{t.common.add}
			</button>
		</div>

		<ul class="tag-list">
			{#each tags as tag (tag.id)}
				<li>
					{#if editing?.id === tag.id}
						<div class="tag-edit">
							<input bind:value={editing.name} aria-label={t.tag.name} />
							<input type="color" bind:value={editing.color} aria-label={t.tag.color} class="color" />
							<button class="btn btn-sm btn-primary" type="button" onclick={saveEdit}>
								{t.common.save}
							</button>
							<button class="btn btn-sm" type="button" onclick={() => (editing = null)}>
								{t.common.cancel}
							</button>
						</div>
					{:else}
						<div class="tag-row">
							<TagChip {tag} />
							<span class="data muted">{usage[tag.id] ?? 0}</span>
							<button class="link-btn" type="button" onclick={() => (editing = { ...tag })}>
								{t.common.edit}
							</button>
							<button
								class="link-btn"
								type="button"
								onclick={() => {
									mergeSource = tag;
									mergeTargetId = '';
								}}>{t.tag.merge}</button
							>
							<button class="link-btn danger" type="button" onclick={() => remove(tag)}>
								{t.common.delete}
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	{#if mergeSource}
		<section class="card merge">
			<h2>{t.tag.merge}: {mergeSource.name}</h2>
			<p class="muted small">{t.tag.mergeHelp}</p>
			<div class="row">
				<select bind:value={mergeTargetId} aria-label={t.tag.mergeInto}>
					<option value="" disabled>— {t.tag.mergeInto} —</option>
					{#each tags.filter((x) => x.id !== mergeSource!.id) as tag (tag.id)}
						<option value={tag.id}>{tag.name}</option>
					{/each}
				</select>
				<button class="btn btn-primary" type="button" onclick={runMerge} disabled={busy || !mergeTargetId}>
					{t.tag.merge}
				</button>
				<button class="btn" type="button" onclick={() => (mergeSource = null)}>
					{t.common.cancel}
				</button>
			</div>
		</section>
	{/if}

	<section class="bulk">
		<h2>{t.tag.bulk}</h2>
		<p class="muted small">{t.tag.bulkHelp}</p>

		<div class="bulk-bar">
			<select bind:value={filterTagId} aria-label={t.common.filter}>
				<option value="">{t.common.all} ({observations.length})</option>
				{#each tags as tag (tag.id)}
					<option value={tag.id}>{tag.name} ({usage[tag.id] ?? 0})</option>
				{/each}
			</select>
			<select bind:value={bulkTagId} aria-label={t.tag.one}>
				<option value="" disabled>— {t.tag.one} —</option>
				{#each tags as tag (tag.id)}
					<option value={tag.id}>{tag.name}</option>
				{/each}
			</select>
			<button
				class="btn btn-sm btn-primary"
				type="button"
				onclick={() => runBulk(true)}
				disabled={busy || !bulkTagId || !selected.size}>{t.tag.addToSelected}</button
			>
			<button
				class="btn btn-sm"
				type="button"
				onclick={() => runBulk(false)}
				disabled={busy || !bulkTagId || !selected.size}>{t.tag.removeFromSelected}</button
			>
			<span class="data muted count">{t.tag.selected(selected.size)}</span>
		</div>

		{#if !listed.length}
			<p class="empty">{t.common.empty}</p>
		{:else}
			<div class="stack">
				{#each listed as observation (observation.id)}
					<ObservationCard
						{observation}
						showTarget
						selectable
						selected={selected.has(observation.id)}
						onselect={(on) => toggleSelect(observation.id, on)}
					/>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
	.small {
		font-size: 0.8125rem;
	}

	.new-tag {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.9rem;
	}

	.new-tag input:first-child {
		flex: 1;
		min-width: 0;
	}

	.color {
		width: 3rem;
		padding: 0.2rem;
		flex: none;
	}

	.tag-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.tag-row,
	.tag-edit {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding: 0.3rem 0;
		border-bottom: 1px solid var(--hairline);
	}

	.tag-row .data {
		margin-right: auto;
	}

	.tag-edit input:first-child {
		width: 10rem;
	}

	.link-btn {
		background: none;
		border: 0;
		color: var(--moss);
		font-size: 0.8125rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
		padding: 0.3rem;
	}

	.danger {
		color: var(--rowan);
	}

	.merge {
		margin-top: 1rem;
	}

	.merge h2 {
		margin-bottom: 0.3rem;
	}

	.bulk {
		margin-top: 2rem;
	}

	.bulk h2 {
		margin-bottom: 0.3rem;
	}

	.bulk-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin: 0.8rem 0 1rem;
		padding: 0.6rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius);
		background: var(--paper-raised);
		position: sticky;
		top: 3.25rem;
		z-index: 10;
	}

	.bulk-bar select {
		width: auto;
		min-width: 9rem;
		min-height: 2.375rem;
		font-size: 0.875rem;
	}

	.count {
		margin-left: auto;
	}
</style>
