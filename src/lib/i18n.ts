/**
 * All user-facing text lives here, in Finnish. Nothing is hard-coded in the
 * components, so adding a second language later means adding a second
 * dictionary and a store to pick between them — not a rewrite.
 */

export const fi = {
	app: {
		name: 'Arboretum',
		tagline: 'Puurekisteri'
	},
	nav: {
		nearby: 'Lähistöllä',
		map: 'Kartta',
		registry: 'Rekisteri',
		reports: 'Raportit',
		more: 'Lisää'
	},
	auth: {
		signIn: 'Kirjaudu sisään',
		signOut: 'Kirjaudu ulos',
		email: 'Sähköposti',
		password: 'Salasana',
		sendLink: 'Lähetä kirjautumislinkki',
		linkSent: 'Linkki lähetetty. Avaa se puhelimellasi tai koneellasi.',
		usePassword: 'Kirjaudu salasanalla',
		useLink: 'Kirjaudu sähköpostilinkillä',
		needAccount: 'Kirjautuminen vaaditaan',
		checking: 'Tarkistetaan…'
	},
	common: {
		save: 'Tallenna',
		saving: 'Tallennetaan…',
		saved: 'Tallennettu',
		cancel: 'Peruuta',
		delete: 'Poista',
		edit: 'Muokkaa',
		back: 'Takaisin',
		add: 'Lisää',
		search: 'Haku',
		filter: 'Rajaa',
		all: 'Kaikki',
		none: 'Ei mitään',
		loading: 'Ladataan…',
		empty: 'Ei tuloksia',
		yes: 'Kyllä',
		no: 'Ei',
		close: 'Sulje',
		print: 'Tulosta',
		confirmDelete: 'Poistetaanko pysyvästi?'
	},
	nearby: {
		title: 'Olen puun vieressä',
		locating: 'Haetaan sijaintia…',
		locationDenied:
			'Sijaintia ei saatu. Salli paikannus selaimen asetuksista tai etsi puu rekisteristä.',
		accuracy: 'Tarkkuus',
		noPositions: 'Yhdelläkään puulla ei ole vielä sijaintia.',
		retry: 'Hae sijainti uudelleen',
		showAll: 'Näytä kaikki',
		showNear: 'Näytä lähimmät'
	},
	taxon: {
		one: 'Taksoni',
		many: 'Taksonit',
		genus: 'Suku',
		species: 'Laji',
		rank: 'Alataso',
		epithet: 'Alatason nimi',
		cultivar: 'Lajike',
		nameFi: 'Suomenkielinen nimi',
		mustilaUrl: 'Mustilan sivu',
		notes: 'Muistiinpanot',
		new: 'Uusi taksoni',
		openMustila: 'Avaa Mustilan sivu'
	},
	planting: {
		one: 'Istutus',
		many: 'Istutukset',
		accession: 'Tunnus',
		year: 'Istutusvuosi',
		month: 'Kuukausi',
		count: 'Kappalemäärä',
		size: 'Taimen koko (cm)',
		propagation: 'Lisäystapa',
		provenance: 'Alkuperä',
		originType: 'Tyyppi',
		status: 'Tila',
		notes: 'Muistiinpanot',
		position: 'Sijainti',
		radius: 'Säde (m)',
		published: 'Julkaistu',
		publishedHelp: 'Julkaistut istutukset näkyvät julkisessa raportissa ilman kirjautumista.',
		new: 'Uusi istutus',
		trees: 'Yksilöt',
		addTree: 'Lisää yksilö',
		noTrees: 'Ei erikseen kirjattuja yksilöitä. Havainnot kohdistuvat koko erään.',
		specimens: (n: number) => `${n} ${n === 1 ? 'taimi' : 'tainta'}`
	},
	tree: {
		one: 'Yksilö',
		many: 'Yksilöt',
		label: 'Tunniste',
		status: 'Tila',
		accuracy: 'Tarkkuus (m)',
		source: 'Sijainnin lähde',
		notes: 'Muistiinpanot',
		captureGps: 'Ota sijainti GPS:llä',
		capturing: 'Paikannetaan…',
		noPosition: 'Ei sijaintia',
		new: 'Uusi yksilö'
	},
	observation: {
		one: 'Havainto',
		many: 'Havainnot',
		new: 'Uusi havainto',
		observedAt: 'Havaintoaika',
		kind: 'Laji',
		height: 'Korkeus (cm)',
		diameter: 'Läpimitta (mm)',
		body: 'Havainto',
		bodyPlaceholder: 'Sanele tai kirjoita havainto…',
		tags: 'Tunnisteet',
		photos: 'Kuvat',
		addPhoto: 'Lisää kuva',
		targetTree: 'Kohde: yksilö',
		targetPlanting: 'Kohde: koko erä',
		latest: 'Viimeisimmät havainnot',
		count: (n: number) => `${n} ${n === 1 ? 'havainto' : 'havaintoa'}`,
		none: 'Ei havaintoja vielä.'
	},
	tag: {
		one: 'Tunniste',
		many: 'Tunnisteet',
		name: 'Nimi',
		color: 'Väri',
		new: 'Uusi tunniste',
		usage: 'Käytössä',
		merge: 'Yhdistä toiseen',
		mergeInto: 'Yhdistä tunnisteeseen',
		mergeHelp:
			'Kaikki tämän tunnisteen havainnot siirtyvät valittuun tunnisteeseen, ja tämä tunniste poistetaan.',
		bulk: 'Joukkomerkintä',
		bulkHelp: 'Valitse havainnot ja lisää tai poista tunniste kerralla.',
		addToSelected: 'Lisää valituille',
		removeFromSelected: 'Poista valituilta',
		selected: (n: number) => `${n} valittu`
	},
	garden: {
		one: 'Puutarha',
		many: 'Puutarhat',
		name: 'Nimi',
		notes: 'Kuvaus',
		new: 'Uusi puutarha',
		none: 'Puutarhoja ei ole vielä luotu.',
		noneHelp:
			'Luo ensin puutarha: se antaa istutuksille sijainnin ja määrää mihin kartta avautuu.',
		switch: 'Vaihda puutarhaa',
		manage: 'Hallinnoi puutarhoja',
		boundary: 'Raja',
		boundaryNone: 'Rajaa ei ole vielä piirretty.',
		boundarySource: 'Rajan lähde',
		boundarySources: {
			drawn: 'Käsin piirretty',
			imported: 'Tuotu tiedostosta',
			survey: 'Mittausaineisto'
		},
		drawnWarning:
			'Raja on piirretty käsin, joten se on suuntaa antava. Korvaa mittausaineistolla kun se on saatavilla.',
		draw: 'Piirrä raja',
		redraw: 'Piirrä uudelleen',
		drawing: 'Piirtämässä',
		drawHelp:
			'Napauta karttaa lisätäksesi kulmapisteen. Vedä pistettä siirtääksesi sitä. Kolme pistettä riittää.',
		finish: 'Valmis',
		undo: 'Kumoa piste',
		clear: 'Tyhjennä',
		corner: 'Kulmapiste',
		corners: (n: number) => `${n} ${n === 1 ? 'piste' : 'pistettä'}`,
		area: 'Pinta-ala',
		perimeter: 'Piiri',
		center: 'Kartan keskipiste',
		centerFromBoundary: 'Keskitä rajan mukaan',
		centerFromHere: 'Käytä nykyistä sijaintia',
		zoom: 'Oletuszoomaus',
		plantingCount: 'Istutuksia',
		cannotDelete: 'Puutarhassa on istutuksia, joten sitä ei voi poistaa.',
		hectares: (ha: number) => `${ha.toFixed(2).replace('.', ',')} ha`
	},
	map: {
		title: 'Kartta',
		layers: 'Karttatasot',
		basemap: 'Taustakartta',
		aerial: 'Ilmakuva',
		terrain: 'Maastokartta',
		osm: 'OpenStreetMap',
		blank: 'Tyhjä',
		dragHelp: 'Vedä merkkiä korjataksesi sijaintia. Muutos tallentuu heti.',
		editPositions: 'Muokkaa sijainteja',
		doneEditing: 'Lopeta muokkaus',
		moved: 'Sijainti päivitetty',
		locate: 'Keskitä omaan sijaintiin',
		mmlMissing:
			'MML:n API-avainta ei ole asetettu, joten ilmakuva ja maastokartta eivät ole käytettävissä. Lisää avain .env-tiedostoon (PUBLIC_MML_API_KEY).',
		importedLayers: 'Tuodut tasot',
		noLayers: 'Ei tuotuja tasoja.',
		addLayer: 'Tuo karttataso',
		layerName: 'Tason nimi',
		layerFile: 'Tiedosto',
		geojsonHelp:
			'GeoJSON: tontin raja, polut, kasvillisuuskuviot. Koordinaatit tunnistetaan automaattisesti (WGS84 tai ETRS-TM35FIN).',
		imageHelp:
			'Kuva + world-tiedosto (.jgw/.pgw/.tfw): esimerkiksi MML:n ortoilmakuva tai dronekuva. Ilman world-tiedostoa voit antaa reunakoordinaatit käsin.',
		worldFile: 'World-tiedosto',
		crs: 'Koordinaatisto',
		bounds: 'Reunakoordinaatit',
		north: 'Pohjoinen',
		south: 'Etelä',
		east: 'Itä',
		west: 'Länsi',
		opacity: 'Läpinäkyvyys',
		visible: 'Näkyvissä',
		imported: 'Taso tuotu'
	},
	registry: {
		title: 'Rekisteri',
		importExport: 'Tuonti ja vienti',
		gardenFilter: 'Näytetään puutarhan istutukset'
	},
	importer: {
		title: 'CSV-tuonti',
		help: 'Tuo olemassa oleva istutusluettelo. Ensimmäinen rivi on otsikkorivi.',
		columns: 'Sarakkeet',
		pickFile: 'Valitse CSV-tiedosto',
		preview: 'Esikatselu',
		mapping: 'Sarakkeiden vastaavuus',
		rowsFound: (n: number) => `${n} riviä luettu`,
		willCreate: (t: number, p: number) => `Luodaan ${t} uutta taksonia ja ${p} istutusta.`,
		run: 'Tuo tiedot',
		running: 'Tuodaan…',
		done: (n: number) => `${n} istutusta tuotu.`,
		errors: 'Virheelliset rivit',
		exampleHeader: 'Esimerkkitiedosto'
	},
	exporter: {
		title: 'Vienti',
		help: 'Vie taulukko CSV- tai XLSX-muodossa. Vienti noudattaa näkymän rajauksia.',
		csv: 'Lataa CSV',
		xlsx: 'Lataa XLSX',
		what: 'Mitä viedään'
	},
	reports: {
		title: 'Raportit',
		registry: 'Istutusrekisteri',
		registryHelp: 'Koko rekisteri taulukkona, tulostettavassa muodossa.',
		observations: 'Havaintoluettelo',
		observationsHelp: 'Havainnot ajanjaksolta, tunnisteella tai taksonilla rajattuna.',
		growth: 'Kasvukäyrät',
		growthHelp: 'Mitatut korkeudet ajan funktiona yksilöittäin.',
		gallery: 'Kuvagalleria',
		galleryHelp: 'Kaikki kuvat aikajärjestyksessä.',
		from: 'Alkaen',
		to: 'Asti',
		noData: 'Ei aineistoa valitulla rajauksella.',
		summary: 'Yhteenveto',
		taxaCount: 'Taksonia',
		plantingCount: 'Istutusta',
		treeCount: 'Yksilöä',
		specimenCount: 'Tainta istutettu',
		observationCount: 'Havaintoa',
		publicView: 'Julkinen näkymä'
	},
	publicSite: {
		title: 'Arboretumin julkinen luettelo',
		intro:
			'Julkaistut istutukset ja niiden havainnot. Tiedot päivittyvät sitä mukaa kun omistaja julkaisee niitä.',
		empty: 'Yhtään istutusta ei ole vielä julkaistu.',
		backToApp: 'Kirjaudu sisään'
	},
	enums: {
		originType: { planted: 'Istutettu', original: 'Alkuperäinen' },
		plantingStatus: { active: 'Elossa', removed: 'Poistettu', dead: 'Kuollut' },
		treeStatus: { alive: 'Elossa', dead: 'Kuollut', removed: 'Poistettu' },
		positionSource: { gps: 'GPS', manual: 'Käsin' },
		kind: {
			growth: 'Kasvu',
			care: 'Hoito',
			damage: 'Vaurio',
			phenology: 'Fenologia',
			other: 'Muu'
		}
	},
	months: [
		'tammikuu',
		'helmikuu',
		'maaliskuu',
		'huhtikuu',
		'toukokuu',
		'kesäkuu',
		'heinäkuu',
		'elokuu',
		'syyskuu',
		'lokakuu',
		'marraskuu',
		'joulukuu'
	],
	errors: {
		generic: 'Jokin meni pieleen. Yritä uudelleen.',
		load: 'Tietojen lataus epäonnistui.',
		save: 'Tallennus epäonnistui.',
		signIn: 'Kirjautuminen epäonnistui. Tarkista sähköposti ja salasana.',
		upload: 'Kuvan lähetys epäonnistui.',
		fileType: 'Tiedostotyyppiä ei tueta.',
		noGeometry: 'Tiedostosta ei löytynyt geometriaa.'
	}
};

export const t = fi;
