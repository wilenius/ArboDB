import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
	preprocess: vitePreprocess(),
	kit: {
		// Single-page app: all data access happens in the browser against
		// Supabase/PostgREST, so there is no server to deploy. Drops straight
		// onto Cloudflare Pages' free tier.
		adapter: adapter({ fallback: 'index.html', strict: false })
	}
};
