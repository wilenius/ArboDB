<script lang="ts">
	import { install } from '$lib/install.svelte';
	import { t } from '$lib/i18n';

	let busy = $state(false);
	let outcome = $state<'accepted' | 'dismissed' | null>(null);

	async function run() {
		busy = true;
		try {
			const result = await install.promptNow();
			if (result !== 'unavailable') outcome = result;
		} finally {
			busy = false;
		}
	}

	// Every platform's instructions are shown, not just the detected one: the
	// owner reads this on a laptop as often as on the phone he wants to install
	// on, and a page that hides the answer he needs is worse than a long page.
	const platform = $derived(install.platform);
</script>

<svelte:head><title>{t.install.title} — {t.app.name}</title></svelte:head>

<div class="section">
	<p class="eyebrow">{t.app.name}</p>
	<h1>{t.install.title}</h1>
	<p class="lead">{t.install.lead}</p>

	{#if install.installed}
		<p class="notice notice-ok">{t.install.installed}</p>
	{:else if outcome === 'accepted'}
		<p class="notice notice-ok">{t.install.accepted}</p>
	{:else}
		{#if outcome === 'dismissed'}
			<p class="notice">{t.install.declined}</p>
		{/if}

		{#if platform === 'prompt'}
			<button class="btn btn-primary btn-block" type="button" onclick={run} disabled={busy}>
				{busy ? t.install.installing : t.install.button}
			</button>
		{/if}

		{#if platform === 'ios-other'}
			<div class="notice">
				<strong>{t.install.iosOther.title}</strong>
				<p>{t.install.iosOther.body}</p>
			</div>
		{/if}
	{/if}

	<section class="steps" class:highlight={platform === 'ios-safari' || platform === 'ios-other'}>
		<h2>{t.install.iosSafari.title}</h2>
		<ol>
			{#each t.install.iosSafari.steps as step (step)}
				<li>{step}</li>
			{/each}
		</ol>
	</section>

	<section class="steps" class:highlight={platform === 'prompt' || platform === 'unknown'}>
		<h2>{t.install.android.title}</h2>
		<ol>
			{#each t.install.android.steps as step (step)}
				<li>{step}</li>
			{/each}
		</ol>
	</section>

	<section class="steps" class:highlight={platform === 'desktop'}>
		<h2>{t.install.desktop.title}</h2>
		<p>{t.install.desktop.body}</p>
	</section>

	<p class="muted small footnote">{t.install.offlineNote}</p>
</div>

<style>
	.lead {
		max-width: 44ch;
		color: var(--ink-soft);
	}

	.steps {
		margin-top: 1.5rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		background: var(--paper-raised);
	}

	/* The platform the owner is actually holding gets the accent rule; the
	   others stay legible but recede. */
	.steps.highlight {
		border-color: var(--moss);
		box-shadow: inset 3px 0 0 var(--moss);
	}

	.steps h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	.steps ol {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.4rem;
	}

	.steps p {
		margin: 0;
		color: var(--ink-soft);
	}

	.footnote {
		margin-top: 1.5rem;
		max-width: 52ch;
	}

	.small {
		font-size: 0.8125rem;
	}
</style>
