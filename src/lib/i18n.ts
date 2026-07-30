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
		moreFields: 'Lisätiedot',
		confirmDelete: 'Poistetaanko pysyvästi?'
	},
	install: {
		title: 'Asenna puhelimeen',
		lead: 'Sovelluksen saa puhelimen aloitusnäytölle omaksi kuvakkeekseen. Se avautuu silloin ilman selaimen osoiterivia ja käynnistyy heti, myös heikolla kentällä.',
		hint: 'Lisää sovellus puhelimen aloitusnäyttöön',
		hintAction: 'Näytä ohje',
		dismiss: 'Piilota',
		button: 'Asenna nyt',
		installing: 'Asennetaan…',
		installed: 'Sovellus on jo asennettu tälle laitteelle.',
		accepted: 'Valmis. Kuvake löytyy aloitusnäytöltä.',
		declined: 'Asennus peruttiin. Voit palata tähän milloin tahansa.',
		iosSafari: {
			title: 'iPhone ja iPad',
			steps: [
				'Napauta selaimen alareunan Jaa-painiketta (neliö, jossa on ylöspäin osoittava nuoli).',
				'Vieritä valikkoa alaspäin ja valitse "Lisää Koti-valikkoon".',
				'Napauta oikeasta yläkulmasta "Lisää".'
			]
		},
		iosOther: {
			title: 'Avaa Safarilla',
			body: 'Applen laitteilla vain Safari osaa lisätä sovelluksen aloitusnäytölle. Avaa tämä sivu Safarilla ja palaa tähän ohjeeseen.'
		},
		android: {
			title: 'Android',
			steps: [
				'Avaa selaimen valikko oikeasta yläkulmasta (kolme pistettä).',
				'Valitse "Asenna sovellus" tai "Lisää aloitusnäyttöön".',
				'Vahvista valinta.'
			]
		},
		desktop: {
			title: 'Tietokone',
			body: 'Osoiterivin oikeassa reunassa on asennuskuvake, jolla sovelluksen saa omaan ikkunaansa. Puhelimen kuvake on kuitenkin se, jota maastossa tarvitset.'
		},
		offlineNote:
			'Asennettu sovellus käynnistyy ilman verkkoyhteyttä, mutta puiden tiedot haetaan silti palvelimelta. Metsässä ilman kenttää sovellus siis avautuu, mutta luettelo jää tyhjäksi.'
	},
	quick: {
		title: 'Pikakirjaus',
		lead: 'Kirjaa taimi paikan päällä. Vain sijainti tarvitaan nyt — laji, määrät ja muut tiedot voi täydentää koneella myöhemmin.',
		waiting: 'Odotetaan tarkkaa sijaintia…',
		positionFrom: 'Sijainti puhelimen GPS:stä',
		retake: 'Ota sijainti uudelleen',
		taxonOptional: 'Laji (voi jättää tyhjäksi)',
		taxonSearch: 'Etsi lajia',
		noTaxon: '— täydennetään myöhemmin —',
		noteLabel: 'Muistiinpano',
		notePlaceholder: 'Sanele tai kirjoita: mistä taimi on, mihin se tuli…',
		photo: 'Kuva',
		provisionalHere: 'Väliaikainen kasvatuspaikka',
		save: 'Tallenna tietue',
		saving: 'Tallennetaan…',
		saved: (code: string) => `Tietue ${code} tallennettu ja merkitty keskeneräiseksi.`,
		another: 'Kirjaa seuraava',
		openRecord: 'Avaa tietue',
		needsFix: 'Sijaintia ei saatu, joten tietuetta ei voi kirjata tässä. Kokeile uudelleen aukealla paikalla.'
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
		showNear: 'Näytä lähimmät',
		quickAdd: 'Pikakirjaus'
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
		originHelp:
			'Merkitse "alkuperäinen" vain puille, jotka kasvoivat tontilla jo ennen sinua. Oletus "istutettu" käy kaikkeen muuhun, eikä kenttää tarvitse koskea.',
		allOrigins: 'Kaikki tyypit',
		status: 'Tila',
		allStatuses: 'Kaikki tilat',
		notes: 'Muistiinpanot',
		position: 'Sijainti',
		radius: 'Säde (m)',
		captureGps: 'Ota sijainti GPS:llä',
		capturing: 'Paikannetaan…',
		published: 'Julkaistu',
		publishedHelp: 'Julkaistut istutukset näkyvät julkisessa raportissa ilman kirjautumista.',
		new: 'Uusi istutus',
		unidentified: 'Määrittämätön',
		incomplete: 'Keskeneräinen',
		incompleteBanner:
			'Tämä tietue on kirjattu maastossa ja jätetty kesken. Täydennä puuttuvat tiedot ja merkitse valmiiksi.',
		markComplete: 'Merkitse valmiiksi',
		drafts: 'Täydennettävät',
		draftsHelp: 'Maastossa aloitetut tietueet, joita ei ole vielä viimeistelty.',
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
	placement: {
		one: 'Sijainti',
		history: 'Sijaintihistoria',
		move: 'Siirrä',
		moveTitle: 'Siirtoistutus',
		moveHelp:
			'Kirjaa siirto vasta kun taimi on uudessa paikassaan. Vanha sijainti jää historiaan, eikä sitä korvata.',
		correctionHelp:
			'Jos sijainti oli vain kirjattu väärin, älä kirjaa siirtoa: korjaa sijainti kartalla tai GPS-painikkeella. Siirto on siirto vain, jos puu on oikeasti liikkunut.',
		when: 'Siirron päivämäärä',
		to: 'Uusi sijainti',
		toGarden: 'Uusi puutarha',
		useMyPosition: 'Käytä nykyistä sijaintiani',
		note: 'Muistiinpano',
		notePlaceholder: 'esim. purkista lopulliselle paikalle',
		provisional: 'Väliaikainen paikka',
		provisionalHelp:
			'Purkki, kasvimaan taimirivi tai muu väliaikainen kasvatuspaikka. Taimi näkyy listalla, joka odottaa lopullista paikkaa.',
		saved: 'Siirto kirjattu',
		none: 'Sijaintia ei ole vielä kirjattu.',
		onlyOne: 'Puu on ollut samassa paikassa kirjaamisesta asti.',
		movedBy: (m: number) => `${Math.round(m)} m edellisestä paikasta`,
		awaiting: 'Odottaa lopullista paikkaa',
		awaitingHelp: 'Taimet, joiden viimeisin sijainti on merkitty väliaikaiseksi.',
		awaitingNone: 'Kaikki taimet ovat lopullisilla paikoillaan.',
		reasons: {
			acquired: 'Hankittu',
			planted: 'Istutettu',
			moved: 'Siirretty',
			corrected: 'Sijainti korjattu'
		},
		needsPosition: 'Anna ensin sijainti, niin siirrot voi kirjata.'
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
			survey: 'Mittausaineisto',
			mml: 'MML:n kiinteistörekisteri'
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
	property: {
		title: 'Hae kiinteistörekisteristä',
		help: 'Anna kiinteistötunnus, esimerkiksi 710-547-1-180. Palstan raja haetaan Maanmittauslaitoksen kiinteistörekisterikartasta.',
		code: 'Kiinteistötunnus',
		fetch: 'Hae',
		fetching: 'Haetaan…',
		found: (code: string) => `Kiinteistö ${code} löytyi.`,
		parcels: (n: number) => `${n} ${n === 1 ? 'palsta' : 'palstaa'}`,
		useLargest: 'Kiinteistössä on useita palstoja, joten rajaksi otetaan suurin. Muut näkyvät karttatasona.',
		asBoundary: 'Käytä puutarhan rajana',
		asLayer: 'Tuo karttatasoksi',
		boundarySet: 'Raja haettu kiinteistörekisteristä. Tarkista se kartalta ja tallenna.',
		attribution: '© Maanmittauslaitos, kiinteistörekisterikartta',
		errors: {
			invalidCode: 'Tarkista kiinteistötunnus. Muoto on 710-547-1-180 tai 71054700010180.',
			noKey:
				'MML:n API-avainta ei ole asetettu, joten kiinteistöhaku ei ole käytettävissä. Lisää avain .env-tiedostoon (PUBLIC_MML_API_KEY).',
			notFound: 'Kiinteistötunnuksella ei löytynyt palstoja.',
			failed: 'Yhteys Maanmittauslaitoksen rajapintaan epäonnistui.'
		}
	},
	registry: {
		title: 'Rekisteri',
		importExport: 'Tuonti ja vienti',
		gardenFilter: 'Näytetään puutarhan istutukset'
	},
	importer: {
		title: 'CSV-tuonti',
		help: 'Tuo olemassa oleva istutusluettelo. Ensimmäinen rivi on otsikkorivi.',
		formatHelp:
			'Tuonti lukee CSV-tiedostoa. Jos luettelosi on Excel-työkirjana, valitse Excelissä Tallenna nimellä → "CSV UTF-8 (luetteloerotin)".',
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
		help: 'Vienti noudattaa näkymän rajauksia: mukaan tulee se, mitä ruudulla näkyy.',
		csv: 'Lataa CSV',
		xlsx: 'Lataa XLSX',
		csvHelp:
			'CSV on pelkkä tekstitaulukko. Se avautuu Exceliin, mutta siinä ei ole kaavoja eikä muotoiluja — se on siirtomuoto. Sama muoto luetaan takaisin tuonnissa.',
		xlsxHelp:
			'XLSX on tavallinen Excel-työkirja. Valitse tämä, jos haluat vain katsella tai muokata tietoja Excelissä.',
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
