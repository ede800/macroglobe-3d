import type { FilterKey } from '../types';
import type { SourceLink } from './filterConcepts';

// Long-form documentation of every globe filter, shown on the "Guide des filtres" page.
// Formulas mirror scripts/update_macro_data.py and the scales in metrics.ts: keep them in sync.

export interface FilterDoc {
  /** what the indicator measures, in plain words */
  what: string;
  /** how the value is built (one step per line) */
  how: string[];
  /** how to read the colours and what a high / low value means */
  read: string;
  /** limits worth knowing before drawing conclusions */
  caveats: string[];
  sources: SourceLink[];
}

export const FILTER_DOCS: Record<FilterKey, FilterDoc> = {
  confidence: {
    what: 'Une note synthétique de 0 à 100 sur la santé macroéconomique d’un pays aujourd’hui : la conjoncture, la solidité des comptes et le ton de l’actualité économique. C’est le filtre par défaut du globe.',
    how: [
      '40 % · Dynamique macro. Croissance (55 %) : mélange de la croissance de l’année (60 %) et de la moyenne sur 5 ans (40 %), notée 0 à −2 %, 50 à +2,5 % et 100 à +7 %. Inflation (45 %) : 100 points pile à la cible de 2 %, la note baisse à mesure qu’on s’en éloigne ; la déflation est pénalisée 1,5 fois plus.',
      '30 % · Comptes extérieurs et publics. Dette publique (60 %) : courbe en S qui vaut 50 à 90 % du PIB, se rapproche de 100 pour une dette faible et de 0 au-delà de 150 %. Balance courante (40 %) : 50 + 7 points par point de PIB d’excédent (ou − 7 par point de déficit).',
      '30 % · Sentiment de l’actualité. Les titres économiques du jour sur le pays sont notés par VADER (analyse de sentiment avec un lexique financier) ; la moyenne, de −1 à +1, devient 50 + 100 × moyenne.',
      'La fiche pays décompose le score : chaque facteur pousse la note au-dessus ou en dessous de 50 selon son poids.',
    ],
    read: 'Échelle divergente : rouge sous 40 (« Pessimiste »), gris entre 40 et 60 (« Neutre »), bleu au-dessus de 60 (« Optimiste »). Plus c’est haut, mieux c’est.',
    caveats: [
      'La part « sentiment » bouge chaque jour : un pays peut changer de couleur sans que ses fondamentaux aient bougé.',
      'Quand une donnée manque, elle est remplacée par la médiane de la région ; l’indice de qualité des données de la fiche pays le signale.',
    ],
    sources: [
      { label: 'Banque mondiale · croissance (NY.GDP.MKTP.KD.ZG)', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG' },
      { label: 'Banque mondiale · inflation (FP.CPI.TOTL.ZG)', url: 'https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG' },
      { label: 'Banque mondiale · balance courante (BN.CAB.XOKA.GD.ZS)', url: 'https://data.worldbank.org/indicator/BN.CAB.XOKA.GD.ZS' },
      { label: 'FMI · World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO/weo-database' },
      { label: 'GDELT Project (titres de presse)', url: 'https://www.gdeltproject.org/' },
      { label: 'Google News (flux RSS)', url: 'https://news.google.com/' },
      { label: 'MacroGlobe · code du pipeline', url: 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py' },
    ],
  },
  gdp: {
    what: 'La taille de l’économie : la valeur de tout ce qui est produit en un an, en dollars courants. Le relief ajoute une deuxième information : la vitesse à laquelle elle grandit.',
    how: [
      'Couleur : PIB nominal en USD courants, sur une échelle logarithmique (chaque cran = ×10) allant de 1 Md$ à 30 T$.',
      'Hauteur : croissance réelle de l’année ; chaque point de croissance soulève le pays, jusqu’à +8 %. Une récession laisse le pays à plat.',
    ],
    read: 'Bleu clair = grande économie, bleu sombre = petite. Le relief permet de repérer d’un coup d’œil les petites économies très dynamiques. Pas de « bon » ou « mauvais » sens.',
    caveats: [
      'En dollars courants, le PIB dépend du taux de change : une devise qui chute fait baisser le PIB affiché sans que la production ait changé.',
      'La taille ne dit rien du niveau de vie : voir « Pouvoir d’achat ».',
    ],
    sources: [
      { label: 'Banque mondiale · PIB en USD courants (NY.GDP.MKTP.CD)', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD' },
      { label: 'Banque mondiale · croissance réelle (NY.GDP.MKTP.KD.ZG)', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG' },
      { label: 'FMI · World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO/weo-database' },
    ],
  },
  ppp: {
    what: 'Le niveau de vie moyen : la production par habitant, corrigée des différences de prix entre pays (parité de pouvoir d’achat). 10 000 $ PPA achètent à peu près la même chose partout.',
    how: ['PIB en dollars internationaux courants divisé par la population.', 'Échelle logarithmique de 1 k$ à 125 k$.'],
    read: 'Plus clair = population en moyenne plus aisée. Plus c’est haut, mieux c’est.',
    caveats: [
      'C’est une moyenne : elle masque les inégalités (voir « Gini »).',
      'Les petits pays à forte présence de sièges sociaux (Luxembourg, Irlande, paradis fiscaux) ont un PIB par habitant gonflé par des profits qui ne restent pas dans le pays.',
    ],
    sources: [
      { label: 'Banque mondiale · PIB par habitant en PPA (NY.GDP.PCAP.PP.CD)', url: 'https://data.worldbank.org/indicator/NY.GDP.PCAP.PP.CD' },
    ],
  },
  growth: {
    what: 'La variation du volume de production sur un an, inflation retirée : l’économie s’étend-elle ou se contracte-t-elle ?',
    how: ['Croissance réelle annuelle du PIB, dernière année publiée.', 'Échelle divergente de −6 % à +6 % ; les valeurs au-delà prennent la couleur extrême.'],
    read: 'Rouge = récession, gris = stagnation autour de 0, bleu = expansion. Plus c’est haut, mieux c’est.',
    caveats: [
      'Une seule année : un rebond après une crise (ou un choc pétrolier) peut donner un chiffre spectaculaire mais trompeur. Le score de confiance lisse cet effet avec la moyenne 5 ans.',
    ],
    sources: [
      { label: 'Banque mondiale · croissance réelle (NY.GDP.MKTP.KD.ZG)', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG' },
      { label: 'FMI · World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO/weo-database' },
    ],
  },
  debt: {
    what: 'Ce que doivent l’État et les administrations publiques, rapporté à la richesse produite en un an.',
    how: ['Dette brute des administrations publiques en % du PIB ; le FMI est utilisé en priorité, la Banque mondiale à défaut.', 'Échelle de 0 à 150 % et plus.'],
    read: 'Rouge plus vif = dette plus lourde. Repères : 60 % (critère européen de Maastricht), 90 % (seuil souvent cité au-delà duquel la dette pèse sur la croissance). Plus c’est bas, mieux c’est.',
    caveats: [
      'Dette brute : les actifs de l’État ne sont pas déduits.',
      'Le niveau soutenable dépend de qui détient la dette et dans quelle devise : le Japon supporte plus de 200 % grâce à une dette surtout domestique, en yens.',
    ],
    sources: [
      { label: 'FMI · World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO/weo-database' },
      { label: 'Banque mondiale · dette de l’administration centrale (GC.DOD.TOTL.GD.ZS)', url: 'https://data.worldbank.org/indicator/GC.DOD.TOTL.GD.ZS' },
    ],
  },
  tourism: {
    what: 'Le poids du tourisme international dans ce que le pays vend à l’étranger : une mesure de vulnérabilité aux chocs sur les voyages (pandémie, conflit, crise chez les pays émetteurs).',
    how: [
      'Recettes du tourisme international en % des exportations totales (biens et services).',
      'Échelle « racine carrée » de 0 à 50 % : elle écarte les petites valeurs pour qu’on distingue 2 % de 8 %.',
      'La fiche indique aussi le poids du tourisme en % du PIB.',
    ],
    read: 'Orange vif = économie très dépendante du tourisme. Plus c’est bas, moins le pays est exposé.',
    caveats: ['Données souvent anciennes (jusqu’à 12 ans) pour les petits pays ; manquantes = médiane régionale.'],
    sources: [
      { label: 'Banque mondiale · recettes touristiques, % des exportations (ST.INT.RCPT.XP.ZS)', url: 'https://data.worldbank.org/indicator/ST.INT.RCPT.XP.ZS' },
      { label: 'Banque mondiale · recettes touristiques en USD (ST.INT.RCPT.CD)', url: 'https://data.worldbank.org/indicator/ST.INT.RCPT.CD' },
    ],
  },
  usd: {
    what: 'À quel point l’économie dépend du dollar américain : sa monnaie, ses dettes, ses échanges et l’épargne de ses habitants. Un pays très dépendant subit fortement les hausses de taux de la Fed et les envolées du dollar.',
    how: [
      'Régime de change · 35 pts : dollarisation 100 %, ancrage fixe au USD 92 %, flottement géré vs USD 58 %, panier de devises 35 %, change flottant 12 %, ancrage à l’euro 10 %, zone euro 6 %, États-Unis 0.',
      'Exportations de matières premières cotées en dollars · 20 pts.',
      'Part de la dette extérieure libellée en USD · 20 pts (+15 % si le déficit courant dépasse 2 % du PIB, plafonné).',
      'Part du commerce facturé en USD · 15 pts.',
      'Part des dépôts bancaires en devises · 10 pts.',
    ],
    read: 'Bleu clair = forte dépendance. Plus c’est bas, plus le pays est à l’abri des chocs sur le dollar.',
    caveats: [
      'Seuls 40 pays de référence ont des valeurs documentées une à une. Pour les autres, le régime de change est classé à la main et la dette, la facturation et les dépôts en USD sont estimés selon le régime, la région et le niveau de revenu ; la fiche pays signale ces estimations.',
    ],
    sources: [
      { label: 'Banque mondiale · carburants, % des exportations (TX.VAL.FUEL.ZS.UN)', url: 'https://data.worldbank.org/indicator/TX.VAL.FUEL.ZS.UN' },
      { label: 'Banque mondiale · minerais et métaux, % des exportations (TX.VAL.MMTL.ZS.UN)', url: 'https://data.worldbank.org/indicator/TX.VAL.MMTL.ZS.UN' },
      { label: 'FMI · AREAER (régimes de change)', url: 'https://www.elibrary-areaer.imf.org/' },
      { label: 'MacroGlobe · code du pipeline', url: 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py' },
    ],
  },
  exposure: {
    what: 'Un résumé de toutes les dépendances extérieures : à quel point le pays dépend du reste du monde pour vendre, s’approvisionner et se financer.',
    how: [
      'Dix dépendances sont ramenées sur 0-100, chacune plafonnée à un niveau « très élevé » : Chine et États-Unis (40 % des échanges = 100), énergie (% importé), alimentation (30 % des importations = 100), diaspora (20 % du PIB = 100), aide (15 % du RNB = 100), matières premières (part des exportations), tourisme (50 % des exportations = 100), dollar (score USD), dette extérieure (120 % du RNB = 100).',
      'L’indice est la moyenne des axes disponibles ; il faut au moins 5 axes renseignés, sinon le pays reste sans donnée.',
      'Le radar de la fiche pays montre les dix axes séparément.',
    ],
    read: 'Magenta vif = pays très exposé à des chocs externes. Plus c’est bas, plus le pays est autonome.',
    caveats: ['Moyenne simple : une dépendance extrême (ex. 90 % d’énergie importée) peut être diluée par neuf axes faibles. Regarder le radar.'],
    sources: [
      { label: 'FMI · Direction of Trade Statistics (via DBnomics)', url: 'https://db.nomics.world/IMF/DOT' },
      { label: 'Banque mondiale · World Development Indicators', url: 'https://databank.worldbank.org/source/world-development-indicators' },
      { label: 'MacroGlobe · code du pipeline', url: 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py' },
    ],
  },
  china: {
    what: 'La part de la Chine dans le commerce de marchandises du pays : un indicateur d’exposition économique (et potentiellement politique) à Pékin.',
    how: [
      '(exportations vers la Chine + importations depuis la Chine) ÷ (exportations + importations totales), dernière année commune disponible (4 ans maximum).',
      'La fiche détaille séparément la part dans les exportations et dans les importations.',
      'Échelle de 0 à 40 % et plus.',
    ],
    read: 'Rouge vif = la Chine pèse lourd dans les échanges. Plus c’est bas, plus le commerce est diversifié vis-à-vis de la Chine.',
    caveats: ['Biens uniquement : les services (tourisme, finance) ne sont pas comptés.', 'Les marchandises qui transitent par Hong Kong ou Singapour peuvent être attribuées à ces plateformes.'],
    sources: [
      { label: 'FMI · Direction of Trade Statistics (via DBnomics)', url: 'https://db.nomics.world/IMF/DOT' },
    ],
  },
  us_trade: {
    what: 'La part des États-Unis dans le commerce de marchandises du pays.',
    how: ['Même calcul que pour la Chine : (exportations + importations avec les États-Unis) ÷ commerce total de biens.', 'Échelle de 0 à 40 % et plus.'],
    read: 'Bleu clair = les États-Unis sont un partenaire dominant (Mexique, Canada…). Plus c’est bas, moins le pays est exposé à la politique commerciale américaine.',
    caveats: ['Biens uniquement, services exclus.'],
    sources: [
      { label: 'FMI · Direction of Trade Statistics (via DBnomics)', url: 'https://db.nomics.world/IMF/DOT' },
    ],
  },
  eu_trade: {
    what: 'La part de l’Union européenne dans le commerce de marchandises du pays.',
    how: ['(exportations + importations avec l’UE) ÷ commerce total de biens.', 'Échelle plus large que pour la Chine et les États-Unis : de 0 à 70 % et plus.'],
    read: 'Violet clair = l’UE est le débouché principal. Plus c’est bas, moins le pays dépend du marché européen.',
    caveats: ['Pour les pays membres, le commerce avec les autres membres est inclus : leurs valeurs sont naturellement très élevées et traduisent l’intégration du marché unique plus qu’une dépendance.'],
    sources: [
      { label: 'FMI · Direction of Trade Statistics (via DBnomics)', url: 'https://db.nomics.world/IMF/DOT' },
    ],
  },
  energy: {
    what: 'La part de l’énergie consommée que le pays doit acheter à l’étranger.',
    how: [
      'Importations nettes d’énergie en % de la consommation. Une valeur négative signifie que le pays produit plus qu’il ne consomme : il est affiché « exportateur net » (0).',
      'À défaut de bilan énergétique, part des carburants dans les importations de biens (30 % = 100).',
    ],
    read: 'Ambre vif = pays qui importe presque toute son énergie (Japon, Corée, nombreuses îles). Plus c’est bas, mieux le pays résiste à une flambée des prix de l’énergie.',
    caveats: ['Données publiées avec plusieurs années de retard (5 ans maximum ici).'],
    sources: [
      { label: 'Banque mondiale · importations nettes d’énergie (EG.IMP.CONS.ZS)', url: 'https://data.worldbank.org/indicator/EG.IMP.CONS.ZS' },
      { label: 'Banque mondiale · carburants, % des importations (TM.VAL.FUEL.ZS.UN)', url: 'https://data.worldbank.org/indicator/TM.VAL.FUEL.ZS.UN' },
    ],
  },
  food: {
    what: 'La place de la nourriture dans les achats du pays à l’étranger : un indicateur de vulnérabilité aux hausses des prix agricoles mondiaux.',
    how: ['Produits alimentaires en % des importations de marchandises.', 'Échelle de 0 à 30 % et plus.'],
    read: 'Vert vif = une grande partie des importations sert à nourrir la population. Plus c’est bas, mieux c’est.',
    caveats: ['C’est une part des importations, pas de la consommation alimentaire : un pays qui importe peu en tout peut afficher une part élevée.'],
    sources: [
      { label: 'Banque mondiale · alimentation, % des importations (TM.VAL.FOOD.ZS.UN)', url: 'https://data.worldbank.org/indicator/TM.VAL.FOOD.ZS.UN' },
    ],
  },
  remittances: {
    what: 'L’argent envoyé au pays par ses travailleurs émigrés : une ressource vitale pour certaines économies, mais qui dépend de la conjoncture des pays d’accueil.',
    how: ['Envois de fonds personnels reçus, en % du PIB.', 'Échelle « racine carrée » de 0 à 30 % pour distinguer les petites valeurs.'],
    read: 'Violet vif = économie portée par sa diaspora (Tonga, Tadjikistan, Liban…). Plus c’est bas, moins le pays dépend de l’extérieur.',
    caveats: ['Seuls les flux officiels sont comptés : les transferts informels (cash, hawala) sont souvent importants.'],
    sources: [
      { label: 'Banque mondiale · envois de fonds, % du PIB (BX.TRF.PWKR.DT.GD.ZS)', url: 'https://data.worldbank.org/indicator/BX.TRF.PWKR.DT.GD.ZS' },
    ],
  },
  aid: {
    what: 'L’aide publique au développement reçue (dons et prêts à conditions avantageuses), rapportée au revenu national.',
    how: [
      'Aide nette reçue en % du revenu national brut.',
      'Les pays à revenu élevé ne sont pas éligibles : en l’absence de série, leur valeur est 0.',
      'Échelle « racine carrée » de 0 à 20 %.',
    ],
    read: 'Vert vif = budget et économie fortement soutenus par les bailleurs. Plus c’est bas, plus le pays est autonome.',
    caveats: ['Les montants varient fortement d’une année à l’autre (crises humanitaires, conflits).'],
    sources: [
      { label: 'Banque mondiale · APD nette reçue, % du RNB (DT.ODA.ODAT.GN.ZS)', url: 'https://data.worldbank.org/indicator/DT.ODA.ODAT.GN.ZS' },
    ],
  },
  external_debt: {
    what: 'Tout ce que le pays (État, banques, entreprises) doit à des créanciers étrangers, rapporté au revenu national.',
    how: [
      'Encours de dette extérieure publique et privée en % du RNB.',
      'La fiche ajoute le service de la dette (intérêts + remboursements) en % des exportations : la part des recettes en devises absorbée chaque année par les créanciers.',
      'Échelle de 0 à 150 % et plus.',
    ],
    read: 'Rouge vif = endettement extérieur lourd. Plus c’est bas, mieux c’est.',
    caveats: ['Publié uniquement pour les pays à revenu faible et intermédiaire : les pays riches apparaissent sans donnée.'],
    sources: [
      { label: 'Banque mondiale · dette extérieure, % du RNB (DT.DOD.DECT.GN.ZS)', url: 'https://data.worldbank.org/indicator/DT.DOD.DECT.GN.ZS' },
      { label: 'Banque mondiale · service de la dette, % des exportations (DT.TDS.DECT.EX.ZS)', url: 'https://data.worldbank.org/indicator/DT.TDS.DECT.EX.ZS' },
    ],
  },
  reserves: {
    what: 'Le matelas de devises de la banque centrale, exprimé en nombre de mois d’importations qu’il permettrait de payer si toutes les autres entrées de devises s’arrêtaient.',
    how: ['Réserves totales (or compris) en mois d’importations de biens et services.', 'Échelle de 0 à 12 mois et plus.'],
    read: 'Bleu clair = coussin confortable. Sous 3 mois, c’est le seuil d’alerte usuel du FMI. Plus c’est haut, mieux c’est.',
    caveats: ['Les pays de la zone euro et les émetteurs de devises de réserve ont besoin de moins de réserves : une valeur basse n’y signale pas de fragilité.'],
    sources: [
      { label: 'Banque mondiale · réserves en mois d’importations (FI.RES.TOTL.MO)', url: 'https://data.worldbank.org/indicator/FI.RES.TOTL.MO' },
    ],
  },
  population: {
    what: 'Le nombre d’habitants.',
    how: ['Population totale (Banque mondiale, à défaut ONU).', 'Échelle logarithmique de 100 000 à 1,5 milliard.', 'La fiche indique aussi le rythme de croissance annuel de la population.'],
    read: 'Violet clair = pays très peuplé. Pas de « bon » ou « mauvais » sens.',
    caveats: [],
    sources: [
      { label: 'Banque mondiale · population totale (SP.POP.TOTL)', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL' },
      { label: 'Our World in Data · population (ONU)', url: 'https://ourworldindata.org/grapher/population-with-un-projections' },
    ],
  },
  fertility: {
    what: 'Le nombre moyen d’enfants qu’aurait une femme au cours de sa vie avec les taux de fécondité actuels. C’est le moteur principal de la démographie de long terme.',
    how: ['Indice synthétique de fécondité, dernière année publiée.', 'Les pays sont classés en quatre bandes autour du seuil de renouvellement des générations (2,1 enfants par femme).'],
    read: 'Rouge = « hiver démographique » (moins de 1,5) ; jaune = sous le renouvellement (1,5 à 2,1) ; vert = zone d’équilibre (2,1 à 2,5) ; bleu = boom démographique (plus de 2,5). Pas de bon sens absolu : une fécondité très basse annonce un vieillissement rapide, une fécondité très haute une forte pression sur l’emploi et les services publics.',
    caveats: ['Un indice sous 2,1 ne fait pas baisser la population tout de suite : l’immigration et l’inertie de la pyramide des âges jouent pendant des décennies.'],
    sources: [
      { label: 'Banque mondiale · indice de fécondité (SP.DYN.TFRT.IN)', url: 'https://data.worldbank.org/indicator/SP.DYN.TFRT.IN' },
    ],
  },
  median_age: {
    what: 'L’âge qui coupe la population en deux moitiés égales : la moitié des habitants est plus jeune, l’autre plus âgée.',
    how: ['Estimation de l’ONU (World Population Prospects).', 'Échelle de 15 à 50 ans.'],
    read: 'Magenta clair = population âgée (Japon, Europe), sombre = population très jeune (Afrique subsaharienne). Pas de « bon » sens : vieillissement d’un côté, défi de l’emploi des jeunes de l’autre.',
    caveats: [],
    sources: [
      { label: 'Our World in Data · âge médian (ONU)', url: 'https://ourworldindata.org/grapher/median-age' },
    ],
  },
  life_expectancy: {
    what: 'Le nombre moyen d’années que vivrait un nouveau-né si les conditions de mortalité actuelles restaient les mêmes.',
    how: ['Espérance de vie à la naissance, en années.', 'Échelle de 50 à 85 ans.'],
    read: 'Vert clair = longévité élevée. Plus c’est haut, mieux c’est.',
    caveats: ['Très sensible à la mortalité infantile : une espérance de vie basse ne veut pas dire que les adultes meurent jeunes.'],
    sources: [
      { label: 'Banque mondiale · espérance de vie (SP.DYN.LE00.IN)', url: 'https://data.worldbank.org/indicator/SP.DYN.LE00.IN' },
    ],
  },
  hdi: {
    what: 'L’indice de développement humain du PNUD : une mesure du développement qui va au-delà de l’argent.',
    how: ['Moyenne (géométrique) de trois dimensions : santé (espérance de vie), éducation (durée de scolarisation) et niveau de vie (revenu national par habitant).', 'De 0 à 1 ; l’échelle de couleur va de 0,35 à 0,97.'],
    read: 'Bleu clair = développement très élevé (au-dessus de 0,8). Plus c’est haut, mieux c’est.',
    caveats: ['Publié avec environ deux ans de retard.'],
    sources: [
      { label: 'Our World in Data · IDH (PNUD)', url: 'https://ourworldindata.org/grapher/human-development-index' },
      { label: 'PNUD · Human Development Reports', url: 'https://hdr.undp.org/data-center/human-development-index' },
    ],
  },
  gini: {
    what: 'Les inégalités de revenus (ou de consommation) entre les habitants.',
    how: ['Indice de Gini de la dernière enquête disponible (jusqu’à 15 ans d’ancienneté).', '0 = tout le monde a le même revenu, 100 = une seule personne a tout. L’échelle de couleur va de 24 à 60.'],
    read: 'Ambre vif = société très inégalitaire (Afrique australe, Amérique latine). Plus c’est bas, plus la répartition est égalitaire.',
    caveats: [
      'Certains pays mesurent le revenu, d’autres la consommation (qui donne des indices plus bas) : les comparaisons entre régions sont approximatives.',
      'Les enquêtes sont rares dans certains pays : la valeur peut être ancienne.',
    ],
    sources: [
      { label: 'Banque mondiale · indice de Gini (SI.POV.GINI)', url: 'https://data.worldbank.org/indicator/SI.POV.GINI' },
    ],
  },
  corruption: {
    what: 'Le niveau de corruption du secteur public tel que perçu par des experts et des chefs d’entreprise.',
    how: ['Indice de perception de la corruption (IPC) de Transparency International, agrégeant 13 enquêtes et évaluations.', '0 = très corrompu, 100 = très intègre. Échelle divergente de 10 à 90.'],
    read: 'Rouge = corruption perçue élevée, bleu = institutions perçues comme intègres. Plus c’est haut, mieux c’est.',
    caveats: ['C’est une perception, pas une mesure directe de la corruption ; elle couvre peu la corruption privée ou transnationale.'],
    sources: [
      { label: 'Our World in Data · IPC (Transparency International)', url: 'https://ourworldindata.org/grapher/ti-corruption-perception-index' },
      { label: 'Transparency International · CPI', url: 'https://www.transparency.org/en/cpi' },
    ],
  },
  unemployment: {
    what: 'La part de la population active qui cherche un emploi sans en trouver.',
    how: ['Taux de chômage selon la définition de l’OIT, estimation modélisée pour rendre les pays comparables.', 'Échelle de 0 à 25 % et plus.'],
    read: 'Rouge vif = chômage élevé. Plus c’est bas, mieux c’est.',
    caveats: ['Dans les pays pauvres, peu de gens peuvent se permettre d’être sans activité : le chômage y paraît bas alors que le sous-emploi et l’emploi informel sont massifs.'],
    sources: [
      { label: 'Banque mondiale · chômage, estimation modélisée OIT (SL.UEM.TOTL.ZS)', url: 'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS' },
    ],
  },
  politics: {
    what: 'L’orientation politique du pouvoir exécutif en place : de quel côté se situe le parti du dirigeant qui gouverne réellement.',
    how: [
      'Le dirigeant retenu est le chef de l’État dans les régimes présidentiels, le chef du gouvernement ailleurs.',
      'Son parti reçoit une position de −100 (extrême gauche) à +100 (extrême droite) d’après son « alignement politique » dans Wikidata, ou à défaut d’après ses idéologies déclarées (communisme, social-démocratie, libéralisme, conservatisme, nationalisme…).',
      'Classement : ≤ −70 Extrême-gauche / Communiste ; −70 à −20 Gauche ; −20 à +20 Centre ; +20 à +70 Droite ; ≥ +70 Droite nationaliste / Extrême-droite.',
      'Les États communistes à parti unique (Chine, Vietnam, Laos, Cuba, Corée du Nord) sont classés à l’extrême gauche ; les monarchies absolues, théocraties et juntes militaires sont classées « Monarchie / Théocratie / Autre ».',
    ],
    read: 'Couleurs par camp (rouge → jaune → bleu → violet foncé), violet clair pour les régimes non partisans. Un pays sans parti identifiable reste gris. Aucune valeur n’est « meilleure » qu’une autre.',
    caveats: [
      'Classification automatique à partir de Wikidata, base collaborative : elle peut être en retard après une élection, et le positionnement d’un parti est forcément simplificateur (un même mot ne recouvre pas la même chose dans tous les pays).',
      'Ne mesure ni le caractère démocratique du régime ni la composition des coalitions.',
    ],
    sources: [
      { label: 'Wikidata · dirigeants, partis et positionnements', url: 'https://www.wikidata.org/' },
      { label: 'MacroGlobe · code du pipeline', url: 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py' },
    ],
  },
  traj10: {
    what: 'Où irait le score de stabilité dans 10 ans si rien ne changeait : ni réforme, ni crise, ni rupture. C’est une extrapolation mécanique, pas une prévision.',
    how: [
      'Croissance : elle converge progressivement (demi-vie ~12 ans) de sa moyenne récente vers une tendance de long terme fondée sur la démographie projetée par l’ONU (population active).',
      'Freins ajoutés : dette publique au-delà de 90 % du PIB, fécondité sous le renouvellement (surtout sous 1,5), part des plus de 65 ans au-delà de 15 %. Un score de confiance élevé donne un petit bonus qui s’estompe.',
      'La dette évolue avec un taux d’intérêt réel de 1,5 % face à la croissance ; l’inflation revient vers 2 %, la balance courante vers l’équilibre, le sentiment vers la neutralité.',
      'Le score de stabilité est recalculé chaque année avec les mêmes formules que le score de confiance ; le filtre affiche l’écart entre l’an +10 et aujourd’hui.',
    ],
    read: 'Rouge = dégradation attendue, gris = stable, bleu = amélioration (échelle de −20 à +20 points). Plus c’est haut, mieux c’est. La fiche pays montre aussi la croissance annuelle moyenne (TCAM) du PIB.',
    caveats: [
      'Le retour du sentiment à la neutralité fait mécaniquement converger les pays vers le centre : une partie de la variation vient simplement de là.',
      'Aucun choc (guerre, découverte de ressources, réforme) n’est modélisé.',
    ],
    sources: [
      { label: 'MacroGlobe · code du pipeline', url: 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py' },
      { label: 'ONU · World Population Prospects', url: 'https://population.un.org/wpp/' },
      { label: 'FMI · World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO/weo-database' },
    ],
  },
  traj25: {
    what: 'La même extrapolation « Continuité actuelle » que la trajectoire à 10 ans, poussée à 25 ans : c’est là que la démographie et la dette pèsent le plus.',
    how: [
      'Même modèle que pour 10 ans ; le filtre affiche l’écart entre le score de stabilité dans 25 ans et aujourd’hui.',
      'À cet horizon, les effets lents dominent : le frein de la fécondité est à plein régime, le vieillissement aussi, et la dette a eu le temps de faire boule de neige ou de fondre.',
    ],
    read: 'Rouge = dégradation, gris = stable, bleu = amélioration (−20 à +20 points). Plus c’est haut, mieux c’est.',
    caveats: ['L’incertitude grandit avec l’horizon : à lire comme un ordre de grandeur des tendances à l’œuvre, pas comme un chiffre précis.'],
    sources: [
      { label: 'MacroGlobe · code du pipeline', url: 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py' },
      { label: 'ONU · World Population Prospects', url: 'https://population.un.org/wpp/' },
      { label: 'FMI · World Economic Outlook', url: 'https://www.imf.org/en/Publications/WEO/weo-database' },
    ],
  },
};
