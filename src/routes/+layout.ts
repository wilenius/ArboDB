// The whole app talks to Supabase from the browser under row level security,
// so there is nothing for a server to render and nothing to deploy but static
// files.
export const ssr = false;
export const prerender = false;
