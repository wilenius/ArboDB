<script lang="ts">
	import '$lib/styles/app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { initAuth, session, supabase } from '$lib/supabase';
	import { gardens } from '$lib/gardens.svelte';
	import { t } from '$lib/i18n';

	let { children } = $props();

	// Anyone may read the published catalogue; everything else needs an account.
	const PUBLIC_ROUTES = ['/kirjaudu', '/julkinen'];

	const isPublicRoute = $derived(
		PUBLIC_ROUTES.some((r) => page.url.pathname === r || page.url.pathname.startsWith(r + '/'))
	);

	let theme = $state<'light' | 'dark'>('light');

	onMount(() => {
		initAuth();
		theme = (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light';
	});

	$effect(() => {
		if ($session === undefined) return;
		if ($session === null && !isPublicRoute) {
			goto('/kirjaudu?next=' + encodeURIComponent(page.url.pathname), { replaceState: true });
		}
	});

	// Load the gardens once per session: every screen scopes itself to the
	// active one, so nothing should have to fetch this for itself.
	$effect(() => {
		if ($session && !gardens.loaded) gardens.load();
	});

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('arbodb-theme', theme);
		} catch {
			/* private mode — the toggle just won't stick */
		}
	}

	async function signOut() {
		await supabase.auth.signOut();
		goto('/kirjaudu');
	}

	const NAV = [
		{ href: '/', label: t.nav.nearby, glyph: '◉' },
		{ href: '/kartta', label: t.nav.map, glyph: '▤' },
		{ href: '/rekisteri', label: t.nav.registry, glyph: '☰' },
		{ href: '/raportit', label: t.nav.reports, glyph: '❑' }
	];

	function isActive(href: string) {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	const showChrome = $derived(Boolean($session) && page.url.pathname !== '/kirjaudu');
</script>

<div class="app" class:with-chrome={showChrome}>
	{#if showChrome}
		<header class="app-header no-print">
			<a class="wordmark" href="/">
				<span class="mark" aria-hidden="true"></span>
				<span class="name">{t.app.name}</span>
				<span class="sub">{t.app.tagline}</span>
			</a>
			<div class="header-actions">
				<!-- The picker earns its place only once there is a second plot. -->
				{#if gardens.multiple}
					<select
						class="garden-select"
						aria-label={t.garden.switch}
						value={gardens.active?.id ?? ''}
						onchange={(e) => gardens.select(e.currentTarget.value)}
					>
						{#each gardens.all as garden (garden.id)}
							<option value={garden.id}>{garden.name}</option>
						{/each}
					</select>
				{:else if gardens.active}
					<a class="garden-name" href="/puutarhat">{gardens.active.name}</a>
				{/if}
				<button
					type="button"
					class="icon-btn"
					onclick={toggleTheme}
					aria-label={theme === 'dark' ? 'Vaalea teema' : 'Tumma teema'}
				>
					{theme === 'dark' ? '☀' : '☾'}
				</button>
				<button type="button" class="icon-btn" onclick={signOut}>{t.auth.signOut}</button>
			</div>
		</header>

		<nav class="app-nav no-print" aria-label={t.nav.registry}>
			{#each NAV as item (item.href)}
				<a href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
					<span class="glyph" aria-hidden="true">{item.glyph}</span>
					<span class="label">{item.label}</span>
				</a>
			{/each}
		</nav>
	{/if}

	<main>
		{#if $session === undefined && !isPublicRoute}
			<p class="section muted">{t.auth.checking}</p>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>

<style>
	.app {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	main {
		flex: 1;
		padding-bottom: 1.5rem;
	}

	.with-chrome main {
		/* Clear the bottom tab bar, including the phone's home indicator. */
		padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
	}

	.app-header {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem var(--rail);
		background: color-mix(in oklab, var(--paper) 88%, transparent);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--hairline);
	}

	.wordmark {
		display: grid;
		grid-template-columns: auto auto;
		grid-template-rows: auto auto;
		column-gap: 0.5rem;
		align-items: center;
		text-decoration: none;
		color: var(--ink);
	}

	.mark {
		grid-row: 1 / 3;
		width: 0.9rem;
		height: 1.6rem;
		border-radius: 1px;
		background: linear-gradient(178deg, #22392b, #16281e);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
		position: relative;
	}

	/* A miniature of the accession plate, down to the engraved inner rule. */
	.mark::after {
		content: '';
		position: absolute;
		inset: 2px;
		border: 1px solid rgba(184, 134, 43, 0.65);
		border-radius: 1px;
	}

	.name {
		font-family: var(--font-display);
		font-size: 1.0625rem;
		line-height: 1.05;
		letter-spacing: 0.01em;
	}

	.sub {
		font-family: var(--font-data);
		font-size: 0.625rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bark);
		line-height: 1.2;
	}

	.header-actions {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}

	.garden-select {
		width: auto;
		min-width: 7rem;
		min-height: 2.25rem;
		padding: 0.2rem 0.4rem;
		font-size: 0.8125rem;
	}

	.garden-name {
		font-family: var(--font-data);
		font-size: 0.6875rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--bark);
		text-decoration: none;
		padding: 0.3rem 0.5rem;
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		white-space: nowrap;
	}

	.garden-name:hover {
		color: var(--ink);
		border-color: var(--hairline-strong);
	}

	.icon-btn {
		min-height: 2.25rem;
		padding: 0 0.6rem;
		border: 1px solid transparent;
		border-radius: var(--radius);
		background: none;
		color: var(--bark);
		font-family: var(--font-ui);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.icon-btn:hover {
		color: var(--ink);
		border-color: var(--hairline-strong);
	}

	/* Bottom bar on a phone: everything within thumb reach, one-handed. */
	.app-nav {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		background: color-mix(in oklab, var(--paper) 92%, transparent);
		backdrop-filter: blur(10px);
		border-top: 1px solid var(--hairline);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.app-nav a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		min-height: 3.5rem;
		text-decoration: none;
		color: var(--bark);
		font-size: 0.6875rem;
		letter-spacing: 0.02em;
		position: relative;
	}

	.app-nav a[aria-current='page'] {
		color: var(--moss);
	}

	/* The active tab is marked with a stake, not a pill. */
	.app-nav a[aria-current='page']::before {
		content: '';
		position: absolute;
		top: 0;
		width: 1.75rem;
		height: 2px;
		background: var(--moss);
	}

	.glyph {
		font-size: 1.05rem;
		line-height: 1;
	}

	/* One garden means the name is decoration; a phone header has no room for it. */
	@media (max-width: 30rem) {
		.garden-name {
			display: none;
		}
	}

	@media (min-width: 60rem) {
		.app-nav {
			position: sticky;
			top: 3.25rem;
			bottom: auto;
			border-top: 0;
			border-bottom: 1px solid var(--hairline);
			grid-auto-columns: max-content;
			justify-content: center;
			gap: 0.25rem;
			padding: 0;
		}

		.app-nav a {
			flex-direction: row;
			gap: 0.45rem;
			min-height: 2.75rem;
			padding: 0 1rem;
			font-size: 0.875rem;
		}

		.with-chrome main {
			padding-bottom: 3rem;
		}
	}
</style>
