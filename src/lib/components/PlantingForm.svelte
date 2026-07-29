<script lang="ts">
	import { untrack } from 'svelte';
	import { scientificName } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Planting, Taxon } from '$lib/types';

	let {
		planting = {},
		taxa = [],
		busy = false,
		onsubmit,
		oncancel
	}: {
		planting?: Partial<Planting>;
		taxa?: Taxon[];
		busy?: boolean;
		onsubmit: (values: Partial<Planting>) => void;
		oncancel?: () => void;
	} = $props();

	// Seeded once from the record being edited; the form owns its values after
	// that, so untrack keeps this out of the reactive graph deliberately.
	let form = $state<Record<string, unknown>>(untrack(() => ({
		taxon_id: planting.taxon_id ?? '',
		planted_year: planting.planted_year ?? new Date().getFullYear(),
		planted_month: planting.planted_month ?? '',
		count_planted: planting.count_planted ?? 1,
		seedling_size_cm: planting.seedling_size_cm ?? '',
		propagation: planting.propagation ?? '',
		provenance: planting.provenance ?? '',
		origin_type: planting.origin_type ?? 'planted',
		status: planting.status ?? 'active',
		lat: planting.lat ?? '',
		lon: planting.lon ?? '',
		radius_m: planting.radius_m ?? '',
		published: planting.published ?? false,
		notes: planting.notes ?? ''
	})));

	const num = (v: unknown) => (v === '' || v == null ? null : Number(v));
	const str = (v: unknown) => (v === '' || v == null ? null : String(v));

	function submit(e: SubmitEvent) {
		e.preventDefault();
		onsubmit({
			taxon_id: form.taxon_id as string,
			planted_year: num(form.planted_year),
			planted_month: num(form.planted_month),
			count_planted: Number(form.count_planted) || 1,
			seedling_size_cm: num(form.seedling_size_cm),
			propagation: str(form.propagation),
			provenance: str(form.provenance),
			origin_type: form.origin_type as Planting['origin_type'],
			status: form.status as Planting['status'],
			lat: num(form.lat),
			lon: num(form.lon),
			radius_m: num(form.radius_m),
			published: Boolean(form.published),
			notes: str(form.notes)
		});
	}
</script>

<form onsubmit={submit}>
	<div class="field">
		<label for="taxon">{t.taxon.one}</label>
		<select id="taxon" bind:value={form.taxon_id} required>
			<option value="" disabled>— {t.taxon.one} —</option>
			{#each taxa as taxon (taxon.id)}
				<option value={taxon.id}>
					{scientificName(taxon)}{taxon.name_fi ? ` — ${taxon.name_fi}` : ''}
				</option>
			{/each}
		</select>
		<p class="help"><a href="/rekisteri/taksonit">{t.taxon.new}</a></p>
	</div>

	<div class="field-grid">
		<div class="field">
			<label for="year">{t.planting.year}</label>
			<input id="year" type="number" min="1800" max="2100" bind:value={form.planted_year} />
		</div>
		<div class="field">
			<label for="month">{t.planting.month}</label>
			<select id="month" bind:value={form.planted_month}>
				<option value="">—</option>
				{#each t.months as month, i (month)}
					<option value={i + 1}>{month}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="count">{t.planting.count}</label>
			<input id="count" type="number" min="0" bind:value={form.count_planted} />
		</div>
		<div class="field">
			<label for="size">{t.planting.size}</label>
			<input id="size" type="number" min="0" bind:value={form.seedling_size_cm} />
		</div>
	</div>

	<div class="field">
		<label for="propagation">{t.planting.propagation}</label>
		<input
			id="propagation"
			bind:value={form.propagation}
			list="propagation-options"
			placeholder="siemenestä itse kasvatettu"
		/>
		<datalist id="propagation-options">
			<option value="siemenestä itse kasvatettu"></option>
			<option value="taimitarhataimi"></option>
			<option value="vartettu"></option>
			<option value="pistokkaista"></option>
			<option value="mikrolisätty"></option>
		</datalist>
	</div>

	<div class="field">
		<label for="provenance">{t.planting.provenance}</label>
		<input id="provenance" bind:value={form.provenance} placeholder="Taimisto tai siemenen alkuperä" />
	</div>

	<div class="field-grid">
		<div class="field">
			<label for="origin">{t.planting.originType}</label>
			<select id="origin" bind:value={form.origin_type}>
				<option value="planted">{t.enums.originType.planted}</option>
				<option value="original">{t.enums.originType.original}</option>
			</select>
		</div>
		<div class="field">
			<label for="status">{t.planting.status}</label>
			<select id="status" bind:value={form.status}>
				<option value="active">{t.enums.plantingStatus.active}</option>
				<option value="dead">{t.enums.plantingStatus.dead}</option>
				<option value="removed">{t.enums.plantingStatus.removed}</option>
			</select>
		</div>
	</div>

	<fieldset class="group">
		<legend class="field-label">{t.planting.position}</legend>
		<p class="help">Erän keskipiste. Yksilöillä on omat sijaintinsa.</p>
		<div class="field-grid">
			<div class="field">
				<label for="lat">Lat</label>
				<input id="lat" inputmode="decimal" bind:value={form.lat} placeholder="60.33061" />
			</div>
			<div class="field">
				<label for="lon">Lon</label>
				<input id="lon" inputmode="decimal" bind:value={form.lon} placeholder="24.66398" />
			</div>
			<div class="field">
				<label for="radius">{t.planting.radius}</label>
				<input id="radius" type="number" min="0" bind:value={form.radius_m} />
			</div>
		</div>
	</fieldset>

	<div class="field">
		<label for="notes">{t.planting.notes}</label>
		<textarea id="notes" bind:value={form.notes}></textarea>
	</div>

	<label class="check">
		<input type="checkbox" bind:checked={form.published as boolean} />
		<span>
			{t.planting.published}
			<em>{t.planting.publishedHelp}</em>
		</span>
	</label>

	<div class="actions">
		<button class="btn btn-primary" type="submit" disabled={busy}>
			{busy ? t.common.saving : t.common.save}
		</button>
		{#if oncancel}
			<button class="btn" type="button" onclick={oncancel}>{t.common.cancel}</button>
		{/if}
	</div>
</form>

<style>
	.help {
		font-size: 0.75rem;
		color: var(--bark);
		margin: 0.25rem 0 0;
	}

	.group {
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		padding: 0.75rem 0.85rem 0.1rem;
		margin: 0 0 0.85rem;
	}

	.group .help {
		margin: 0 0 0.6rem;
	}

	.check {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		margin: 0.5rem 0 1rem;
		text-transform: none;
		letter-spacing: 0;
		font-weight: 500;
		color: var(--ink);
		font-size: 0.9375rem;
	}

	.check input {
		margin-top: 0.15rem;
		flex: none;
	}

	.check em {
		display: block;
		font-style: normal;
		font-weight: 400;
		font-size: 0.8125rem;
		color: var(--bark);
		margin-top: 0.1rem;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
</style>
