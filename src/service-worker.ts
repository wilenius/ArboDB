/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

/**
 * The app shell, cached.
 *
 * This exists for two reasons, and offline browsing is only the second one.
 * The first is that Chrome will not offer to install a web app — no prompt, no
 * proper icon, only the "add shortcut" item buried in the menu — unless the
 * site has a service worker that answers a fetch. The manifest alone is not
 * enough. So the file that puts the button on the owner's home screen is this
 * one.
 *
 * What it does *not* do is make the register work offline. Every row still
 * comes from Supabase over the network. What the cache buys in the field is
 * that a weak signal no longer means a white screen: the app opens, the map
 * chrome is there, and only the data is missing.
 */

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `arbodb-${version}`;

/** Hashed bundles and everything in `static/`. Safe to serve cache-first. */
const ASSETS = [...build, ...files];

/**
 * The SPA fallback. Deep links like /kartta are served this same document by
 * the host, so one cached copy covers every route in the app.
 */
const SHELL = '/';

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
			// Separately, and tolerantly: a failed shell fetch must not abort the
			// whole install and leave the app uninstallable.
			await cache.add(SHELL).catch(() => {});
			await sw.skipWaiting();
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;

	// Supabase, GoTrue and the MML tile endpoints are all cross-origin, and none
	// of them may be served stale. Leaving them alone also keeps auth traffic
	// out of the cache.
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	// A hard load of any route: prefer the network so a new deploy is picked up,
	// but fall back to the cached shell rather than failing.
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					return await fetch(request);
				} catch {
					const cache = await caches.open(CACHE);
					return (
						(await cache.match(SHELL)) ??
						new Response('Offline', { status: 503, statusText: 'Offline' })
					);
				}
			})()
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Build artefacts carry a content hash in the name, so a hit is always
			// the right file and never needs revalidating.
			if (ASSETS.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}

			try {
				const response = await fetch(request);
				if (response.ok && response.type === 'basic') {
					cache.put(request, response.clone());
				}
				return response;
			} catch {
				const hit = await cache.match(request);
				if (hit) return hit;
				throw new Error('offline and not cached');
			}
		})()
	);
});
