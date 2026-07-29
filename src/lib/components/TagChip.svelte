<script lang="ts">
	import type { Tag } from '$lib/types';

	let {
		tag,
		pressed = false,
		interactive = false,
		onclick
	}: {
		tag: Tag;
		pressed?: boolean;
		interactive?: boolean;
		onclick?: () => void;
	} = $props();
</script>

{#if interactive}
	<button
		type="button"
		class="tag"
		style="color: {tag.color}"
		aria-pressed={pressed}
		onclick={() => onclick?.()}
	>
		<span class="tag-dot"></span>
		<span class="tag-text">{tag.name}</span>
	</button>
{:else}
	<span class="tag static" style="color: {tag.color}" aria-pressed={pressed}>
		<span class="tag-dot"></span>
		<span class="tag-text">{tag.name}</span>
	</span>
{/if}

<style>
	.static {
		cursor: default;
	}
</style>
