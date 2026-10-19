import type { FilterKey } from '../types';

// "Comprendre l'indicateur": the economics behind each filter, for readers new to the subject.
// Shown on the "Guide des filtres" page next to the project-specific method (filterGuide.ts).
// Every figure or dated fact carries a marker [n] pointing to refs[n - 1]; figures checked in October 2026.

export interface SourceLink {
  label: string;
  url: string;
}

export interface FilterConcept {
  paragraphs: string[];
  refs: SourceLink[];
}

const WB = (code: string, label: string): SourceLink => ({ label: `Banque mondiale, ${label} (${code})`, url: `https://data.worldbank.org/indicator/${code}` });
const OWID = (slug: string, label: string): SourceLink => ({ label: `Our World in Data, ${label}`, url: `https://ourworldindata.org/grapher/${slug}` });

const UN_WPP: SourceLink = { label: 'ONU, World Population Prospects 2024', url: 'https://population.un.org/wpp/' };
const MACROGLOBE_DATA: SourceLink = { label: 'Données affichées dans MacroGlobe (classement du filtre)', url: 'https://github.com/ede800/macroglobe-3d/blob/main/public/data/macro_data.json' };

export const FILTER_CONCEPTS: Record<FilterKey, FilterConcept> = {
  confidence: {
    paragraphs: [
      'Il n’existe pas de mesure officielle de la « santé » d’une économie : les économistes regardent un tableau de bord d’indicateurs. Ce score résume les plus classiques en un seul chiffre, avec une formule simple et publique.',
      'La croissance indique si l’économie produit davantage ; l’inflation, si les prix restent stables (la Banque centrale européenne et la Réserve fédérale américaine visent toutes deux 2 % par an [1][2] : assez pour éviter la déflation, assez peu pour ne pas ronger le pouvoir d’achat). La dette publique mesure la marge de manœuvre de l’État ; la balance courante dit si le pays vit au-dessus ou en dessous de ses moyens vis-à-vis du reste du monde.',
      'Le sentiment de l’actualité ajoute une dimension « humeur » : VADER est un outil d’analyse de texte publié en 2014 par Hutto et Gilbert, qui note chaque texte de −1 (très négatif) à +1 (très positif) selon les mots employés [3]. Une avalanche de titres sur une crise de change fait baisser le score avant même que les statistiques officielles ne bougent.',
    ],
    refs: [
      { label: 'BCE, stratégie de politique monétaire (cible de 2 %)', url: 'https://www.ecb.europa.eu/mopo/strategy/html/index.fr.html' },
      { label: 'Réserve fédérale, Statement on Longer-Run Goals (2 %)', url: 'https://www.federalreserve.gov/faqs/economy_14400.htm' },
      { label: 'Hutto & Gilbert (2014), VADER, ICWSM', url: 'https://ojs.aaai.org/index.php/ICWSM/article/view/14550' },
    ],
  },
  gdp: {
    paragraphs: [
      'Le produit intérieur brut (PIB) est la valeur de tout ce qui est produit sur le territoire en un an : les biens et services créés par les entreprises, les administrations et les ménages, moins ce qui a été consommé pour les produire [1]. On peut aussi le voir comme la somme des revenus distribués, ou comme la somme des dépenses finales (consommation, investissement, exportations moins importations).',
      'Le PIB « nominal » est mesuré aux prix et aux taux de change du moment, en dollars courants. C’est la bonne mesure du poids d’un pays dans l’économie mondiale, c’est-à-dire de ce qu’il peut acheter sur les marchés internationaux. Les États-Unis (environ 26 %) et la Chine (environ 17 %) représentent à eux deux plus de 40 % du PIB mondial [2].',
      'Le PIB ne mesure ni le bien-être, ni les inégalités, ni l’épuisement des ressources naturelles, ni le travail domestique non rémunéré [3]. C’est une mesure d’activité, pas de bonheur.',
    ],
    refs: [
      { label: 'Insee, définition du produit intérieur brut', url: 'https://www.insee.fr/fr/metadonnees/definition/c1365' },
      { label: 'FMI, World Economic Outlook Database (PIB en USD courants)', url: 'https://www.imf.org/en/Publications/WEO/weo-database' },
      { label: 'Insee, Deux ans après le rapport Stiglitz-Sen-Fitoussi (2009)', url: 'https://www.insee.fr/fr/information/2550927' },
    ],
  },
  ppp: {
    paragraphs: [
      'Avec 1 000 dollars convertis en roupies, on achète beaucoup plus en Inde qu’aux États-Unis : les services (coiffeur, loyer, restaurant) y sont bien moins chers. Comparer les PIB par habitant aux taux de change du marché sous-estime donc fortement le niveau de vie des pays pauvres.',
      'La parité de pouvoir d’achat (PPA) corrige cet effet. Le Programme de comparaison internationale (PCI) de la Banque mondiale relève les prix d’un même panier de biens et services dans presque tous les pays et en déduit un « taux de change PPA » [1]. Le « Big Mac Index » du magazine The Economist en est une version simplifiée, avec un seul produit [2].',
      'Le résultat s’exprime en « dollars internationaux » : un dollar international achète dans chaque pays ce qu’un dollar achète aux États-Unis [1]. C’est la mesure de référence pour comparer les niveaux de vie matériels moyens.',
    ],
    refs: [
      { label: 'Banque mondiale, International Comparison Program', url: 'https://www.worldbank.org/en/programs/icp' },
      { label: 'The Economist, The Big Mac Index', url: 'https://www.economist.com/big-mac-index' },
    ],
  },
  growth: {
    paragraphs: [
      'La croissance « réelle » est la variation du PIB une fois l’effet des prix retiré : si le PIB nominal augmente de 10 % alors que les prix ont augmenté de 7 %, la croissance réelle est d’environ 3 %. C’est la variation des quantités produites [1].',
      'Une récession est une baisse du PIB réel, souvent repérée par deux trimestres de baisse consécutifs [2]. Les pays émergents croissent en général plus vite que les pays riches : ils rattrapent leur retard en adoptant des technologies existantes et en équipant leur population. C’est ce qu’on appelle la « convergence ».',
      'Une croissance de 2 % par an double le PIB en 35 ans environ, une croissance de 7 % en 10 ans (règle de calcul : 70 ÷ taux de croissance) : de petites différences annuelles créent d’énormes écarts en une génération.',
    ],
    refs: [
      WB('NY.GDP.MKTP.KD.ZG', 'croissance du PIB, définition'),
      { label: 'Insee, définition de la récession', url: 'https://www.insee.fr/fr/metadonnees/definition/c2129' },
    ],
  },
  debt: {
    paragraphs: [
      'La dette publique est le total des emprunts de l’État, des collectivités locales et de la sécurité sociale qui n’ont pas encore été remboursés. On la rapporte au PIB parce que le PIB est la base sur laquelle l’État prélève ses impôts : une dette de 100 % du PIB équivaut à un an de production nationale.',
      'Le repère de 60 % vient du traité de Maastricht (1992), qui fixe aussi un déficit maximal de 3 % du PIB pour les pays de l’Union européenne [1]. Celui de 90 % vient d’une étude célèbre de Reinhart et Rogoff (2010) [2] ; en 2013, Herndon, Ash et Pollin y ont trouvé une erreur de tableur et des choix de pondération contestables [3], si bien que l’existence d’un seuil net est aujourd’hui débattue. Le chiffre reste néanmoins une référence.',
      'Ce qui compte vraiment, c’est la dynamique : si le taux d’intérêt payé est inférieur à la croissance, le ratio peut baisser même avec un léger déficit ; dans le cas inverse, la dette fait « boule de neige » [4]. Une dette en monnaie nationale, détenue par les épargnants du pays, est aussi beaucoup moins risquée qu’une dette en dollars détenue par des étrangers.',
    ],
    refs: [
      { label: 'Commission européenne, Pacte de stabilité et de croissance (60 % / 3 %)', url: 'https://economy-finance.ec.europa.eu/economic-and-fiscal-governance/stability-and-growth-pact_en' },
      { label: 'Reinhart & Rogoff (2010), Growth in a Time of Debt, NBER w15639', url: 'https://www.nber.org/papers/w15639' },
      { label: 'Herndon, Ash & Pollin (2013), PERI Working Paper 322', url: 'https://peri.umass.edu/publication/does-high-public-debt-consistently-stifle-economic-growth-a-critique-of-reinhart-and-rogoff/' },
      { label: 'Blanchard (2019), Public Debt and Low Interest Rates, American Economic Review', url: 'https://www.aeaweb.org/articles?id=10.1257/aer.109.4.1197' },
    ],
  },
  tourism: {
    paragraphs: [
      'Quand un touriste étranger dépense de l’argent dans un pays (hôtel, restaurant, transport, souvenirs), c’est comptablement une exportation de services : le pays « vend » quelque chose à un non-résident et reçoit des devises [1].',
      'Pour les petites îles (Maldives, Caraïbes, Pacifique), le tourisme peut représenter l’essentiel des recettes extérieures. C’est une source de devises précieuse mais fragile : en 2020, la pandémie a fait chuter les arrivées internationales de 74 % dans le monde [2], et le PIB des Maldives a reculé d’environ un tiers [3].',
    ],
    refs: [
      WB('ST.INT.RCPT.XP.ZS', 'recettes du tourisme international, définition'),
      { label: 'ONU Tourisme (OMT), 2020 : pire année de l’histoire du tourisme', url: 'https://www.unwto.org/news/2020-worst-year-in-tourism-history-with-1-billion-fewer-international-arrivals' },
      { label: 'Banque mondiale, croissance du PIB des Maldives', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG?locations=MV' },
    ],
  },
  usd: {
    paragraphs: [
      'Le dollar américain est la monnaie centrale du système international : il représente environ 57 % des réserves de change des banques centrales (fin 2025) [1], il reste de loin la première monnaie de facturation du commerce mondial, bien au-delà du poids des États-Unis dans les échanges [2], et le pétrole, les métaux ou les céréales sont cotés en dollars.',
      'Un pays dépend du dollar de plusieurs façons. Par son régime de change : certains pays utilisent directement le dollar (Équateur, Panama, Salvador : c’est la « dollarisation »), d’autres fixent leur monnaie à un taux constant face au dollar (un « peg », comme l’Arabie saoudite ou Hong Kong) [3]. Par ses dettes : emprunter en dollars coûte plus cher quand le dollar monte. Par ses échanges commerciaux, enfin, et par l’épargne de sa population quand les banques détiennent beaucoup de dépôts en dollars.',
      'Quand la Réserve fédérale américaine relève ses taux, les capitaux repartent vers les États-Unis et le dollar s’apprécie : les pays très dépendants voient leur dette s’alourdir et leurs importations renchérir. C’est par ce canal que la politique monétaire américaine se diffuse au reste du monde (le « cycle financier mondial ») [4].',
    ],
    refs: [
      { label: 'FMI, Currency Composition of Official Foreign Exchange Reserves (COFER)', url: 'https://data.imf.org/en/news/october-1-2025-cofer' },
      { label: 'FMI (2025), Patterns of Invoicing Currency in Global Trade in a Fragmenting World Economy', url: 'https://www.imf.org/en/publications/wp/issues/2025/09/12/patterns-of-invoicing-currency-in-global-trade-in-a-fragmenting-world-economy-570297' },
      { label: 'FMI, Annual Report on Exchange Arrangements and Exchange Restrictions (AREAER)', url: 'https://www.elibrary-areaer.imf.org/' },
      { label: 'Rey (2015), Dilemma not Trilemma, NBER w21162', url: 'https://www.nber.org/papers/w21162' },
    ],
  },
  exposure: {
    paragraphs: [
      'Une économie ouverte profite des échanges, mais elle importe aussi les chocs du reste du monde : récession chez un grand client, flambée du pétrole, crise alimentaire, durcissement monétaire américain, fin d’un programme d’aide…',
      'Cet indice mesure cette exposition de façon globale. Chaque dépendance est ramenée sur une même échelle de 0 à 100, où 100 correspond à une dépendance « très forte » (par exemple 40 % des échanges avec un seul partenaire), puis on fait la moyenne. Les seuils sont des choix du projet, documentés dans le code [1]. Un pays peut être peu dépendant en moyenne mais très exposé sur un seul axe : le radar de la fiche pays le montre.',
    ],
    refs: [{ label: 'MacroGlobe, code du pipeline (EXPOSURE_AXES)', url: 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py' }],
  },
  china: {
    paragraphs: [
      'En une génération, la Chine est devenue le premier exportateur mondial de marchandises [1]. En 2001, plus de 80 % des pays commerçaient davantage avec les États-Unis qu’avec la Chine ; en 2018, c’était l’inverse pour deux pays sur trois (128 sur 190) [2].',
      'Une part élevée peut venir des exportations (un pays minier qui vend à la Chine dépend de sa demande) ou des importations (un pays qui achète en Chine ses biens de consommation et ses équipements). La fiche pays distingue les deux. Une forte dépendance rend le pays sensible au ralentissement chinois et peut devenir un levier politique.',
    ],
    refs: [
      { label: 'OMC, statistiques du commerce mondial', url: 'https://stats.wto.org/' },
      { label: 'Lowy Institute, China vs US trade dominance', url: 'https://charts.lowyinstitute.org/charts/china-us-trade-dominance/us-china-competition' },
    ],
  },
  us_trade: {
    paragraphs: [
      'Les États-Unis sont le premier importateur mondial de marchandises [1] : leur demande fait tourner une grande partie de l’industrie mondiale. Leurs voisins (Mexique, Canada) y réalisent l’essentiel de leurs échanges, ce que montre directement ce filtre [2].',
      'Une forte dépendance commerciale aux États-Unis expose aux droits de douane, aux renégociations d’accords commerciaux et aux cycles de la consommation américaine.',
    ],
    refs: [
      { label: 'OMC, statistiques du commerce mondial', url: 'https://stats.wto.org/' },
      { label: 'FMI, Direction of Trade Statistics (via DBnomics)', url: 'https://db.nomics.world/IMF/DOT' },
    ],
  },
  eu_trade: {
    paragraphs: [
      'L’Union européenne forme un marché unique de 27 pays [1] avec une politique commerciale commune : vue de l’extérieur, c’est l’un des plus grands blocs commerciaux du monde.',
      'Pour ses voisins (Balkans, Afrique du Nord, Turquie, Europe de l’Est hors UE), l’UE est souvent le principal débouché. Pour les États membres, le chiffre inclut le commerce avec les autres membres : il mesure surtout leur degré d’intégration au marché unique.',
    ],
    refs: [{ label: 'Union européenne, les pays de l’UE', url: 'https://european-union.europa.eu/principles-countries-history/eu-countries_fr' }],
  },
  energy: {
    paragraphs: [
      'Un pays consomme du pétrole, du gaz, du charbon, de l’électricité nucléaire ou renouvelable. Les importations nettes d’énergie (importations moins exportations) sont rapportées à sa consommation totale [1].',
      'Un pays qui importe l’essentiel de son énergie voit sa facture extérieure, son inflation et parfois sa croissance dépendre des cours mondiaux et de ses fournisseurs. En 2022, après la réduction de plus de moitié des livraisons de gaz russe par gazoduc, le prix du gaz en Europe a atteint des records historiques [2]. À l’inverse, les exportateurs nets (Norvège, pays du Golfe, Russie) profitent des hausses de prix.',
    ],
    refs: [
      WB('EG.IMP.CONS.ZS', 'importations nettes d’énergie, définition'),
      { label: 'AIE, Gas Market Report Q4-2022', url: 'https://www.iea.org/reports/gas-market-report-q4-2022/cold-comfort' },
    ],
  },
  food: {
    paragraphs: [
      'Les pays qui ne produisent pas assez pour nourrir leur population, faute de terres arables ou d’eau (Moyen-Orient, Afrique du Nord, petites îles), importent une grande partie de leur alimentation, en particulier des céréales.',
      'Quand les prix agricoles mondiaux flambent, comme en 2007-2008 et en 2022 [1], ces pays subissent une hausse brutale du coût de la vie. En 2008, la Banque mondiale a recensé des émeutes de la faim dans plus de 30 pays [2].',
    ],
    refs: [
      { label: 'FAO, indice des prix des produits alimentaires', url: 'https://www.fao.org/worldfoodsituation/foodpricesindex/fr/' },
      { label: 'Crise alimentaire mondiale de 2007-2008 (synthèse et sources)', url: 'https://fr.wikipedia.org/wiki/Crise_alimentaire_mondiale_de_2007-2008' },
    ],
  },
  remittances: {
    paragraphs: [
      'Les envois de fonds (ou « remises migratoires ») sont l’argent que les travailleurs émigrés transfèrent à leur famille restée au pays. Pour les pays à revenu faible et intermédiaire, ils ont atteint environ 656 milliards de dollars en 2023, davantage que les investissements directs étrangers et l’aide publique au développement réunis [1].',
      'Ces flux soutiennent la consommation des ménages et apportent des devises. Ils résistent mieux aux crises que les capitaux privés : en 2020, ils ont bien moins baissé que les investissements étrangers [1]. Ils dépendent toutefois de la conjoncture et des politiques migratoires des pays d’accueil.',
    ],
    refs: [{ label: 'Banque mondiale, Migration and Development Brief (People Move)', url: 'https://blogs.worldbank.org/en/peoplemove/remittances-slowed-in-2023---we-need-to-take-note' }],
  },
  aid: {
    paragraphs: [
      'L’aide publique au développement (APD) est définie par l’OCDE : ce sont les dons et les prêts à conditions très avantageuses accordés par des États ou des institutions publiques pour favoriser le développement économique et le bien-être des pays en développement [1].',
      'En 1970, l’Assemblée générale de l’ONU (résolution 2626) a demandé aux pays riches d’y consacrer 0,7 % de leur revenu national ; seule une poignée de pays a jamais atteint cet objectif [2]. Dans les pays les plus pauvres ou en conflit, l’aide peut financer une large part du budget de l’État et des services de base, ce qui les rend vulnérables aux coupes budgétaires des donateurs.',
    ],
    refs: [
      { label: 'OCDE, Official development assistance: definition and coverage', url: 'https://www.oecd.org/en/topics/sub-issues/oda-eligibility-and-conditions/official-development-assistance--definition-and-coverage.html' },
      { label: 'OCDE (2013), The Evolution of Official Development Assistance (historique de l’objectif de 0,7 %)', url: 'https://www.oecd.org/content/dam/oecd/en/publications/reports/2013/12/the-evolution-of-official-development-assistance_g17a242d/5k3v1dv3f024-en.pdf' },
    ],
  },
  external_debt: {
    paragraphs: [
      'La dette extérieure regroupe tout ce que les résidents d’un pays (l’État, mais aussi les banques et les entreprises) doivent à des créanciers étrangers [1]. Elle doit en général être remboursée en devises, souvent en dollars, que le pays doit gagner en exportant.',
      'Les économistes Barry Eichengreen et Ricardo Hausmann ont appelé « péché originel » (1999) l’incapacité de nombreux pays en développement à emprunter à l’étranger dans leur propre monnaie [2]. Quand leur monnaie chute, leur dette exprimée en monnaie locale gonfle mécaniquement. Le service de la dette (intérêts + remboursements) en % des exportations mesure la pression immédiate : plus il est élevé, plus le risque d’une crise de paiement augmente.',
    ],
    refs: [
      WB('DT.DOD.DECT.GN.ZS', 'dette extérieure, définition'),
      { label: 'Eichengreen & Hausmann (1999), Exchange Rates and Financial Fragility, NBER w7418', url: 'https://www.nber.org/papers/w7418' },
    ],
  },
  reserves: {
    paragraphs: [
      'Les réserves de change sont les avoirs détenus par la banque centrale en devises étrangères (surtout des dollars et des euros), en or et en droits de tirage spéciaux du FMI [1]. Elles servent à payer les importations et les dettes en cas de crise, et à défendre la monnaie nationale contre la spéculation.',
      'Les mesurer en mois d’importations est la règle empirique la plus ancienne, avec un minimum prudent usuel de 3 mois [3] ; d’autres règles comparent les réserves à la dette extérieure à court terme (règle de Greenspan-Guidotti : couvrir 100 % de la dette due dans l’année) [2]. Cette dernière reste le repère le plus utilisé pour les pays émergents, mais le FMI juge ces règles partielles et propose des mesures plus complètes [2].',
    ],
    refs: [
      WB('FI.RES.TOTL.MO', 'réserves totales en mois d’importations, définition'),
      { label: 'FMI (2011), Assessing Reserve Adequacy (règle de Greenspan-Guidotti)', url: 'https://www.imf.org/external/np/pp/eng/2011/021411b.pdf' },
      { label: 'FMI (2006), The Optimal Level of International Reserves for Emerging Market Countries (règle des 3 mois)', url: 'https://www.imf.org/external/pubs/ft/wp/2006/wp06229.pdf' },
    ],
  },
  population: {
    paragraphs: [
      'La population est le socle de l’économie : elle fournit les travailleurs et les consommateurs. Selon l’ONU, l’Inde est devenue en avril 2023 le pays le plus peuplé du monde, devant la Chine [1] ; la population mondiale a franchi le cap des 8 milliards le 15 novembre 2022 [2].',
      'Pour l’avenir, la structure par âge compte autant que le total : une population jeune et en croissance offre une main-d’œuvre abondante, une population âgée pèse sur les retraites et la santé.',
    ],
    refs: [
      { label: 'ONU DESA (2023), India overtakes China as the world’s most populous country', url: 'https://www.un.org/development/desa/pd/node/4293' },
      { label: 'ONU, Journée des 8 milliards', url: 'https://www.un.org/fr/dayof8billion' },
    ],
  },
  fertility: {
    paragraphs: [
      'L’indice synthétique de fécondité (ISF) additionne les taux de fécondité observés cette année à chaque âge, de 15 à 49 ans. C’est le nombre d’enfants qu’aurait une femme si, toute sa vie, elle avait les comportements observés cette année [1].',
      'Pourquoi 2,1 et pas 2 ? Chaque femme doit être « remplacée » par une fille qui atteindra à son tour l’âge d’avoir des enfants. Or il naît un peu plus de garçons que de filles (environ 105 pour 100) et une partie des enfants meurt avant l’âge adulte : il faut donc un peu plus de deux enfants par femme. Dans les pays où la mortalité infantile est forte, le seuil réel est plus élevé [2].',
      'La Corée du Sud a l’un des indices les plus bas du monde : 0,75 enfant par femme en 2024, le seul pays de l’OCDE sous 1 [3]. À l’autre extrémité, le Tchad, la Somalie, la République centrafricaine et le Niger avoisinent ou dépassent 6 [4]. Quand la fécondité baisse, un pays connaît d’abord un « dividende démographique » (beaucoup d’actifs, peu d’enfants à charge) avant de vieillir.',
    ],
    refs: [
      { label: 'Ined, indicateurs de fécondité', url: 'https://www.ined.fr/fr/tout-savoir-population/chiffres/europe-pays-developpes/indicateurs-fecondite/' },
      { label: 'Our World in Data, Fertility Rate (seuil de renouvellement)', url: 'https://ourworldindata.org/fertility-rate' },
      { label: 'NBC News / Statistics Korea, fécondité 2024', url: 'https://www.nbcnews.com/news/world/birth-rate-south-korea-worlds-lowest-rises-first-time-9-years-rcna193777' },
      WB('SP.DYN.TFRT.IN', 'indice synthétique de fécondité'),
    ],
  },
  median_age: {
    paragraphs: [
      'L’âge médian résume la structure par âge en un seul chiffre : s’il est de 40 ans, la moitié des habitants a moins de 40 ans et l’autre moitié plus. Contrairement à l’âge moyen, il n’est pas tiré vers le haut par les plus âgés.',
      'Il va d’environ 15 ans dans les pays les plus jeunes (République centrafricaine, Niger, Tchad) à près de 50 ans au Japon et en Italie [1]. Un âge médian élevé annonce des dépenses de retraite et de santé croissantes et une population active qui diminue ; un âge médian très bas, un besoin massif d’écoles et d’emplois.',
    ],
    refs: [OWID('median-age', 'Median age (ONU, World Population Prospects)')],
  },
  life_expectancy: {
    paragraphs: [
      'L’espérance de vie à la naissance est l’âge moyen au décès d’une génération fictive qui connaîtrait, toute sa vie, les taux de mortalité de l’année. C’est un indicateur de l’état sanitaire actuel, pas une prédiction : les progrès médicaux futurs ne sont pas pris en compte [1].',
      'Elle est très sensible à la mortalité des enfants : quand beaucoup d’enfants meurent avant 5 ans, la moyenne chute, même si les adultes vivent longtemps. La moyenne mondiale était de 73,3 ans en 2024 [2] ; elle atteint 84 ans au Japon et plus de 85 ans à Hong Kong, mais reste sous 60 ans au Nigeria ou au Tchad [3].',
    ],
    refs: [
      { label: 'Ined, glossaire : life expectancy', url: 'https://www.ined.fr/en/glossary/life-expectancy' },
      UN_WPP,
      WB('SP.DYN.LE00.IN', 'espérance de vie à la naissance'),
    ],
  },
  hdi: {
    paragraphs: [
      'L’indice de développement humain (IDH) a été créé en 1990 pour le Programme des Nations unies pour le développement (PNUD) par l’économiste pakistanais Mahbub ul Haq, avec l’apport d’Amartya Sen, prix Nobel d’économie [1]. L’idée : le développement ne se résume pas au revenu, il consiste à élargir les possibilités réelles des personnes.',
      'Il combine trois dimensions, chacune ramenée entre 0 et 1 : une vie longue et en bonne santé (espérance de vie à la naissance) ; le savoir (durée moyenne de scolarisation des adultes et durée attendue pour les enfants) ; un niveau de vie décent (revenu national brut par habitant en PPA, sur une échelle logarithmique, car un dollar de plus compte davantage pour un pauvre que pour un riche). L’IDH est la moyenne géométrique des trois : un très mauvais résultat sur une dimension ne peut pas être entièrement compensé par les autres [2].',
      'Le PNUD classe les pays en quatre catégories : développement très élevé (0,800 et plus), élevé (0,700 à 0,799), moyen (0,550 à 0,699) et faible (moins de 0,550) [2]. Dans le rapport 2025, l’Islande est en tête (0,972), devant la Norvège et la Suisse (0,970) [3].',
    ],
    refs: [
      { label: 'PNUD, About Human Development', url: 'https://hdr.undp.org/about/human-development' },
      { label: 'PNUD, Human Development Index (méthode et seuils)', url: 'https://hdr.undp.org/data-center/human-development-index' },
      { label: 'PNUD, Rapport 2025, annexe statistique (tableau IDH)', url: 'https://hdr.undp.org/sites/default/files/2025_HDR/HDR25_Statistical_Annex_HDI_Table.pdf' },
    ],
  },
  gini: {
    paragraphs: [
      'L’indice de Gini, proposé par le statisticien italien Corrado Gini en 1912, est la mesure des inégalités la plus utilisée [1]. On classe les habitants du plus pauvre au plus riche et on trace la « courbe de Lorenz » : la part du revenu total détenue par les 10 % les plus pauvres, les 20 %, les 30 %, etc.',
      'Si tout le monde avait le même revenu, cette courbe serait une droite : les 30 % les plus pauvres auraient 30 % du revenu. Plus la courbe s’en écarte, plus le revenu est concentré. Le Gini mesure la surface entre la droite d’égalité et la courbe réelle : 0 = égalité parfaite, 100 = une seule personne détient tout [2].',
      'Repères tirés des enquêtes de la Banque mondiale : les pays nordiques tournent autour de 25-30, la France autour de 32, les États-Unis autour de 42, le Brésil autour de 50 ; l’Afrique australe (Afrique du Sud, Namibie, Botswana) détient les valeurs les plus élevées du monde, entre 50 et 63 selon les enquêtes [2][3]. Le Gini ne dit pas où se situent les inégalités (en haut ou en bas de l’échelle) : deux répartitions très différentes peuvent avoir le même indice.',
    ],
    refs: [
      { label: 'Coefficient de Gini (histoire et calcul)', url: 'https://fr.wikipedia.org/wiki/Coefficient_de_Gini' },
      WB('SI.POV.GINI', 'indice de Gini, définition et données'),
      MACROGLOBE_DATA,
    ],
  },
  corruption: {
    paragraphs: [
      'L’indice de perception de la corruption (IPC, ou CPI en anglais) est publié chaque année depuis 1995 par l’ONG Transparency International. La corruption étant cachée par nature, on ne peut pas la compter directement : l’IPC agrège 13 enquêtes et évaluations de 12 institutions indépendantes (Banque mondiale, Forum économique mondial, cabinets d’analyse de risque…) menées auprès d’experts et de dirigeants d’entreprise [1].',
      'Il porte sur la corruption dans le secteur public : pots-de-vin, détournements de fonds, usage d’une fonction publique à des fins privées, népotisme, capture de l’État par des intérêts privés. Un pays n’est noté que s’il est couvert par au moins trois sources [1].',
      'Dans l’édition 2024, le Danemark est en tête (90), devant la Finlande (88) et Singapour (84) ; le Soudan du Sud (8), la Somalie (9) et le Venezuela (10) ferment la marche. Plus des deux tiers des pays obtiennent moins de 50 [2].',
    ],
    refs: [
      { label: 'Transparency International, How CPI scores are calculated', url: 'https://www.transparency.org/en/news/how-cpi-scores-are-calculated' },
      { label: 'Transparency International, Corruption Perceptions Index 2024', url: 'https://www.transparency.org/en/cpi/2024' },
    ],
  },
  unemployment: {
    paragraphs: [
      'Selon l’Organisation internationale du travail (OIT), un chômeur est une personne en âge de travailler qui, pendant la période de référence, était sans emploi, disponible pour travailler et à la recherche active d’un emploi. Le taux de chômage rapporte leur nombre à la population active (personnes en emploi + chômeurs) [1].',
      'Les personnes découragées qui ont cessé de chercher ne sont pas comptées, pas plus que celles à temps partiel qui voudraient travailler davantage. Les estimations « modélisées » de l’OIT harmonisent les enquêtes nationales pour rendre les pays comparables [2].',
    ],
    refs: [
      { label: 'Banque mondiale, métadonnées du taux de chômage (définition OIT)', url: 'https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SL.UEM.TOTL.ZS' },
      OWID('unemployment-rate', 'Unemployment rate (OIT)'),
    ],
  },
  politics: {
    paragraphs: [
      'L’axe gauche-droite est né en 1789 à l’Assemblée constituante française : les partisans du veto royal s’asseyaient à droite du président, ses opposants à gauche [1]. Il reste la grille de lecture politique la plus répandue dans le monde.',
      'Schématiquement, la gauche met l’accent sur l’égalité, la redistribution et l’intervention de l’État dans l’économie ; la droite, sur la liberté économique, l’ordre, les traditions ou la nation ; le centre cherche une voie médiane. Les extrêmes rejettent certaines règles du jeu démocratique ou libéral : collectivisation et parti unique à l’extrême gauche communiste, nationalisme ethnique ou autoritaire à l’extrême droite.',
      'Le sens de ces étiquettes varie d’un pays à l’autre : un parti « conservateur » au Royaume-Uni et en Inde ne défend pas les mêmes idées. La catégorie « Monarchie / Théocratie / Autre » regroupe les régimes où le pouvoir ne vient pas de partis en compétition : monarchies absolues du Golfe, Iran, juntes militaires. Le positionnement de chaque parti provient de Wikidata [2].',
    ],
    refs: [
      { label: 'Clivage gauche-droite (origine en 1789 et sources)', url: 'https://fr.wikipedia.org/wiki/Clivage_gauche-droite' },
      { label: 'Wikidata, propriété « positionnement politique » (P1387)', url: 'https://www.wikidata.org/wiki/Property:P1387' },
    ],
  },
  traj10: {
    paragraphs: [
      'Une projection « à politique inchangée » (ou « toutes choses égales par ailleurs ») répond à la question : que se passerait-il si les tendances actuelles se prolongeaient ? Elle ne prédit pas l’avenir, elle montre la pente sur laquelle se trouve un pays.',
      'Ce type de modèle repose sur une idée simple : la croissance de long terme dépend du nombre de travailleurs et de leur productivité. Un pays dont la population active va diminuer (fécondité basse, vieillissement) verra sa croissance potentielle baisser [1] ; un pays très endetté consacrera une part croissante de ses ressources aux intérêts. Toutes les hypothèses du modèle sont dans le code du projet [2].',
      'Le TCAM (taux de croissance annuel moyen) affiché dans la fiche est la croissance constante qui ferait passer du PIB d’aujourd’hui au PIB projeté : il permet de comparer des trajectoires de durées différentes.',
    ],
    refs: [
      UN_WPP,
      { label: 'MacroGlobe, code du pipeline (compute_projection)', url: 'https://github.com/ede800/macroglobe-3d/blob/main/scripts/update_macro_data.py' },
    ],
  },
  traj25: {
    paragraphs: [
      'À 25 ans, les dynamiques lentes deviennent dominantes. La démographie est la plus prévisible d’entre elles : la plupart des actifs de 2050 sont déjà nés, et l’ONU publie des projections de population par âge jusqu’en 2100 [1].',
      'La dette évolue selon l’écart entre le taux d’intérêt et la croissance : un pays très endetté dont la croissance ralentit (vieillissement) voit son ratio grimper, ce qui dégrade son score de stabilité, et inversement [2].',
    ],
    refs: [
      UN_WPP,
      { label: 'Blanchard (2019), Public Debt and Low Interest Rates, American Economic Review', url: 'https://www.aeaweb.org/articles?id=10.1257/aer.109.4.1197' },
    ],
  },
};

/** Reference countries whose current value is shown on every filter card, as landmarks. */
export const BENCHMARK_ISO3 = ['FRA', 'DEU', 'USA', 'CHN', 'JPN', 'IND', 'BRA', 'NGA'];

export const GLOSSARY: { term: string; definition: string; source?: SourceLink }[] = [
  { term: 'Balance courante', definition: 'Solde de toutes les transactions courantes d’un pays avec l’étranger : exportations moins importations de biens et services, plus les revenus et transferts reçus, moins ceux versés. Un déficit signifie que le pays dépense plus qu’il ne gagne vis-à-vis de l’extérieur et doit emprunter la différence.', source: WB('BN.CAB.XOKA.GD.ZS', 'balance courante') },
  { term: 'Change flottant', definition: 'Régime où le cours de la monnaie est fixé par l’offre et la demande sur les marchés ; la banque centrale n’intervient qu’exceptionnellement.', source: { label: 'FMI, AREAER', url: 'https://www.elibrary-areaer.imf.org/' } },
  { term: 'Déflation', definition: 'Baisse générale et durable des prix. Elle semble favorable, mais pousse les ménages à reporter leurs achats et alourdit le poids réel des dettes : c’est pourquoi le score de confiance la pénalise.', source: { label: 'Insee, définition', url: 'https://www.insee.fr/fr/metadonnees/definition/c2023' } },
  { term: 'Dette brute / dette nette', definition: 'La dette brute compte tout ce que l’État doit ; la dette nette en déduit ses actifs financiers (trésorerie, participations). Les comparaisons internationales utilisent le plus souvent la dette brute.', source: { label: 'FMI, World Economic Outlook Database', url: 'https://www.imf.org/en/Publications/WEO/weo-database' } },
  { term: 'Dollarisation', definition: 'Utilisation du dollar américain à la place de la monnaie nationale, ou à côté d’elle. Elle est officielle quand l’État adopte le dollar (Équateur, Panama), partielle quand les habitants épargnent et empruntent en dollars par méfiance envers leur monnaie.', source: { label: 'FMI, AREAER', url: 'https://www.elibrary-areaer.imf.org/' } },
  { term: 'Échelle logarithmique', definition: 'Échelle où chaque graduation multiplie la valeur au lieu de l’additionner (1, 10, 100, 1 000…). Indispensable quand les valeurs vont de quelques millions à des milliers de milliards, comme pour le PIB.' },
  { term: 'Échelle racine carrée', definition: 'Échelle intermédiaire qui étire les petites valeurs : elle permet de distinguer 2 % de 8 % quand quelques pays atteignent 40 %.' },
  { term: 'Inflation', definition: 'Hausse générale des prix sur un an, mesurée le plus souvent par l’indice des prix à la consommation. Elle réduit le pouvoir d’achat de la monnaie.', source: { label: 'Insee, définition', url: 'https://www.insee.fr/fr/metadonnees/definition/c1473' } },
  { term: 'Médiane', definition: 'Valeur qui partage un ensemble en deux moitiés : autant de pays au-dessus qu’en dessous. Contrairement à la moyenne, elle n’est pas déformée par quelques valeurs extrêmes.' },
  { term: 'Parité de pouvoir d’achat (PPA)', definition: 'Taux de conversion entre monnaies qui égalise le prix d’un même panier de biens et services dans tous les pays. Elle sert à comparer des volumes et des niveaux de vie réels plutôt que des montants en dollars au taux du marché.', source: { label: 'Banque mondiale, ICP', url: 'https://www.worldbank.org/en/programs/icp' } },
  { term: 'Peg (ancrage)', definition: 'Régime de change où la banque centrale maintient sa monnaie à un taux fixe face à une devise de référence (dollar ou euro). Il apporte de la stabilité mais oblige à suivre la politique monétaire du pays d’ancrage.', source: { label: 'FMI, AREAER', url: 'https://www.elibrary-areaer.imf.org/' } },
  { term: 'PIB nominal / PIB réel', definition: 'Le PIB nominal est mesuré aux prix de l’année ; le PIB réel (ou « en volume ») aux prix d’une année de référence, pour isoler l’évolution des quantités produites.', source: { label: 'Insee, définition du PIB', url: 'https://www.insee.fr/fr/metadonnees/definition/c1365' } },
  { term: 'Revenu national brut (RNB)', definition: 'PIB plus les revenus reçus de l’étranger, moins ceux versés à l’étranger (dividendes, intérêts, salaires). Il mesure ce que gagnent les résidents plutôt que ce qui est produit sur le territoire.', source: WB('NY.GNP.MKTP.CD', 'RNB') },
  { term: 'Service de la dette', definition: 'Somme des intérêts et des remboursements de capital dus sur une année. Rapporté aux exportations, il indique quelle part des devises gagnées part chaque année aux créanciers.', source: WB('DT.TDS.DECT.EX.ZS', 'service de la dette') },
  { term: 'Seuil de renouvellement', definition: 'Nombre moyen d’enfants par femme (environ 2,1 dans les pays à faible mortalité) qui permet à une population de se maintenir à long terme sans migrations.', source: { label: 'Our World in Data, Fertility Rate', url: 'https://ourworldindata.org/fertility-rate' } },
  { term: 'TCAM', definition: 'Taux de croissance annuel moyen : le taux constant qui, appliqué chaque année, ferait passer de la valeur de départ à la valeur d’arrivée.' },
  { term: 'VADER', definition: 'Outil d’analyse de sentiment (Hutto et Gilbert, 2014) qui note un texte de −1 à +1 à partir d’un dictionnaire de mots positifs et négatifs et de règles (négation, intensité). Le projet y ajoute un lexique financier en anglais (« recession », « default », « recovery »…).', source: { label: 'Hutto & Gilbert (2014), ICWSM', url: 'https://ojs.aaai.org/index.php/ICWSM/article/view/14550' } },
  { term: 'Wikidata', definition: 'Base de connaissances libre et collaborative de la fondation Wikimedia, qui alimente Wikipédia. Le projet y lit les dirigeants en fonction, leur parti et l’orientation de ce parti.', source: { label: 'Wikidata', url: 'https://www.wikidata.org/' } },
];
