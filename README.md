# MacroGlobe 3D

Globe 3D interactif (React + react-globe.gl) qui affiche la santé macroéconomique, les dépendances structurelles (tourisme, dollar US) et les projections à +10 / +25 ans des 40 premières économies mondiales. Données régénérées chaque jour à 02:00 UTC par GitHub Actions, hébergement gratuit sur GitHub Pages.

## Arborescence

```
macroglobe-3d/
├── .github/workflows/daily_update_and_deploy.yml   # cron 02:00 UTC + push + manuel → data → build → Pages
├── scripts/
│   ├── update_macro_data.py     # pipeline : World Bank + Google News/GDELT + VADER → JSON
│   └── requirements.txt
├── public/
│   ├── data/
│   │   ├── macro_data.json      # jeu de données (40 pays), réécrit chaque jour
│   │   └── countries.geojson    # frontières Natural Earth 1:110m (allégé)
│   └── textures/                # earth-dark.jpg, earth-topology.png, night-sky.png
├── src/
│   ├── main.tsx · App.tsx · index.css · types.ts · vite-env.d.ts
│   ├── lib/metrics.ts           # échelles de couleur, formats, définition des filtres
│   └── components/
│       ├── GlobeView.tsx        # globe, choroplèthe, survol, zoom caméra
│       ├── CountrySidebar.tsx   # panneau glassmorphism du pays
│       ├── ComparisonModal.tsx  # comparaison côte à côte
│       ├── SearchBar.tsx        # recherche (raccourci « / »)
│       ├── MapLegend.tsx        # légende + classement
│       └── ui.tsx               # jauges, tuiles, infobulles
├── index.html · package.json · package-lock.json
├── vite.config.ts (base: './') · tailwind.config.js · postcss.config.js · tsconfig.json
```

## En local

```bash
npm install
npm run dev                         # http://localhost:5173
pip install -r scripts/requirements.txt
python scripts/update_macro_data.py            # données live
python scripts/update_macro_data.py --offline  # données de référence uniquement (sans réseau)
```

Lien direct vers un pays : `…/#FRA`, `…/#JPN`, etc.

## Méthodologie (résumé)

- **Confiance (0-100)** = 40 % macro (croissance 55 % / inflation 45 %) + 30 % fiscal (dette 60 % / balance courante 40 %) + 30 % sentiment VADER des titres du jour. Décomposition exacte : score = 50 + Σ poids × (sous-score − 50).
- **Dépendance USD (0-100)** = régime de change 35 + matières premières en USD 20 + dette externe en USD 20 + facturation en USD 15 + dépôts en devises 10.
- **Projection « Continuité actuelle »** : la croissance converge de sa moyenne 5 ans (bornée −4/+10 %) vers une ancre démographique (demi-vie 12 ans), avec un frein au-delà de 90 % de dette/PIB et un bonus/malus de confiance qui s'estompe. La dette suit d/(1+g)×(1+r) avec r réel = 1,5 % et un solde primaire nul.
- **Repli** : valeur World Bank récente → valeur de référence 2024 intégrée au script ; actualité Google News → GDELT → cache ≤ 7 jours → neutre.

## Déploiement sur GitHub Pages

1. Créez un dépôt GitHub (public) et poussez-y ce dossier sur la branche `main`.
2. **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.
3. **Settings → Actions → General → Workflow permissions : « Read and write permissions »** → Save.
4. **Actions → « Daily data update & deploy » → Run workflow** (ou attendez le premier push).
5. L'URL publique s'affiche dans **Settings → Pages** : `https://<utilisateur>.github.io/<dépôt>/`.

Avertissement : outil pédagogique ; les scores et projections sont mécaniques et ne constituent pas un conseil d'investissement.
