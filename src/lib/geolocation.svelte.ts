/**
 * Device position, shared by field mode and the map. Watched rather than
 * polled: standing still under a canopy the fix keeps improving for the first
 * half minute, and the nearest-tree list should tighten up as it does.
 */

export interface Fix {
	lat: number;
	lon: number;
	accuracy: number;
	at: number;
}

class Geolocation {
	fix = $state<Fix | null>(null);
	error = $state<string | null>(null);
	watching = $state(false);

	#watchId: number | null = null;

	start() {
		if (this.#watchId !== null || !('geolocation' in navigator)) {
			if (!('geolocation' in navigator)) this.error = 'unsupported';
			return;
		}
		this.watching = true;
		this.error = null;
		this.#watchId = navigator.geolocation.watchPosition(
			(pos) => {
				this.fix = {
					lat: pos.coords.latitude,
					lon: pos.coords.longitude,
					accuracy: pos.coords.accuracy,
					at: pos.timestamp
				};
				this.error = null;
			},
			(err) => {
				this.error = err.message || 'denied';
				this.watching = false;
			},
			{ enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
		);
	}

	stop() {
		if (this.#watchId !== null) {
			navigator.geolocation.clearWatch(this.#watchId);
			this.#watchId = null;
		}
		this.watching = false;
	}

	/** One-shot high-accuracy fix, for stamping a new tree's position. */
	once(): Promise<Fix> {
		return new Promise((resolve, reject) => {
			if (!('geolocation' in navigator)) return reject(new Error('unsupported'));
			navigator.geolocation.getCurrentPosition(
				(pos) =>
					resolve({
						lat: pos.coords.latitude,
						lon: pos.coords.longitude,
						accuracy: pos.coords.accuracy,
						at: pos.timestamp
					}),
				reject,
				{ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
			);
		});
	}
}

export const geo = new Geolocation();
