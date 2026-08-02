import { env } from '$env/dynamic/public';

const lajiApiToken = env.PUBLIC_LAJI_API_TOKEN ?? '';
export const lajiSearchEnabled = Boolean(lajiApiToken);

export interface TaxonNameValues {
	genus: string;
	species: string | null;
	infraspecific_rank: string | null;
	infraspecific_epithet: string | null;
	name_fi: string | null;
}

export interface LajiTaxonSuggestion {
	id: string;
	scientificName: string;
	vernacularName?: string;
	taxonRank?: string;
}

const clean = (value: string | null | undefined) => value?.trim().replace(/\s+/g, ' ') || null;

function genusCase(value: string): string {
	const lower = value.toLocaleLowerCase('fi-FI');
	return lower.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase('fi-FI'));
}

/** Apply the botanical and Finnish casing conventions at every import boundary. */
export function normalizeTaxonNames(values: TaxonNameValues): TaxonNameValues {
	const genus = clean(values.genus) ?? '';
	return {
		genus: genusCase(genus),
		species: clean(values.species)?.toLocaleLowerCase('fi-FI') ?? null,
		infraspecific_rank:
			clean(values.infraspecific_rank)?.toLocaleLowerCase('fi-FI') ?? null,
		infraspecific_epithet:
			clean(values.infraspecific_epithet)?.toLocaleLowerCase('fi-FI') ?? null,
		name_fi: clean(values.name_fi)?.toLocaleLowerCase('fi-FI') ?? null
	};
}

export function taxonNamesFromSuggestion(suggestion: LajiTaxonSuggestion): TaxonNameValues {
	const parts = suggestion.scientificName.trim().split(/\s+/).filter(Boolean);
	const rankIndex = parts.findIndex((part) => /^(?:subsp\.?|ssp\.?|var\.?|f\.)$/i.test(part));
	const speciesEnd = rankIndex === -1 ? parts.length : rankIndex;

	return normalizeTaxonNames({
		genus: parts[0] ?? '',
		species: parts.slice(1, speciesEnd).join(' ') || null,
		infraspecific_rank: rankIndex === -1 ? null : parts[rankIndex],
		infraspecific_epithet: rankIndex === -1 ? null : parts.slice(rankIndex + 1).join(' '),
		name_fi: suggestion.vernacularName ?? null
	});
}

export async function searchLajiTaxa(
	query: string,
	signal?: AbortSignal
): Promise<LajiTaxonSuggestion[]> {
	if (!lajiApiToken) return [];

	async function request(matchType: string) {
		const params = new URLSearchParams({
			query,
			limit: '8',
			nameTypes: 'MX.scientificName,MX.vernacularName',
			languages: 'fi',
			matchType
		});
		const response = await fetch(`https://api.laji.fi/autocomplete/taxa?${params}`, {
			signal,
			headers: {
				Authorization: `Bearer ${lajiApiToken}`,
				'API-Version': '1',
				'Accept-Language': 'fi'
			}
		});
		if (!response.ok) throw new Error(`Laji.fi autocomplete failed: ${response.status}`);
		const body = (await response.json()) as { results?: LajiTaxonSuggestion[] };
		return body.results ?? [];
	}

	const results = await request('exact,partial');
	const matches = results.length ? results : await request('likely');
	return [...new Map(matches.map((result) => [result.id, result])).values()];
}
