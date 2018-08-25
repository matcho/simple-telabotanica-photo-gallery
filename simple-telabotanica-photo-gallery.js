// globals
var strings = {}; // pour les chaînes traduites, voir "lang-*.js"
var langue; // langue en cours
var parametresURL = {};
var parametresAttendus = [
	'lang',
	'dept',
	'groupe_zones_geo',
	'logo',
	'nbjours',
	'num_taxon',
	'projet',
	'referentiel',
	'titre',
	'url_site',
	'utilisateur'
];
var paramsService;
var requeteEnCours;


$(document).ready(function() {

	// 1. parse URL params
	lireParametresURL();
	//console.log(parametresURL);
	paramsService = parametresURL;

	// 1.2 langue
	langue = config.langueDefaut;
	if ('lang' in parametresURL && parametresURL['lang'] in strings) {
		langue = parametresURL['lang'];
	}
	// injection des traductions dans le HTML
	$('title').html(s('Galerie_photo_Tela_Botanica'));
	$("#legende-chargement").html(s('Chargement_en_cours'));
	$("#lien-logo").attr('title', s('Aller_a_l_accueil_de_Tela_Botanica'));
	$("#lien-infos-cdu").attr('title', s('Voir_informations_et_conditions'));

	// 1.2.5.645 options de la galerie d'images
	$.fancybox.defaults.transitionEffect = 'slide';
	$.fancybox.defaults.lang = langue;
	$.fancybox.defaults.i18n.fr = {
		CLOSE: "Fermer",
		NEXT: "Suivant",
		PREV: "Précédent",
		ERROR: "Impossible de charger le contenu. <br/> Réessayez ultérieurement.",
		PLAY_START: "Démarrer le diaporama",
		PLAY_STOP: "Mettre en pause le diaporama",
		FULL_SCREEN: "Plein écran",
		THUMBS: "Miniatures",
		DOWNLOAD: "Télécharger",
		SHARE: "Partager",
		ZOOM: "Zoom"
    };
	$.fancybox.defaults.caption = function(instance, item) {
		var captionId = $(this).data('caption-id');
		var caption = $('#' + captionId);
		return caption;
	};

	// 1.3 titre des filtres
	var filtres = { // @TODO trouver le meilleur ordre
		'dept': s('departement') + ' %s',
		'groupe_zones_geo': s('groupe_zones_geo') + ' "%s"',
		'referentiel': s('referentiel') + ' %s',
		'num_taxon': s('taxon') + ' n°%s',
		'projet': s('projet') + ' "%s"',
		'utilisateur': s('utilisateur') + ' %s',
		'nbjours': s('depuis_%s_jours')
	};

	// 1.5 titre et logo personnalisés
	if ('titre' in parametresURL) {
		$('#zone-titre').html(parametresURL.titre);
		$('#zone-titre').show();
	}
	if ('logo' in parametresURL) {
		$('#image-logo').prop('src', parametresURL.logo);
		// URL perso ?
		var nouvelleURL = '#'; // par défaut, désactiver le lien vers Tela Botanica
		if ('url_site' in parametresURL) {
			nouvelleURL = parametresURL.url_site;
		}
		$('#logo > a').prop('href', nouvelleURL);
	}

	// 1.6 affichage infos filtres
	var infosFiltres = [];
	for (var filtre in parametresURL) {
		if (Object.keys(filtres).indexOf(filtre) !== -1) {
			infosFiltres.push(
				filtres[filtre].replace('%s', parametresURL[filtre]) // le sprintf du clodo
			);
		}
	}
	infosFiltres = infosFiltres.join(', ');
	infosFiltres = infosFiltres.charAt(0).toUpperCase() + infosFiltres.slice(1);
	if (infosFiltres !== '') {
		$('#zone-filtres').html(infosFiltres);
		$('#zone-filtres-wrapper').show();
	}
});

function lireParametresURL(sParam) {
	var queryString = decodeURIComponent(window.location.search.substring(1)),
		morceaux = queryString.split('&'),
		paireParam,
		i;

	for (i=0; i < morceaux.length; i++) {
		paireParam = morceaux[i].split('=');
		var nomParam = paireParam[0];
		if (parametresAttendus.indexOf(nomParam) >= 0) {
			parametresURL[nomParam] = paireParam[1];
		}
	}
}

function loadData() {
	// config
	var URLImages = config.serviceImagesURL;
	var paramsImages = JSON.parse(JSON.stringify(paramsService)); // clone


	// curseur d'attente
	$('#zone-chargement-point').show();

	// appel service
	requeteEnCours = $.ajax({
		url: URLImages,
		type: 'GET',
		data: paramsImages,
		timeout: 60000, // important bicoz service kipu
		error: (data) => {
			$('#zone-chargement-point').hide();
			premierChargement = false;
		},
		success: (data) => {
			console.log(data);

			// infos
			$('#zone-infos').show();
			$('#nombre-observations').html(data.stats.observations + ' ' + s('observations'));
			$('#info-observations').show();
			$('#nombre-stations').html(data.stats.stations + ' ' + s('stations'));
			$('#info-stations').show();

			// images
			data.points.forEach((p) => {
				// single station or cluster
				var cluster = (p.id.substring(0, 6) === 'GROUPE');
				var marker;
				if (cluster) {
					//marker = L.marker([p.lat, p.lng], { icon: new L.NumberedDivIcon({ number: p.nbreMarqueur }) }).addTo(couchePoints);
					marker = L.marker([p.lat, p.lng], { icon: iconeCluster(p.nbreMarqueur) }).addTo(couchePoints);
					// cliquer sur un cluster fait zoomer dessus (+2)
					$(marker).click((e) => {
						carte.setView([p.lat, p.lng], Math.min(MAXZOOM, zoom + 2));
					});
				} else {
					marker = L.marker([p.lat, p.lng]).addTo(couchePoints);
					// cliquer sur un marqueur affiche les infos de la station
					marker.bindPopup(
						titreChargementPopup, /* @TODO remplacer par une fine barre de chargement animée */
						{ autoPan: true, maxWidth: 450, maxHeight: 450 }
					);
					$(marker).click((e) => {
						inhiber = true;
						chargerPopupStation(e, p);
					});
				}
			});

			// hide waiting cursor
			$('#zone-chargement-point').hide();

			premierChargement = false;
		}
	});
}

// retourne une chaîne traduite
function s(code) {
	if (code in strings[langue]) {
		return strings[langue][code];
	} else if (code in strings[config.langueDefaut]) {
		return strings[langue][config.langueDefaut];
	} else {
		return 'hoho c\'est la merde'; // dédicace à Aurélien :)
	}
}
