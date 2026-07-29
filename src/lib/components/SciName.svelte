<script lang="ts">
	import { scientificParts } from '$lib/format';
	import type { Taxon } from '$lib/types';

	let { taxon }: { taxon: Taxon | null | undefined } = $props();

	const parts = $derived(scientificParts(taxon));
</script>

<!-- A scientific name, set the way botany sets it: binomial in italic, the
     cultivar epithet upright inside single quotes. Used everywhere. -->
<span class="sci">{parts.italic}{#if parts.cultivar}&nbsp;<span class="cv">{parts.cultivar}</span>{/if}</span>
