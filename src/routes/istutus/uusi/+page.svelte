<script lang="ts">
	import { goto } from '$app/navigation';
	import PlantingForm from '$lib/components/PlantingForm.svelte';
	import { fetchTaxa } from '$lib/data';
	import { supabase, session } from '$lib/supabase';
	import { t } from '$lib/i18n';
	import type { Planting, Taxon } from '$lib/types';

	let taxa = $state<Taxon[]>([]);
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		if ($session) fetchTaxa().then((x) => (taxa = x));
	});

	async function save(values: Partial<Planting>) {
		busy = true;
		error = '';
		try {
			const { data, error: err } = await supabase
				.from('plantings')
				.insert(values)
				.select('id')
				.single();
			if (err) throw err;
			goto(`/istutus/${data.id}`);
		} catch {
			error = t.errors.save;
			busy = false;
		}
	}
</script>

<svelte:head><title>{t.planting.new} — {t.app.name}</title></svelte:head>

<div class="section narrow">
	<p class="eyebrow"><a href="/rekisteri">{t.planting.many}</a></p>
	<h1>{t.planting.new}</h1>
	{#if error}<p class="notice notice-error">{error}</p>{/if}
	<PlantingForm {taxa} {busy} onsubmit={save} oncancel={() => history.back()} />
</div>

<style>
	.narrow {
		max-width: 40rem;
	}
</style>
