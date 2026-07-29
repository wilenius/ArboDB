<script lang="ts">
	import SciName from './SciName.svelte';
	import { formatDate } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Observation, Taxon } from '$lib/types';

	/**
	 * Height and diameter over time, one line per specimen.
	 *
	 * Height (cm) and diameter (mm) are different measures on different scales,
	 * so they are never drawn on two y-axes — the reader picks one at a time and
	 * the axis always means one thing. Series colours are a fixed order, assigned
	 * per specimen and never recycled; past four specimens the rest fold into a
	 * muted "muut" group rather than inventing hues.
	 */

	let {
		observations = [],
		title = '',
		taxon = null
	}: { observations?: Observation[]; title?: string; taxon?: Taxon | null } = $props();

	type Measure = 'height_cm' | 'diameter_mm';
	let measure = $state<Measure>('height_cm');
	let showTable = $state(false);
	let hover = $state<{ x: number; y: number; point: Point } | null>(null);

	// Validated with the dataviz palette checker against both chart surfaces:
	// light #f5f7f0 and dark #1a241d. Order is fixed; do not re-sort by value.
	const SERIES_LIGHT = ['#2C7D42', '#C4870E', '#2A7FB0', '#B32A1A'];
	const SERIES_DARK = ['#35A06C', '#BE8710', '#5195CC', '#D0604F'];
	const OVERFLOW_COLOR = '#8d8676';

	let dark = $state(false);
	$effect(() => {
		const read = () => (dark = document.documentElement.dataset.theme === 'dark');
		read();
		const mo = new MutationObserver(read);
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => mo.disconnect();
	});

	const ramp = $derived(dark ? SERIES_DARK : SERIES_LIGHT);

	interface Point {
		t: number;
		v: number;
		label: string;
		date: string;
	}
	interface Series {
		key: string;
		label: string;
		color: string;
		points: Point[];
	}

	const unit = $derived(measure === 'height_cm' ? 'cm' : 'mm');

	const series = $derived.by<Series[]>(() => {
		const groups = new Map<string, Point[]>();
		for (const o of observations) {
			const v = o[measure];
			if (v == null) continue;
			const key = o.tree_id ?? `p:${o.planting_id}`;
			const label = o.trees?.label ?? o.plantings?.accession_code ?? 'Erä';
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push({
				t: new Date(o.observed_at).getTime(),
				v,
				label,
				date: o.observed_at
			});
		}

		const out = [...groups.entries()]
			.map(([key, points]) => ({
				key,
				label: points[0].label,
				color: OVERFLOW_COLOR,
				points: points.sort((a, b) => a.t - b.t)
			}))
			.filter((s) => s.points.length > 0)
			// Longest record first, so the specimens with real history get the
			// distinct hues and short stubs fall into the muted overflow.
			.sort((a, b) => b.points.length - a.points.length);

		return out.map((s, i) => ({ ...s, color: i < ramp.length ? ramp[i] : OVERFLOW_COLOR }));
	});

	const allPoints = $derived(series.flatMap((s) => s.points));

	// --- scales -------------------------------------------------------------

	const W = 720;
	const H = 300;
	const PAD = { top: 16, right: 76, bottom: 30, left: 46 };

	const domain = $derived.by(() => {
		if (!allPoints.length) return null;
		const ts = allPoints.map((p) => p.t);
		const vs = allPoints.map((p) => p.v);
		const t0 = Math.min(...ts);
		const t1 = Math.max(...ts);
		const vMax = Math.max(...vs);
		return {
			t0,
			t1: t1 === t0 ? t0 + 86400000 : t1,
			v0: 0,
			v1: vMax * 1.08 || 1
		};
	});

	const x = (t: number) => {
		if (!domain) return 0;
		return (
			PAD.left + ((t - domain.t0) / (domain.t1 - domain.t0)) * (W - PAD.left - PAD.right)
		);
	};
	const y = (v: number) => {
		if (!domain) return 0;
		return H - PAD.bottom - ((v - domain.v0) / (domain.v1 - domain.v0)) * (H - PAD.top - PAD.bottom);
	};

	function path(points: Point[]): string {
		return points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
	}

	/** Round tick values that stay readable at a glance. */
	const yTicks = $derived.by(() => {
		if (!domain) return [];
		const raw = domain.v1 / 4;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
		const out: number[] = [];
		for (let v = 0; v <= domain.v1; v += step) out.push(v);
		return out;
	});

	const xTicks = $derived.by(() => {
		if (!domain) return [];
		const y0 = new Date(domain.t0).getFullYear();
		const y1 = new Date(domain.t1).getFullYear();
		const span = Math.max(1, y1 - y0);
		const step = Math.ceil(span / 5);
		const out: { t: number; label: string }[] = [];
		for (let yr = y0; yr <= y1; yr += step) {
			out.push({ t: new Date(yr, 0, 1).getTime(), label: String(yr) });
		}
		return out;
	});

	function onMove(e: MouseEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * W;
		let best: { d: number; p: Point } | null = null;
		for (const s of series) {
			for (const p of s.points) {
				const d = Math.abs(x(p.t) - px);
				if (!best || d < best.d) best = { d, p };
			}
		}
		hover = best && best.d < 40 ? { x: x(best.p.t), y: y(best.p.v), point: best.p } : null;
	}
</script>

<figure class="chart">
	<figcaption>
		<div>
			<h3>
				{#if taxon}
					<SciName {taxon} />
				{:else}
					{title || t.reports.growth}
				{/if}
			</h3>
			<p class="muted small">
				{measure === 'height_cm' ? t.observation.height : t.observation.diameter}
			</p>
		</div>
		<div class="controls no-print">
			<div class="toggle" role="group" aria-label={t.reports.growth}>
				<button
					type="button"
					data-active={measure === 'height_cm'}
					onclick={() => (measure = 'height_cm')}>Korkeus</button
				>
				<button
					type="button"
					data-active={measure === 'diameter_mm'}
					onclick={() => (measure = 'diameter_mm')}>Läpimitta</button
				>
			</div>
			<button class="btn btn-sm" type="button" onclick={() => (showTable = !showTable)}>
				{showTable ? 'Kuvaaja' : 'Taulukko'}
			</button>
		</div>
	</figcaption>

	{#if !allPoints.length}
		<p class="empty">{t.reports.noData}</p>
	{:else if showTable}
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th>{t.tree.one}</th>
						<th>{t.observation.observedAt}</th>
						<th>{measure === 'height_cm' ? t.observation.height : t.observation.diameter}</th>
					</tr>
				</thead>
				<tbody>
					{#each series as s (s.key)}
						{#each s.points as p (p.date)}
							<tr>
								<td>
									<span class="swatch" style="background:{s.color}"></span>
									{s.label}
								</td>
								<td class="num">{formatDate(p.date)}</td>
								<td class="num">{p.v} {unit}</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<svg
			viewBox="0 0 {W} {H}"
			role="img"
			aria-label="{title || t.reports.growth}: {series.length} sarjaa"
			onmousemove={onMove}
			onmouseleave={() => (hover = null)}
		>
			<!-- Recessive grid: horizontal only, so the eye reads values not cells. -->
			{#each yTicks as tick (tick)}
				<line class="grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
				<text class="tick" x={PAD.left - 8} y={y(tick) + 4} text-anchor="end">{tick}</text>
			{/each}

			{#each xTicks as tick (tick.t)}
				<text class="tick" x={x(tick.t)} y={H - 10} text-anchor="middle">{tick.label}</text>
			{/each}

			<line class="axis" x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} />

			{#each series as s (s.key)}
				<path class="line" d={path(s.points)} stroke={s.color} />
				{#each s.points as p (p.date)}
					<circle class="dot" cx={x(p.t)} cy={y(p.v)} r="4.5" fill={s.color} />
				{/each}
				<!-- Direct label at the end of the line: identity without a lookup,
				     and the relief the palette check asks for. -->
				<text
					class="series-label"
					x={x(s.points.at(-1)!.t) + 8}
					y={y(s.points.at(-1)!.v) + 4}
					fill={s.color}>{s.label}</text
				>
			{/each}

			{#if hover}
				<line class="crosshair" x1={hover.x} x2={hover.x} y1={PAD.top} y2={H - PAD.bottom} />
				<circle class="dot-hover" cx={hover.x} cy={hover.y} r="7" />
			{/if}
		</svg>

		{#if hover}
			<p class="tooltip data" style="left: {(hover.x / W) * 100}%">
				<strong>{hover.point.label}</strong>
				{formatDate(hover.point.date)} · {hover.point.v} {unit}
			</p>
		{/if}

		{#if series.length > 1}
			<ul class="legend">
				{#each series as s (s.key)}
					<li><span class="swatch" style="background:{s.color}"></span>{s.label}</li>
				{/each}
			</ul>
		{/if}
	{/if}
</figure>

<style>
	.chart {
		margin: 0 0 1.25rem;
		position: relative;
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		background: var(--paper-raised);
		padding: 0.9rem 1rem 1rem;
	}

	figcaption {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}

	figcaption h3 {
		margin: 0;
	}

	.small {
		font-size: 0.75rem;
		margin: 0.1rem 0 0;
	}

	.controls {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.toggle {
		display: flex;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.toggle button {
		border: 0;
		background: var(--paper);
		color: var(--bark);
		font-family: var(--font-ui);
		font-size: 0.75rem;
		padding: 0.4rem 0.6rem;
		cursor: pointer;
		min-height: 2.125rem;
	}

	.toggle button[data-active='true'] {
		background: var(--moss);
		color: #f4f8f0;
	}

	svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}

	.grid {
		stroke: var(--hairline);
		stroke-width: 1;
	}

	.axis {
		stroke: var(--hairline-strong);
		stroke-width: 1;
	}

	.tick {
		font-family: var(--font-data);
		font-size: 10px;
		fill: var(--bark);
	}

	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	/* A surface-coloured ring keeps overlapping points readable. */
	.dot {
		stroke: var(--paper-raised);
		stroke-width: 2;
	}

	.series-label {
		font-family: var(--font-data);
		font-size: 11px;
		font-weight: 500;
	}

	.crosshair {
		stroke: var(--hairline-strong);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}

	.dot-hover {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1.5;
	}

	.tooltip {
		position: absolute;
		top: 3.2rem;
		transform: translateX(-50%);
		margin: 0;
		padding: 0.3rem 0.55rem;
		background: var(--ink);
		color: var(--paper);
		border-radius: 2px;
		font-size: 0.75rem;
		white-space: nowrap;
		pointer-events: none;
	}

	.tooltip strong {
		margin-right: 0.35rem;
	}

	.legend {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1rem;
		margin: 0.5rem 0 0;
		padding: 0;
		font-size: 0.8125rem;
		color: var(--ink-soft);
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.swatch {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 2px;
		display: inline-block;
		flex: none;
	}
</style>
