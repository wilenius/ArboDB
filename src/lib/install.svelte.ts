/**
 * Getting the app onto a phone's home screen.
 *
 * The two platforms disagree completely. Android fires `beforeinstallprompt`,
 * which can be caught and replayed later from a button of our own — but only
 * once, and only if the browser considers the app installable. iOS fires
 * nothing at all and has no API: the only route is Safari's share sheet, and
 * only Safari's, so Chrome on an iPhone cannot install this no matter what the
 * user does. Hence the platform sniffing, which is otherwise a bad habit: the
 * instructions genuinely differ, and showing the wrong ones sends the owner
 * hunting through a menu that does not contain the item.
 */

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'prompt' | 'ios-safari' | 'ios-other' | 'desktop' | 'unknown';

const DISMISSED_KEY = 'arbodb-install-dismissed';

function standalone(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		// Safari's own flag, which predates the standard media query.
		(navigator as unknown as { standalone?: boolean }).standalone === true
	);
}

class Install {
	/** Held so the owner can trigger the install from a button in our own UI. */
	deferred = $state<BeforeInstallPromptEvent | null>(null);
	/** True once the app is running from the home screen. */
	installed = $state(false);
	/** The owner closed the hint on the front page; don't nag. */
	dismissed = $state(false);

	#started = false;

	start() {
		if (this.#started || typeof window === 'undefined') return;
		this.#started = true;

		this.installed = standalone();
		try {
			this.dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
		} catch {
			/* private mode — the hint just comes back next time */
		}

		window.addEventListener('beforeinstallprompt', (e) => {
			// Chrome shows its own bar unless the event is cancelled; we want the
			// install to happen from the page, where it can be explained.
			e.preventDefault();
			this.deferred = e as BeforeInstallPromptEvent;
		});

		window.addEventListener('appinstalled', () => {
			this.installed = true;
			this.deferred = null;
		});
	}

	get platform(): InstallPlatform {
		if (typeof window === 'undefined') return 'unknown';
		if (this.deferred) return 'prompt';

		const ua = navigator.userAgent;
		// iPadOS reports itself as a Mac; the touch points give it away.
		const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
		if (ios) {
			// Every iOS browser is Safari underneath, but only Safari proper has
			// "Add to Home Screen". CriOS/FxiOS/EdgiOS do not.
			return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
		}

		return /Android/.test(ua) ? 'unknown' : 'desktop';
	}

	/** Whether it is worth pointing the owner at the install page at all. */
	get offerable(): boolean {
		return !this.installed && (this.platform === 'prompt' || this.platform === 'ios-safari');
	}

	async promptNow(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
		const event = this.deferred;
		if (!event) return 'unavailable';
		await event.prompt();
		const { outcome } = await event.userChoice;
		// The event is single-use: once replayed, Chrome will not hand it back.
		this.deferred = null;
		return outcome;
	}

	dismiss() {
		this.dismissed = true;
		try {
			localStorage.setItem(DISMISSED_KEY, '1');
		} catch {
			/* nothing to do */
		}
	}
}

export const install = new Install();
