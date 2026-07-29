<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { session, supabase } from '$lib/supabase';
	import { t } from '$lib/i18n';

	let mode = $state<'password' | 'link'>('password');
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');
	let sent = $state(false);

	const next = $derived(page.url.searchParams.get('next') || '/');

	$effect(() => {
		if ($session) goto(next, { replaceState: true });
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = '';
		sent = false;
		try {
			if (mode === 'password') {
				const { error: err } = await supabase.auth.signInWithPassword({ email, password });
				if (err) throw err;
			} else {
				const { error: err } = await supabase.auth.signInWithOtp({
					email,
					options: { emailRedirectTo: window.location.origin + next }
				});
				if (err) throw err;
				sent = true;
			}
		} catch {
			error = t.errors.signIn;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{t.auth.signIn} — {t.app.name}</title></svelte:head>

<div class="gate">
	<!-- The sign-in card is the accession plate itself, oversized. It is the
	     first thing the app says about what it is. -->
	<div class="plate gate-plate">
		<span class="accession">ARBODB</span>
		<span class="sci">Arboretum</span>
		<span class="vernacular">{t.app.tagline}</span>

		<form onsubmit={submit} class="gate-form">
			<div class="field">
				<label for="email">{t.auth.email}</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					autocomplete="username"
					inputmode="email"
					placeholder="omistaja@arbodb.test"
				/>
			</div>

			{#if mode === 'password'}
				<div class="field">
					<label for="password">{t.auth.password}</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						autocomplete="current-password"
					/>
				</div>
			{/if}

			{#if error}
				<p class="gate-msg error">{error}</p>
			{/if}
			{#if sent}
				<p class="gate-msg ok">{t.auth.linkSent}</p>
			{/if}

			<button class="btn btn-primary btn-block" type="submit" disabled={busy}>
				{busy ? t.common.loading : mode === 'password' ? t.auth.signIn : t.auth.sendLink}
			</button>

			<button
				type="button"
				class="switch"
				onclick={() => {
					mode = mode === 'password' ? 'link' : 'password';
					error = '';
					sent = false;
				}}
			>
				{mode === 'password' ? t.auth.useLink : t.auth.usePassword}
			</button>
		</form>
	</div>

	<p class="aside">
		<a href="/julkinen">{t.reports.publicView}</a>
	</p>
</div>

<style>
	.gate {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		padding: var(--rail);
	}

	.gate-plate {
		max-width: 24rem;
		padding: 1.5rem 1.4rem 1.4rem;
	}

	/* No specimen, no status: the stake stripe would be meaningless here. */
	.gate-plate::before {
		display: none;
	}

	.gate-plate .sci {
		font-size: 1.75rem;
		padding-right: 5rem;
	}

	.gate-form {
		margin-top: 1.4rem;
		padding-top: 1.2rem;
		border-top: 1px solid rgba(237, 242, 230, 0.16);
	}

	/* Inside the plate the inputs sit on the dark material, not on paper. */
	.gate-form :global(label) {
		color: #9db09a;
	}

	.gate-form :global(input) {
		background: rgba(9, 18, 13, 0.55);
		border-color: rgba(237, 242, 230, 0.22);
		color: #eff4e9;
	}

	.gate-form :global(input:focus) {
		outline-color: var(--lichen);
		border-color: var(--lichen);
	}

	.gate-form :global(.btn-primary) {
		background: #b8862b;
		border-color: #b8862b;
		color: #17140a;
		margin-top: 0.35rem;
	}

	.gate-form :global(.btn-primary:hover:not(:disabled)) {
		background: #cd9a3a;
		border-color: #cd9a3a;
	}

	.switch {
		display: block;
		width: 100%;
		margin-top: 0.7rem;
		background: none;
		border: 0;
		color: #a9bda6;
		font-family: var(--font-ui);
		font-size: 0.8125rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
		padding: 0.5rem;
	}

	.gate-msg {
		font-size: 0.8125rem;
		margin: 0 0 0.6rem;
		padding: 0.5rem 0.6rem;
		border-radius: 2px;
	}

	.error {
		color: #f0b8ae;
		background: rgba(169, 50, 38, 0.25);
	}

	.ok {
		color: #cfe3c8;
		background: rgba(127, 174, 134, 0.2);
	}

	.aside {
		margin: 0;
		font-size: 0.8125rem;
	}
</style>
