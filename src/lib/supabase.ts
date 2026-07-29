import { createClient, type Session } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { writable } from 'svelte/store';

export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
	auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

/** null = signed out, undefined = not resolved yet. */
export const session = writable<Session | null | undefined>(undefined);

export function initAuth() {
	supabase.auth.getSession().then(({ data }) => session.set(data.session));
	supabase.auth.onAuthStateChange((_event, s) => session.set(s));
}

/** Public URL for a file in one of the app's storage buckets. */
export function publicUrl(bucket: 'photos' | 'maps', path: string | null | undefined) {
	if (!path) return null;
	return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
