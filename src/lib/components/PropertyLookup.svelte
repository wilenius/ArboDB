<script lang="ts">
	import { fetchProperty, hasMmlProperty, ParcelError, type ParcelResult } from '$lib/mml';
	import { t } from '$lib/i18n';

	/**
	 * Look up a property boundary by its identifier.
	 *
	 * The lookup itself is all this does — the caller decides whether the result
	 * becomes a map layer or a garden's boundary, because those live on
	 * different screens and mean different things.
	 */

	let {
		onfound,
		busy = false
	}: {
		onfound: (result: ParcelResult) => void;
		/** The parent is still saving what the last lookup returned. */
		busy?: boolean;
	} = $props();

	let code = $state('');
	let looking = $state(false);
	let error = $state('');

	async function lookup(e: SubmitEvent) {
		e.preventDefault();
		looking = true;
		error = '';
		try {
			onfound(await fetchProperty(code));
		} catch (err) {
			error = err instanceof ParcelError ? t.property.errors[err.kind] : t.errors.generic;
		} finally {
			looking = false;
		}
	}
</script>

{#if !hasMmlProperty}
	<p class="notice">{t.property.errors.noKey}</p>
{:else}
	<form onsubmit={lookup}>
		<p class="hint">{t.property.help}</p>
		<div class="row">
			<div class="field">
				<label for="property-code">{t.property.code}</label>
				<input
					id="property-code"
					class="data"
					bind:value={code}
					placeholder="710-547-1-180"
					autocomplete="off"
					spellcheck="false"
					required
				/>
			</div>
			<button class="btn" type="submit" disabled={looking || busy || !code.trim()}>
				{looking ? t.property.fetching : t.property.fetch}
			</button>
		</div>
		{#if error}<p class="notice notice-error">{error}</p>{/if}
		<p class="muted attribution">{t.property.attribution}</p>
	</form>
{/if}

<style>
	.row {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.field {
		flex: 1 1 12rem;
		margin-bottom: 0.85rem;
	}

	.row .btn {
		margin-bottom: 0.85rem;
	}

	.hint {
		font-size: 0.8125rem;
		color: var(--ink-soft);
		margin: 0 0 0.5rem;
	}

	.attribution {
		font-size: 0.6875rem;
		margin: 0;
	}
</style>
