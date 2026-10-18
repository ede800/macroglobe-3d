#!/usr/bin/env python3
"""
MacroGlobe 3D - daily static data pipeline.

Builds public/data/macro_data.json for every economy with usable data (~200) from free, key-less sources:
  * World Bank REST API (api.worldbank.org/v2) for structural macro indicators and export structure
  * IMF World Economic Outlook via DBnomics (api.db.nomics.world) for government debt, Taiwan and recent gaps
  * Google News RSS (primary) / GDELT DOC API (fallback) for daily headlines,
    scored with VADER for a daily sentiment reading

Every network step has a fallback chain, so the script ALWAYS writes a valid file:
  Most recent of World Bank / IMF  ->  embedded seed value (40 reference economies)  ->  regional median
  Today's headlines                ->  last known sentiment (<= 7 days)  ->  neutral seed

Usage:
  python scripts/update_macro_data.py              # full online run
  python scripts/update_macro_data.py --offline    # seed data only (no network)
  python scripts/update_macro_data.py --no-news    # World Bank only, reuse cached sentiment
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

try:
    import requests
except ImportError:  # offline mode can still run without requests installed
    requests = None  # type: ignore[assignment]

try:
    import feedparser
except ImportError:
    feedparser = None  # type: ignore[assignment]

try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
except ImportError:
    SentimentIntensityAnalyzer = None  # type: ignore[assignment,misc]


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = ROOT / "public" / "data" / "macro_data.json"
SCHEMA_VERSION = 2
HTTP_TIMEOUT = 25
USER_AGENT = "MacroGlobe3D/1.0 (+https://github.com; static data pipeline)"

# ---------------------------------------------------------------------------
# Methodology constants (exported into the JSON so the UI can display them)
# ---------------------------------------------------------------------------

CONFIDENCE_WEIGHTS = {"macro": 0.40, "fiscal": 0.30, "sentiment": 0.30}
MACRO_SUBWEIGHTS = {"growth": 0.55, "inflation": 0.45}
FISCAL_SUBWEIGHTS = {"debt": 0.60, "current_account": 0.40}

USD_WEIGHTS = {"regime": 35, "commodities": 20, "external_debt": 20, "invoicing": 15, "deposits": 10}
REGIME_POINTS = {
    "dollarized": 1.00,
    "hard_peg": 0.92,
    "managed_usd": 0.58,
    "managed_basket": 0.35,
    "free_float": 0.12,
    "euro_peg": 0.10,
    "euro_member": 0.06,
    "issuer": 0.0,
}
REGIME_LABELS = {
    "dollarized": "Dollarisation officielle",
    "hard_peg": "Ancrage fixe au USD (peg)",
    "managed_usd": "Flottement géré vs USD",
    "managed_basket": "Panier de devises géré",
    "free_float": "Change flottant",
    "euro_peg": "Ancrage à l'euro",
    "euro_member": "Zone euro",
    "issuer": "Émetteur du dollar",
}

PROJECTION = {
    "horizon_years": 25,
    "real_interest_rate": 1.5,       # % - uniform real rate used for the debt ratio path
    "growth_half_life": 12.0,        # years for current growth to converge to its long-run anchor
    "confidence_fade": 7.0,          # years (e-folding) for the confidence adjustment to fade
    "sentiment_fade": 3.0,           # years for news sentiment to revert to neutral
    "inflation_fade": 6.0,           # years for inflation to converge to 2 %
    "current_account_fade": 15.0,    # years for current account to converge to 0
}

# Indicator code -> (field, max age in years before falling back to the seed value)
WB_INDICATORS = {
    "NY.GDP.MKTP.CD": ("gdp_usd", 3),
    "NY.GDP.MKTP.KD.ZG": ("gdp_growth", 3),
    "FP.CPI.TOTL.ZG": ("inflation", 3),
    "GC.DOD.TOTL.GD.ZS": ("debt_gdp", 4),
    "ST.INT.RCPT.XP.ZS": ("tourism_exports_pct", 12),  # see pick_tourism()
    "ST.INT.RCPT.CD": ("tourism_receipts_usd", 12),
    "BN.CAB.XOKA.GD.ZS": ("current_account", 3),
    "SP.POP.GROW": ("pop_growth", 3),
    "TX.VAL.FUEL.ZS.UN": ("x_fuel", 5),
    "TX.VAL.MMTL.ZS.UN": ("x_metals", 5),
    "TX.VAL.FOOD.ZS.UN": ("x_food", 5),
    "TX.VAL.AGRI.ZS.UN": ("x_agri", 5),
}

# Finance-specific additions to the VADER lexicon (VADER is tuned for social media).
FINANCE_LEXICON = {
    "recession": -2.6, "stagflation": -2.6, "default": -2.4, "defaults": -2.4, "downgrade": -2.0,
    "downgraded": -2.0, "downgrades": -2.0, "slump": -2.0, "slumps": -2.0, "plunge": -2.2,
    "plunges": -2.2, "tumble": -1.8, "tumbles": -1.8, "contraction": -1.8, "contracts": -1.4,
    "layoffs": -1.8, "bankruptcy": -2.6, "deficit": -1.0, "shortfall": -1.4, "tariff": -0.8,
    "tariffs": -0.8, "sanctions": -1.4, "selloff": -1.8, "sell-off": -1.8, "devaluation": -1.8,
    "unrest": -1.8, "strike": -1.0, "strikes": -1.0, "inflationary": -1.0, "volatility": -0.8,
    "rebound": 1.8, "rebounds": 1.8, "rally": 1.8, "rallies": 1.8, "surge": 1.4, "surges": 1.4,
    "upgrade": 2.0, "upgraded": 2.0, "upgrades": 2.0, "expansion": 1.4, "expands": 1.2,
    "record-high": 1.6, "outperform": 1.6, "outperforms": 1.6, "investment": 0.8, "boom": 1.8,
    "recovery": 1.6, "recovers": 1.6, "growth": 0.9, "surplus": 1.2, "stabilise": 1.0,
    "stabilize": 1.0, "easing": 0.8, "beats": 1.2, "soars": 1.8,
}

ECON_QUERY = "(economy OR inflation OR GDP OR \"central bank\" OR markets OR currency)"

# ---------------------------------------------------------------------------
# Seed dataset - 40 economies, reference values ~2024 (World Bank / IMF WEO).
# Used as offline fallback for any indicator the live API cannot provide.
#   gdp_bn: nominal GDP, USD bn            growth_hist: real GDP growth 2020-2024 (%)
#   inflation: CPI % (2024)                debt: general gov. gross debt, % GDP
#   tour_x: tourism receipts, % exports    tour_gdp: tourism receipts, % GDP
#   ca: current account, % GDP             pop: population growth, %
#   regime: exchange-rate regime key       commo: share of exports in USD-priced commodities (0-1)
#   usd_debt: USD share of external debt   invoicing: USD share of trade invoicing
#   deposits: share of FX (USD) deposits in the banking system
# ---------------------------------------------------------------------------

SEED: list[dict[str, Any]] = [
    dict(iso3="USA", iso2="US", name="United States", name_fr="États-Unis", region="Amérique du Nord", currency="USD", lat=39.8, lng=-98.6,
         gdp_bn=29185, growth_hist=[-2.2, 6.1, 2.5, 2.9, 2.8], inflation=2.9, debt=121, tour_x=5.8, tour_gdp=0.7, ca=-3.9, pop=1.0,
         regime="issuer", commo=0.12, usd_debt=0.0, invoicing=0.0, deposits=0.0),
    dict(iso3="CHN", iso2="CN", name="China", name_fr="Chine", region="Asie de l'Est", currency="CNY", lat=35.0, lng=104.0,
         gdp_bn=18744, growth_hist=[2.2, 8.4, 3.0, 5.2, 5.0], inflation=0.2, debt=88, tour_x=1.0, tour_gdp=0.1, ca=2.2, pop=-0.1,
         regime="managed_basket", commo=0.03, usd_debt=0.55, invoicing=0.60, deposits=0.03),
    dict(iso3="DEU", iso2="DE", name="Germany", name_fr="Allemagne", region="Europe", currency="EUR", lat=51.2, lng=10.4,
         gdp_bn=4659, growth_hist=[-4.1, 3.7, 1.4, -0.3, -0.2], inflation=2.5, debt=63, tour_x=2.5, tour_gdp=1.2, ca=5.7, pop=0.3,
         regime="euro_member", commo=0.04, usd_debt=0.20, invoicing=0.30, deposits=0.02),
    dict(iso3="JPN", iso2="JP", name="Japan", name_fr="Japon", region="Asie de l'Est", currency="JPY", lat=36.2, lng=138.3,
         gdp_bn=4026, growth_hist=[-4.2, 2.7, 1.0, 1.5, 0.1], inflation=2.7, debt=237, tour_x=5.5, tour_gdp=1.3, ca=4.8, pop=-0.5,
         regime="free_float", commo=0.02, usd_debt=0.40, invoicing=0.50, deposits=0.02),
    dict(iso3="IND", iso2="IN", name="India", name_fr="Inde", region="Asie du Sud", currency="INR", lat=21.0, lng=78.0,
         gdp_bn=3910, growth_hist=[-5.8, 9.7, 7.0, 8.2, 6.5], inflation=4.9, debt=83, tour_x=3.8, tour_gdp=0.8, ca=-0.7, pop=0.9,
         regime="managed_usd", commo=0.15, usd_debt=0.54, invoicing=0.85, deposits=0.03),
    dict(iso3="GBR", iso2="GB", name="United Kingdom", name_fr="Royaume-Uni", region="Europe", currency="GBP", lat=54.0, lng=-2.0,
         gdp_bn=3644, growth_hist=[-10.3, 8.6, 4.8, 0.4, 1.1], inflation=2.5, debt=101, tour_x=6.5, tour_gdp=2.0, ca=-2.7, pop=0.9,
         regime="free_float", commo=0.08, usd_debt=0.30, invoicing=0.30, deposits=0.04),
    dict(iso3="FRA", iso2="FR", name="France", name_fr="France", region="Europe", currency="EUR", lat=46.6, lng=2.4,
         gdp_bn=3162, growth_hist=[-7.5, 6.9, 2.6, 1.1, 1.2], inflation=2.0, debt=113, tour_x=9.0, tour_gdp=2.4, ca=0.4, pop=0.3,
         regime="euro_member", commo=0.03, usd_debt=0.20, invoicing=0.25, deposits=0.02),
    dict(iso3="ITA", iso2="IT", name="Italy", name_fr="Italie", region="Europe", currency="EUR", lat=42.8, lng=12.6,
         gdp_bn=2373, growth_hist=[-9.0, 8.8, 4.7, 0.7, 0.7], inflation=1.0, debt=135, tour_x=8.5, tour_gdp=2.5, ca=1.1, pop=-0.1,
         regime="euro_member", commo=0.03, usd_debt=0.20, invoicing=0.25, deposits=0.02),
    dict(iso3="CAN", iso2="CA", name="Canada", name_fr="Canada", region="Amérique du Nord", currency="CAD", lat=56.1, lng=-106.3,
         gdp_bn=2241, growth_hist=[-5.0, 6.0, 4.2, 1.5, 1.5], inflation=2.4, debt=110, tour_x=4.0, tour_gdp=1.3, ca=-0.6, pop=2.0,
         regime="free_float", commo=0.45, usd_debt=0.65, invoicing=0.80, deposits=0.10),
    dict(iso3="BRA", iso2="BR", name="Brazil", name_fr="Brésil", region="Amérique latine", currency="BRL", lat=-10.8, lng=-52.9,
         gdp_bn=2171, growth_hist=[-3.3, 4.8, 3.0, 3.2, 3.4], inflation=4.4, debt=87, tour_x=2.0, tour_gdp=0.3, ca=-2.8, pop=0.4,
         regime="free_float", commo=0.60, usd_debt=0.70, invoicing=0.85, deposits=0.02),
    dict(iso3="RUS", iso2="RU", name="Russia", name_fr="Russie", region="Europe de l'Est", currency="RUB", lat=61.5, lng=96.0,
         gdp_bn=2161, growth_hist=[-2.7, 5.9, -1.2, 3.6, 4.3], inflation=8.4, debt=20, tour_x=1.5, tour_gdp=0.3, ca=2.9, pop=-0.2,
         regime="free_float", commo=0.65, usd_debt=0.35, invoicing=0.25, deposits=0.20),
    dict(iso3="MEX", iso2="MX", name="Mexico", name_fr="Mexique", region="Amérique latine", currency="MXN", lat=23.6, lng=-102.5,
         gdp_bn=1853, growth_hist=[-8.4, 6.0, 3.7, 3.3, 1.5], inflation=4.7, debt=58, tour_x=5.3, tour_gdp=1.8, ca=-0.3, pop=0.7,
         regime="free_float", commo=0.12, usd_debt=0.85, invoicing=0.90, deposits=0.08),
    dict(iso3="AUS", iso2="AU", name="Australia", name_fr="Australie", region="Océanie", currency="AUD", lat=-25.3, lng=133.8,
         gdp_bn=1802, growth_hist=[-0.1, 5.2, 4.1, 2.1, 1.0], inflation=3.2, debt=50, tour_x=10.0, tour_gdp=2.5, ca=-2.0, pop=2.0,
         regime="free_float", commo=0.65, usd_debt=0.60, invoicing=0.75, deposits=0.04),
    dict(iso3="KOR", iso2="KR", name="South Korea", name_fr="Corée du Sud", region="Asie de l'Est", currency="KRW", lat=36.5, lng=127.9,
         gdp_bn=1713, growth_hist=[-0.7, 4.3, 2.6, 1.4, 2.0], inflation=2.3, debt=52, tour_x=2.5, tour_gdp=1.0, ca=5.3, pop=0.1,
         regime="free_float", commo=0.06, usd_debt=0.60, invoicing=0.85, deposits=0.05),
    dict(iso3="ESP", iso2="ES", name="Spain", name_fr="Espagne", region="Europe", currency="EUR", lat=40.4, lng=-3.7,
         gdp_bn=1731, growth_hist=[-11.2, 6.7, 6.2, 2.7, 3.2], inflation=2.8, debt=102, tour_x=16.0, tour_gdp=5.5, ca=3.0, pop=1.0,
         regime="euro_member", commo=0.05, usd_debt=0.20, invoicing=0.25, deposits=0.02),
    dict(iso3="IDN", iso2="ID", name="Indonesia", name_fr="Indonésie", region="Asie du Sud-Est", currency="IDR", lat=-2.5, lng=118.0,
         gdp_bn=1396, growth_hist=[-2.1, 3.7, 5.3, 5.0, 5.0], inflation=2.3, debt=40, tour_x=5.0, tour_gdp=1.0, ca=-0.6, pop=1.1,
         regime="managed_usd", commo=0.55, usd_debt=0.75, invoicing=0.90, deposits=0.12),
    dict(iso3="NLD", iso2="NL", name="Netherlands", name_fr="Pays-Bas", region="Europe", currency="EUR", lat=52.1, lng=5.3,
         gdp_bn=1228, growth_hist=[-3.9, 6.2, 5.0, 0.1, 1.0], inflation=3.3, debt=45, tour_x=3.0, tour_gdp=2.8, ca=9.9, pop=0.6,
         regime="euro_member", commo=0.10, usd_debt=0.25, invoicing=0.30, deposits=0.02),
    dict(iso3="TUR", iso2="TR", name="Turkey", name_fr="Turquie", region="Moyen-Orient", currency="TRY", lat=39.0, lng=35.2,
         gdp_bn=1323, growth_hist=[1.9, 11.4, 5.5, 5.1, 3.2], inflation=58.5, debt=25, tour_x=16.0, tour_gdp=4.6, ca=-0.8, pop=0.3,
         regime="managed_usd", commo=0.08, usd_debt=0.60, invoicing=0.50, deposits=0.40),
    dict(iso3="SAU", iso2="SA", name="Saudi Arabia", name_fr="Arabie saoudite", region="Moyen-Orient", currency="SAR", lat=23.9, lng=45.1,
         gdp_bn=1100, growth_hist=[-3.6, 5.1, 7.5, -0.8, 1.3], inflation=1.7, debt=26, tour_x=10.0, tour_gdp=3.3, ca=-0.5, pop=2.0,
         regime="hard_peg", commo=0.80, usd_debt=0.90, invoicing=0.95, deposits=0.10),
    dict(iso3="CHE", iso2="CH", name="Switzerland", name_fr="Suisse", region="Europe", currency="CHF", lat=46.8, lng=8.2,
         gdp_bn=936, growth_hist=[-2.1, 5.4, 3.1, 0.7, 1.3], inflation=1.1, debt=38, tour_x=4.5, tour_gdp=2.2, ca=5.9, pop=0.9,
         regime="free_float", commo=0.10, usd_debt=0.25, invoicing=0.30, deposits=0.05),
    dict(iso3="POL", iso2="PL", name="Poland", name_fr="Pologne", region="Europe", currency="PLN", lat=51.9, lng=19.1,
         gdp_bn=862, growth_hist=[-2.0, 6.9, 5.3, 0.1, 2.9], inflation=3.7, debt=55, tour_x=6.0, tour_gdp=2.8, ca=0.2, pop=-0.1,
         regime="free_float", commo=0.06, usd_debt=0.25, invoicing=0.30, deposits=0.10),
    dict(iso3="TWN", iso2="TW", name="Taiwan", name_fr="Taïwan", region="Asie de l'Est", currency="TWD", lat=23.7, lng=121.0,
         gdp_bn=756, growth_hist=[3.4, 6.5, 2.6, 1.1, 4.6], inflation=2.2, debt=27, tour_x=1.5, tour_gdp=0.8, ca=13.8, pop=-0.1,
         regime="managed_usd", commo=0.03, usd_debt=0.90, invoicing=0.95, deposits=0.15),
    dict(iso3="BEL", iso2="BE", name="Belgium", name_fr="Belgique", region="Europe", currency="EUR", lat=50.5, lng=4.5,
         gdp_bn=662, growth_hist=[-5.3, 6.9, 4.2, 1.3, 1.0], inflation=4.3, debt=104, tour_x=2.5, tour_gdp=2.2, ca=-1.0, pop=0.6,
         regime="euro_member", commo=0.08, usd_debt=0.20, invoicing=0.30, deposits=0.02),
    dict(iso3="ARG", iso2="AR", name="Argentina", name_fr="Argentine", region="Amérique latine", currency="ARS", lat=-38.4, lng=-63.6,
         gdp_bn=633, growth_hist=[-9.9, 10.4, 5.3, -1.6, -1.7], inflation=219.9, debt=83, tour_x=6.0, tour_gdp=1.0, ca=1.0, pop=0.6,
         regime="managed_usd", commo=0.60, usd_debt=0.75, invoicing=0.90, deposits=0.35),
    dict(iso3="SWE", iso2="SE", name="Sweden", name_fr="Suède", region="Europe", currency="SEK", lat=60.1, lng=18.6,
         gdp_bn=610, growth_hist=[-2.0, 6.1, 1.6, -0.1, 1.0], inflation=2.8, debt=34, tour_x=4.5, tour_gdp=2.4, ca=7.0, pop=0.5,
         regime="free_float", commo=0.12, usd_debt=0.30, invoicing=0.30, deposits=0.03),
    dict(iso3="IRL", iso2="IE", name="Ireland", name_fr="Irlande", region="Europe", currency="EUR", lat=53.4, lng=-8.2,
         gdp_bn=577, growth_hist=[6.6, 16.3, 8.6, -5.5, 1.2], inflation=1.3, debt=41, tour_x=2.0, tour_gdp=1.6, ca=17.0, pop=1.5,
         regime="euro_member", commo=0.02, usd_debt=0.30, invoicing=0.45, deposits=0.03),
    dict(iso3="ISR", iso2="IL", name="Israel", name_fr="Israël", region="Moyen-Orient", currency="ILS", lat=31.0, lng=34.9,
         gdp_bn=540, growth_hist=[-1.5, 9.3, 6.5, 1.8, 0.9], inflation=3.1, debt=69, tour_x=3.0, tour_gdp=1.0, ca=4.5, pop=1.6,
         regime="free_float", commo=0.03, usd_debt=0.60, invoicing=0.70, deposits=0.08),
    dict(iso3="THA", iso2="TH", name="Thailand", name_fr="Thaïlande", region="Asie du Sud-Est", currency="THB", lat=15.9, lng=101.0,
         gdp_bn=527, growth_hist=[-6.1, 1.6, 2.5, 2.0, 2.5], inflation=0.4, debt=63, tour_x=12.5, tour_gdp=7.0, ca=2.1, pop=0.1,
         regime="managed_basket", commo=0.12, usd_debt=0.65, invoicing=0.80, deposits=0.03),
    dict(iso3="ARE", iso2="AE", name="United Arab Emirates", name_fr="Émirats arabes unis", region="Moyen-Orient", currency="AED", lat=23.4, lng=53.8,
         gdp_bn=537, growth_hist=[-5.0, 4.4, 7.5, 3.6, 3.8], inflation=2.3, debt=32, tour_x=9.0, tour_gdp=8.0, ca=9.1, pop=3.5,
         regime="hard_peg", commo=0.55, usd_debt=0.85, invoicing=0.90, deposits=0.20),
    dict(iso3="SGP", iso2="SG", name="Singapore", name_fr="Singapour", region="Asie du Sud-Est", currency="SGD", lat=1.35, lng=103.8,
         gdp_bn=547, growth_hist=[-3.8, 9.8, 4.1, 1.8, 4.4], inflation=2.4, debt=175, tour_x=4.5, tour_gdp=4.0, ca=17.5, pop=2.0,
         regime="managed_basket", commo=0.10, usd_debt=0.40, invoicing=0.60, deposits=0.30),
    dict(iso3="NOR", iso2="NO", name="Norway", name_fr="Norvège", region="Europe", currency="NOK", lat=60.5, lng=8.5,
         gdp_bn=483, growth_hist=[-1.3, 3.9, 3.2, 0.1, 2.1], inflation=3.1, debt=44, tour_x=3.0, tour_gdp=1.4, ca=16.0, pop=0.9,
         regime="free_float", commo=0.65, usd_debt=0.40, invoicing=0.55, deposits=0.03),
    dict(iso3="AUT", iso2="AT", name="Austria", name_fr="Autriche", region="Europe", currency="EUR", lat=47.5, lng=14.6,
         gdp_bn=522, growth_hist=[-6.3, 4.8, 5.3, -1.0, -1.0], inflation=2.9, debt=81, tour_x=10.5, tour_gdp=6.5, ca=2.3, pop=0.5,
         regime="euro_member", commo=0.03, usd_debt=0.15, invoicing=0.20, deposits=0.02),
    dict(iso3="PHL", iso2="PH", name="Philippines", name_fr="Philippines", region="Asie du Sud-Est", currency="PHP", lat=12.9, lng=121.8,
         gdp_bn=462, growth_hist=[-9.5, 5.7, 7.6, 5.5, 5.7], inflation=3.2, debt=61, tour_x=7.0, tour_gdp=1.8, ca=-3.8, pop=1.5,
         regime="managed_usd", commo=0.10, usd_debt=0.80, invoicing=0.90, deposits=0.20),
    dict(iso3="VNM", iso2="VN", name="Vietnam", name_fr="Viêt Nam", region="Asie du Sud-Est", currency="VND", lat=14.1, lng=108.3,
         gdp_bn=476, growth_hist=[2.9, 2.6, 8.1, 5.0, 7.1], inflation=3.6, debt=36, tour_x=6.0, tour_gdp=3.0, ca=6.1, pop=0.8,
         regime="managed_usd", commo=0.12, usd_debt=0.75, invoicing=0.90, deposits=0.08),
    dict(iso3="MYS", iso2="MY", name="Malaysia", name_fr="Malaisie", region="Asie du Sud-Est", currency="MYR", lat=4.2, lng=102.0,
         gdp_bn=422, growth_hist=[-5.5, 3.3, 8.9, 3.6, 5.1], inflation=1.8, debt=69, tour_x=6.5, tour_gdp=3.6, ca=1.5, pop=1.1,
         regime="managed_basket", commo=0.30, usd_debt=0.60, invoicing=0.80, deposits=0.05),
    dict(iso3="ZAF", iso2="ZA", name="South Africa", name_fr="Afrique du Sud", region="Afrique", currency="ZAR", lat=-30.6, lng=22.9,
         gdp_bn=401, growth_hist=[-6.2, 5.0, 2.0, 0.8, 0.6], inflation=4.4, debt=74, tour_x=4.5, tour_gdp=2.0, ca=-0.6, pop=1.0,
         regime="free_float", commo=0.50, usd_debt=0.60, invoicing=0.75, deposits=0.05),
    dict(iso3="EGY", iso2="EG", name="Egypt", name_fr="Égypte", region="Afrique", currency="EGP", lat=26.8, lng=30.8,
         gdp_bn=389, growth_hist=[3.6, 3.3, 6.6, 3.8, 2.4], inflation=28.3, debt=90, tour_x=25.0, tour_gdp=4.0, ca=-5.4, pop=1.5,
         regime="managed_usd", commo=0.35, usd_debt=0.80, invoicing=0.90, deposits=0.20),
    dict(iso3="NGA", iso2="NG", name="Nigeria", name_fr="Nigeria", region="Afrique", currency="NGN", lat=9.1, lng=8.7,
         gdp_bn=188, growth_hist=[-1.8, 3.6, 3.3, 2.9, 3.4], inflation=33.2, debt=52, tour_x=1.5, tour_gdp=0.1, ca=4.0, pop=2.4,
         regime="free_float", commo=0.90, usd_debt=0.85, invoicing=0.95, deposits=0.15),
    dict(iso3="CHL", iso2="CL", name="Chile", name_fr="Chili", region="Amérique latine", currency="CLP", lat=-35.7, lng=-71.5,
         gdp_bn=330, growth_hist=[-6.1, 11.3, 2.2, 0.5, 2.6], inflation=3.9, debt=41, tour_x=4.0, tour_gdp=1.2, ca=-1.5, pop=0.6,
         regime="free_float", commo=0.70, usd_debt=0.75, invoicing=0.85, deposits=0.10),
    dict(iso3="COL", iso2="CO", name="Colombia", name_fr="Colombie", region="Amérique latine", currency="COP", lat=4.6, lng=-74.3,
         gdp_bn=418, growth_hist=[-7.2, 10.8, 7.3, 0.7, 1.7], inflation=6.6, debt=62, tour_x=9.0, tour_gdp=2.5, ca=-1.8, pop=1.1,
         regime="free_float", commo=0.60, usd_debt=0.75, invoicing=0.90, deposits=0.05),
]

SEED_YEAR = 2024
SEED_BY_ISO = {s["iso3"]: s for s in SEED}

# ---------------------------------------------------------------------------
# Country universe: every World Bank economy (+ Taiwan via the IMF)
# ---------------------------------------------------------------------------

EXCLUDED = {"CHI"}  # Channel Islands: no ISO 3166 code, no flag, no IMF series
IMF_TO_WB = {"UVK": "XKX", "WBG": "PSE"}  # IMF WEO codes that differ from World Bank codes
EXTRA_ECONOMIES = [
    {"iso3": "TWN", "iso2": "TW", "name": "Taiwan", "region_id": "EAS", "income": "HIC", "capital": (25.03, 121.57)},
]

# World Bank long names -> names used for display fallback and news queries
NAME_FIX = {
    "Egypt, Arab Rep.": "Egypt", "Korea, Rep.": "South Korea", "Korea, Dem. People's Rep.": "North Korea",
    "Iran, Islamic Rep.": "Iran", "Venezuela, RB": "Venezuela", "Yemen, Rep.": "Yemen", "Gambia, The": "Gambia",
    "Bahamas, The": "Bahamas", "Congo, Dem. Rep.": "DR Congo", "Congo, Rep.": "Republic of the Congo",
    "Lao PDR": "Laos", "Micronesia, Fed. Sts.": "Micronesia", "Russian Federation": "Russia", "Turkiye": "Turkey",
    "Slovak Republic": "Slovakia", "Kyrgyz Republic": "Kyrgyzstan", "Syrian Arab Republic": "Syria",
    "Hong Kong SAR, China": "Hong Kong", "Macao SAR, China": "Macau", "Cote d'Ivoire": "Ivory Coast",
    "Viet Nam": "Vietnam", "St. Lucia": "Saint Lucia", "St. Kitts and Nevis": "Saint Kitts and Nevis",
    "St. Vincent and the Grenadines": "Saint Vincent and the Grenadines", "St. Martin (French part)": "Saint Martin",
    "West Bank and Gaza": "Palestine", "Brunei Darussalam": "Brunei", "Czechia": "Czech Republic",
    "Cabo Verde": "Cape Verde", "Somalia, Fed. Rep.": "Somalia", "Virgin Islands (U.S.)": "US Virgin Islands",
    "British Virgin Islands": "British Virgin Islands", "Timor-Leste": "East Timor", "Curacao": "Curacao",
}

# Ambiguous names get a disambiguated news query
NEWS_QUERY = {
    "GEO": '"Georgia" Tbilisi', "JOR": '"Jordan" Amman', "TCD": '"Chad" N\'Djamena', "GIN": '"Guinea" Conakry',
    "NER": '"Niger" Niamey', "DMA": '"Dominica" Roseau', "COG": '"Congo" Brazzaville', "COD": '"DR Congo" OR "Congo" Kinshasa',
    "TUR": '"Turkey" OR "Turkiye"', "CIV": '"Ivory Coast" OR "Cote d\'Ivoire"', "PSE": '"Palestinian" OR "Gaza" OR "West Bank"',
    "MAC": '"Macau" OR "Macao"', "TLS": '"Timor-Leste" OR "East Timor"', "CZE": '"Czech"', "GMB": '"Gambia" Banjul',
    "MCO": '"Monaco" principality', "JEY": '"Jersey" island', "GUM": '"Guam" island',
}

REGION_FR = {
    "EAS": "Asie de l'Est & Pacifique", "ECS": "Europe & Asie centrale", "LCN": "Amérique latine & Caraïbes",
    "MEA": "Moyen-Orient & Afrique du Nord", "NAC": "Amérique du Nord", "SAS": "Asie du Sud", "SSF": "Afrique subsaharienne",
}

# De facto exchange-rate regimes (IMF AREAER-style simplification). Anything not listed defaults to
# "managed_usd" (stabilised / crawl-like arrangement against the dollar), the most common EM/frontier case.
DOLLARIZED = {"ECU", "SLV", "PAN", "TLS", "FSM", "MHL", "PLW", "ZWE", "PRI", "TCA", "VGB", "VIR", "GUM", "ASM", "MNP", "BES"}
HARD_PEG_USD = {"SAU", "ARE", "QAT", "BHR", "OMN", "JOR", "BHS", "BRB", "BLZ", "DJI", "ERI", "HKG", "ABW", "CUW", "SXM",
                "ATG", "DMA", "GRD", "KNA", "LCA", "VCT", "TKM", "CUB", "BMU", "CYM", "MAC"}
EURO_AREA = {"AUT", "BEL", "HRV", "CYP", "EST", "FIN", "FRA", "DEU", "GRC", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD",
             "PRT", "SVK", "SVN", "ESP", "BGR", "MNE", "XKX", "AND", "MCO", "SMR"}
EURO_PEG = {"BEN", "BFA", "CIV", "GNB", "MLI", "NER", "SEN", "TGO", "CMR", "CAF", "TCD", "COG", "GNQ", "GAB",
            "DNK", "BIH", "CPV", "COM", "STP", "MKD", "PYF", "NCL", "MAF", "FRO", "GRL"}
MANAGED_BASKET = {"CHN", "SGP", "THA", "MYS", "KWT", "MAR", "TUN", "FJI", "ROU", "SRB", "BWA", "LBY", "WSM", "VUT", "TON",
                  "SLB", "MUS", "NPL", "BTN", "LSO", "SWZ", "NAM", "IMN", "GIB", "BRN"}
FREE_FLOAT = {"AUS", "CAN", "CHE", "CZE", "GBR", "HUN", "ISL", "ISR", "JPN", "KOR", "NOR", "NZL", "POL", "SWE", "BRA",
              "CHL", "COL", "MEX", "PER", "URY", "ZAF", "RUS", "GHA", "KAZ", "UGA", "ZMB", "MOZ", "AGO", "MDA", "GEO",
              "ARM", "ALB", "NGA", "KEN", "MDG", "SOM", "PRY", "DOM", "GTM", "CRI", "JAM", "PHL", "IND", "IDN", "SYC"}

# Known deposit dollarization (share of FX deposits), otherwise a regime-based default is used.
USD_DEPOSITS = {
    "KHM": 0.80, "LBR": 0.70, "LAO": 0.50, "GEO": 0.50, "ARM": 0.40, "MDA": 0.40, "AZE": 0.45, "KGZ": 0.40, "TJK": 0.40,
    "BOL": 0.20, "PER": 0.25, "URY": 0.55, "NIC": 0.60, "HND": 0.30, "PRY": 0.40, "COD": 0.90, "AGO": 0.40, "LBN": 0.80,
    "MNG": 0.30, "BLR": 0.40, "UKR": 0.30, "ALB": 0.50, "SSD": 0.50, "SOM": 0.90, "HTI": 0.40, "SDN": 0.40, "YEM": 0.40,
    "VEN": 0.60, "UZB": 0.30, "TZA": 0.30, "SLE": 0.35, "MWI": 0.15, "ZMB": 0.30, "GHA": 0.30, "MOZ": 0.30,
}

ESTIMATE_LABEL = "Estimation (médiane régionale)"


def regime_for(iso3: str) -> str:
    seed = SEED_BY_ISO.get(iso3)
    if seed:
        return seed["regime"]
    for regime, members in (("dollarized", DOLLARIZED), ("hard_peg", HARD_PEG_USD), ("euro_member", EURO_AREA),
                            ("euro_peg", EURO_PEG), ("managed_basket", MANAGED_BASKET), ("free_float", FREE_FLOAT)):
        if iso3 in members:
            return regime
    return "managed_usd"


def usd_profile(iso3: str, region_id: str, income: str, commo: float) -> tuple[dict[str, Any], list[str]]:
    """USD exposure inputs. Seeds carry researched values; other countries use transparent proxies."""
    seed = SEED_BY_ISO.get(iso3)
    regime = regime_for(iso3)
    if seed:
        return {"regime": regime, "commo": commo, "usd_debt": seed["usd_debt"], "invoicing": seed["invoicing"],
                "deposits": seed["deposits"]}, []

    usd_debt = {"dollarized": 1.0, "hard_peg": 0.9, "euro_member": 0.15, "euro_peg": 0.3}.get(
        regime, 0.35 if income == "HIC" else 0.65)
    if regime == "free_float":
        invoicing = {"LCN": 0.85, "NAC": 0.85, "ECS": 0.4}.get(region_id, 0.7)
    else:
        invoicing = {"dollarized": 1.0, "hard_peg": 0.95, "managed_usd": 0.85, "managed_basket": 0.7,
                     "euro_member": 0.25, "euro_peg": 0.45}[regime]
    deposits = USD_DEPOSITS.get(iso3, {"dollarized": 1.0, "hard_peg": 0.15, "managed_usd": 0.15, "managed_basket": 0.08,
                                       "free_float": 0.06, "euro_member": 0.02, "euro_peg": 0.04}[regime])
    estimated = ["Dette externe en USD", "Facturation en USD"] + ([] if iso3 in USD_DEPOSITS else ["Dépôts en USD"])
    return {"regime": regime, "commo": commo, "usd_debt": usd_debt, "invoicing": invoicing, "deposits": deposits}, estimated


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    print(f"[macroglobe] {msg}", flush=True)


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def r1(x: float) -> float:
    return round(float(x), 1)


def r2(x: float) -> float:
    return round(float(x), 2)


def http_get(url: str, **kwargs: Any) -> "requests.Response":
    if requests is None:
        raise RuntimeError("requests is not installed")
    headers = {"User-Agent": USER_AGENT, **kwargs.pop("headers", {})}
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=headers, timeout=HTTP_TIMEOUT, **kwargs)
            if resp.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            resp.raise_for_status()
            return resp
        except Exception as exc:  # noqa: BLE001 - network errors are all handled the same way
            last_exc = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"GET failed after retries: {url} ({last_exc})")


# ---------------------------------------------------------------------------
# World Bank
# ---------------------------------------------------------------------------

Series = list[tuple[int, float]]  # (year, value), newest first


def fetch_wb_countries() -> dict[str, dict[str, Any]]:
    """All World Bank economies (aggregates excluded) + extra economies covered by the IMF."""
    payload = http_get("https://api.worldbank.org/v2/country?format=json&per_page=400").json()
    out: dict[str, dict[str, Any]] = {}
    for c in payload[1]:
        iso3 = c["id"]
        if c["region"]["id"] == "NA" or iso3 in EXCLUDED or not c.get("iso2Code"):
            continue
        try:
            capital = (float(c["latitude"]), float(c["longitude"]))
        except (TypeError, ValueError):
            capital = None
        name = c["name"].strip()
        out[iso3] = {"iso3": iso3, "iso2": c["iso2Code"], "name": NAME_FIX.get(name, name),
                     "region_id": c["region"]["id"], "income": c["incomeLevel"]["id"], "capital": capital}
    for extra in EXTRA_ECONOMIES:
        out.setdefault(extra["iso3"], dict(extra))
    log(f"World Bank country list -> {len(out)} economies")
    return out


def fetch_world_bank() -> dict[str, dict[str, Series]]:
    """Return {iso3: {field: [(year, value), ...] newest first}} for every indicator, all economies."""
    current_year = datetime.now(timezone.utc).year
    start = current_year - 12
    out: dict[str, dict[str, Series]] = {}
    for indicator, (fld, _max_age) in WB_INDICATORS.items():
        url = (f"https://api.worldbank.org/v2/country/all/indicator/{indicator}"
               f"?format=json&date={start}:{current_year}&per_page=20000")
        try:
            payload = http_get(url).json()
            if not isinstance(payload, list) or len(payload) < 2 or payload[1] is None:
                raise ValueError(f"unexpected payload: {str(payload)[:160]}")
            n = 0
            for row in payload[1]:
                iso, val = row.get("countryiso3code"), row.get("value")
                if iso and val is not None:
                    out.setdefault(iso, {}).setdefault(fld, []).append((int(row["date"]), float(val)))
                    n += 1
            log(f"World Bank {indicator:<20} -> {n} observations")
        except Exception as exc:  # noqa: BLE001
            log(f"World Bank {indicator} FAILED ({exc})")
    for fields in out.values():
        for series in fields.values():
            series.sort(key=lambda t: t[0], reverse=True)
    return out


# ---------------------------------------------------------------------------
# IMF World Economic Outlook (via DBnomics, the IMF API itself blocks bots)
# ---------------------------------------------------------------------------

IMF_SUBJECTS = {
    "NGDPD": "gdp_usd", "NGDP_RPCH": "gdp_growth", "PCPIPCH": "inflation",
    "GGXWDG_NGDP": "debt_gdp", "BCA_NGDPD": "current_account", "LP": "population",
}
DBNOMICS = "https://api.db.nomics.world/v22"


def fetch_imf_weo() -> tuple[dict[str, dict[str, Series]], str | None]:
    codes: list[str] = []
    offset = 0
    while True:
        page = http_get(f"{DBNOMICS}/datasets/IMF?limit=500&offset={offset}").json()["datasets"]
        codes += [d["code"] for d in page["docs"]]
        offset += 500
        if offset >= page["num_found"]:
            break
    vintages = sorted(c for c in codes if re.fullmatch(r"WEO:\d{4}-\d{2}", c))
    if not vintages:
        raise RuntimeError("no WEO dataset on DBnomics")
    vintage = vintages[-1]
    last_year = datetime.now(timezone.utc).year - 1  # later years are pure forecasts

    out: dict[str, dict[str, Series]] = {}
    for subject, fld in IMF_SUBJECTS.items():
        try:
            resp = http_get(f"{DBNOMICS}/series/IMF/{vintage}",
                            params={"dimensions": json.dumps({"weo-subject": [subject]}), "observations": "1", "limit": "1000"})
            docs = resp.json()["series"]["docs"]
        except Exception as exc:  # noqa: BLE001
            log(f"IMF WEO {subject} FAILED ({exc})")
            continue
        for s in docs:
            iso = s["series_code"].split(".")[0]
            iso = IMF_TO_WB.get(iso, iso)
            pts = []
            for period, value in zip(s.get("period", []), s.get("value", [])):
                if value in ("NA", None) or not str(period)[:4].isdigit():
                    continue
                year = int(str(period)[:4])
                if year <= last_year:
                    pts.append((year, float(value) * (1e9 if fld == "gdp_usd" else 1.0)))
            if pts:
                out.setdefault(iso, {})[fld] = sorted(pts, reverse=True)
        log(f"IMF WEO {subject:<12} -> {len(docs)} series ({vintage})")

    for fields in out.values():
        pop = dict(fields.pop("population", []))
        growth = [(y, (pop[y] / pop[y - 1] - 1.0) * 100.0) for y in pop if pop.get(y - 1)]
        if growth:
            fields["pop_growth"] = sorted(growth, reverse=True)
    return out, vintage


def pick_fresh(series: Series | None, max_age: int) -> tuple[int, float] | None:
    if not series:
        return None
    year, value = series[0]
    if year < datetime.now(timezone.utc).year - max_age:
        return None
    return year, value


def choose(fld: str, wb: dict[str, Series], imf: dict[str, Series], max_age: int,
           prefer_imf: bool = False) -> tuple[float, str, int] | None:
    """Most recent fresh value between the World Bank and the IMF (ties -> World Bank, unless prefer_imf)."""
    w = pick_fresh(wb.get(fld), max_age)
    i = pick_fresh(imf.get(fld), max_age)
    if prefer_imf and i:
        return i[1], f"FMI WEO {i[0]}", i[0]
    candidates = [(c, label) for c, label in ((w, "World Bank"), (i, "FMI WEO")) if c]
    if not candidates:
        return None
    (year, value), label = max(candidates, key=lambda t: t[0][0])  # max keeps the first on ties (World Bank)
    return value, f"{label} {year}", year


def pick_tourism(series: Series | None) -> tuple[int, float, str] | None:
    """Tourism series stop around 2020 (Covid year): use a recent year if any, else the last pre-Covid year."""
    if not series:
        return None
    now_year = datetime.now(timezone.utc).year
    for year, value in series:
        if year >= now_year - 4:
            return year, value, f"World Bank {year}"
    for year, value in series:
        if 2016 <= year <= 2019:
            return year, value, f"World Bank {year} (pré-Covid)"
    return None


def load_geo_centroids() -> dict[str, tuple[float, float]]:
    """Area-weighted centroid of each country's largest polygon (better camera target than the capital)."""
    path = ROOT / "public" / "data" / "countries.geojson"
    try:
        features = json.loads(path.read_text(encoding="utf-8"))["features"]
    except Exception:  # noqa: BLE001
        return {}
    out: dict[str, tuple[float, float]] = {}
    for f in features:
        geom = f["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        best: tuple[float, float, float] | None = None
        for poly in polys:
            ring = poly[0]
            a = cx = cy = 0.0
            for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
                cross = x1 * y2 - x2 * y1
                a += cross
                cx += (x1 + x2) * cross
                cy += (y1 + y2) * cross
            if abs(a) < 1e-9:
                continue
            area = abs(a) / 2.0
            if best is None or area > best[0]:
                best = (area, cy / (3.0 * a), cx / (3.0 * a))
        if best:
            out[f["properties"]["ISO_A3"]] = (round(best[1], 2), round(best[2], 2))
    return out


# ---------------------------------------------------------------------------
# News sentiment (Google News RSS -> GDELT -> cache -> neutral)
# ---------------------------------------------------------------------------

@dataclass
class NewsResult:
    compound: float
    n_articles: int
    source: str
    headlines: list[dict[str, Any]] = field(default_factory=list)


def build_analyzer() -> Any:
    if SentimentIntensityAnalyzer is None:
        return None
    analyzer = SentimentIntensityAnalyzer()
    analyzer.lexicon.update(FINANCE_LEXICON)
    return analyzer


def clean_title(title: str) -> str:
    title = re.sub(r"\s+-\s+[^-]{2,60}$", "", title.strip())  # strip " - Publisher" suffix
    return re.sub(r"\s+", " ", title)


def score_titles(analyzer: Any, items: list[dict[str, str]], source: str) -> NewsResult | None:
    seen: set[str] = set()
    scored: list[dict[str, Any]] = []
    for it in items:
        title = clean_title(it.get("title", ""))
        key = title.lower()
        if len(title) < 15 or key in seen:
            continue
        seen.add(key)
        compound = analyzer.polarity_scores(title)["compound"]
        scored.append({"title": title, "url": it.get("url", ""), "source": it.get("source", ""), "compound": r2(compound)})
        if len(scored) >= 40:
            break
    if len(scored) < 3:
        return None
    mean = sum(h["compound"] for h in scored) / len(scored)
    top = sorted(scored, key=lambda h: abs(h["compound"]), reverse=True)[:6]
    return NewsResult(compound=mean, n_articles=len(scored), source=source, headlines=top)


def news_query(iso3: str, name: str) -> str:
    return NEWS_QUERY.get(iso3, f'"{name}"')


def fetch_google_news(query: str) -> list[dict[str, str]]:
    if feedparser is None:
        raise RuntimeError("feedparser is not installed")
    q = f"{query} {ECON_QUERY} when:2d"
    url = f"https://news.google.com/rss/search?q={quote(q)}&hl=en-US&gl=US&ceid=US:en"
    feed = feedparser.parse(http_get(url).content)
    items = []
    for e in feed.entries[:60]:
        src = ""
        if getattr(e, "source", None) is not None:
            src = getattr(e.source, "title", "") or ""
        items.append({"title": e.get("title", ""), "url": e.get("link", ""), "source": src})
    return items


def fetch_gdelt(query: str) -> list[dict[str, str]]:
    q = f"{query} {ECON_QUERY} sourcelang:english"
    url = ("https://api.gdeltproject.org/api/v2/doc/doc"
           f"?query={quote(q)}&mode=artlist&maxrecords=60&format=json&timespan=2d&sort=datedesc")
    try:
        data = http_get(url).json()
    except ValueError:
        return []
    return [{"title": a.get("title", ""), "url": a.get("url", ""), "source": a.get("domain", "")}
            for a in data.get("articles", [])]


GDELT_BUDGET_SECONDS = 240


def fetch_news_sentiment(countries: list[dict[str, Any]]) -> dict[str, NewsResult]:
    analyzer = build_analyzer()
    if analyzer is None or requests is None:
        log("News: vaderSentiment/requests unavailable, skipping")
        return {}

    def google_task(c: dict[str, Any]) -> tuple[str, NewsResult | None]:
        try:
            time.sleep(0.2)
            return c["iso3"], score_titles(analyzer, fetch_google_news(news_query(c["iso3"], c["name"])), "Google News RSS")
        except Exception as exc:  # noqa: BLE001
            log(f"Google News {c['iso3']} failed: {exc}")
            return c["iso3"], None

    results: dict[str, NewsResult] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for iso, res in pool.map(google_task, countries):
            if res is not None:
                results[iso] = res

    # GDELT asks for one request every 5 s: only retry the largest economies without news, within a time budget.
    missing = sorted((c for c in countries if c["iso3"] not in results), key=lambda c: -c.get("gdp", 0))
    deadline = time.monotonic() + GDELT_BUDGET_SECONDS
    tried = 0
    for c in missing:
        if time.monotonic() > deadline:
            break
        tried += 1
        try:
            res = score_titles(analyzer, fetch_gdelt(news_query(c["iso3"], c["name"])), "GDELT DOC API")
            if res is not None:
                results[c["iso3"]] = res
        except Exception as exc:  # noqa: BLE001
            log(f"GDELT {c['iso3']} failed: {exc}")
        time.sleep(5.5)
    log(f"News: live sentiment for {len(results)}/{len(countries)} countries (GDELT retries: {tried})")
    return results


# ---------------------------------------------------------------------------
# Scoring models
# ---------------------------------------------------------------------------

def growth_score(growth: float, ma5: float) -> float:
    blended = 0.6 * growth + 0.4 * ma5
    return clamp((blended + 2.0) / 9.0 * 100.0)  # -2 % -> 0, +2.5 % -> 50, +7 % -> 100


def inflation_score(inflation: float) -> float:
    dist = abs(inflation - 2.0) * (1.5 if inflation < 0 else 1.0)  # deflation is penalised harder
    return clamp(100.0 * math.exp(-dist / 6.0))


def debt_score(debt: float) -> float:
    return clamp(100.0 / (1.0 + math.exp((debt - 90.0) / 25.0)))  # 90 % of GDP -> 50


def current_account_score(ca: float) -> float:
    return clamp(50.0 + ca * 7.0)


def sentiment_score(compound: float) -> float:
    return clamp(50.0 + compound * 100.0)  # headline means rarely exceed +/-0.35


def confidence_label(score: float) -> str:
    if score < 40:
        return "Pessimiste"
    if score > 60:
        return "Optimiste"
    return "Neutre"


def compute_confidence(ind: dict[str, Any], sent_compound: float) -> dict[str, Any]:
    s_growth = growth_score(ind["gdp_growth"], ind["growth_5y_avg"])
    s_infl = inflation_score(ind["inflation"])
    s_debt = debt_score(ind["debt_gdp"])
    s_ca = current_account_score(ind["current_account"])
    s_sent = sentiment_score(sent_compound)

    macro = MACRO_SUBWEIGHTS["growth"] * s_growth + MACRO_SUBWEIGHTS["inflation"] * s_infl
    fiscal = FISCAL_SUBWEIGHTS["debt"] * s_debt + FISCAL_SUBWEIGHTS["current_account"] * s_ca
    score = (
        CONFIDENCE_WEIGHTS["macro"] * macro
        + CONFIDENCE_WEIGHTS["fiscal"] * fiscal
        + CONFIDENCE_WEIGHTS["sentiment"] * s_sent
    )

    # Exact additive decomposition: score = 50 + sum(weight_i * (subscore_i - 50))
    w = CONFIDENCE_WEIGHTS
    factors = [
        ("Croissance du PIB", w["macro"] * MACRO_SUBWEIGHTS["growth"], s_growth,
         f"{ind['gdp_growth']:+.1f} % (moy. 5 ans {ind['growth_5y_avg']:+.1f} %)"),
        ("Maîtrise de l'inflation", w["macro"] * MACRO_SUBWEIGHTS["inflation"], s_infl,
         f"{ind['inflation']:.1f} % (cible 2 %)"),
        ("Viabilité de la dette", w["fiscal"] * FISCAL_SUBWEIGHTS["debt"], s_debt,
         f"{ind['debt_gdp']:.0f} % du PIB"),
        ("Balance courante", w["fiscal"] * FISCAL_SUBWEIGHTS["current_account"], s_ca,
         f"{ind['current_account']:+.1f} % du PIB"),
        ("Sentiment de l'actualité", w["sentiment"], s_sent,
         f"VADER moyen {sent_compound:+.2f}"),
    ]
    factor_rows = [
        {"label": label, "weight": r2(weight), "subscore": r1(sub), "impact": r1(weight * (sub - 50.0)), "detail": detail}
        for label, weight, sub, detail in factors
    ]
    factor_rows.sort(key=lambda f: f["impact"], reverse=True)

    return {
        "score": r1(score),
        "label": confidence_label(score),
        "components": {"macro": r1(macro), "fiscal": r1(fiscal), "sentiment": r1(s_sent)},
        "subscores": {"growth": r1(s_growth), "inflation": r1(s_infl), "debt": r1(s_debt),
                      "current_account": r1(s_ca), "sentiment": r1(s_sent)},
        "factors": factor_rows,
    }


def compute_usd_dependence(seed: dict[str, Any], ind: dict[str, Any]) -> dict[str, Any]:
    regime = seed["regime"]
    comps = {
        "regime": USD_WEIGHTS["regime"] * REGIME_POINTS[regime],
        "commodities": USD_WEIGHTS["commodities"] * seed["commo"],
        "external_debt": USD_WEIGHTS["external_debt"] * seed["usd_debt"],
        "invoicing": USD_WEIGHTS["invoicing"] * seed["invoicing"],
        "deposits": USD_WEIGHTS["deposits"] * seed["deposits"],
    }
    # A structural current-account deficit increases the need for USD funding.
    if ind["current_account"] < -2.0 and regime != "issuer":
        comps["external_debt"] = min(USD_WEIGHTS["external_debt"], comps["external_debt"] * 1.15)
    score = sum(comps.values())

    tags: list[str] = []
    if regime == "issuer":
        tags.append("Émetteur de la devise de réserve")
    if regime == "dollarized" or seed["deposits"] >= 0.25:
        tags.append("Dollarisation" if regime == "dollarized" else "Dollarisation partielle des dépôts")
    if regime in ("hard_peg", "managed_usd"):
        tags.append("Monnaie ancrée / pilotée vs USD")
    if regime in ("euro_peg", "euro_member"):
        tags.append("Ancrage euro (exposition USD réduite)")
    if seed["usd_debt"] >= 0.6 and regime != "issuer":
        tags.append("Dette externe libellée en USD")
    if seed["commo"] >= 0.45:
        tags.append("Pétrodollar / Matières premières" if seed["commo"] >= 0.55 else "Exportations de matières premières")
    if not tags:
        tags.append("Exposition modérée")

    return {
        "score": r1(score),
        "regime": regime,
        "regime_label": REGIME_LABELS[regime],
        "tags": tags,
        "components": {k: r1(v) for k, v in comps.items()},
        "inputs": {"commodity_export_share": r2(seed["commo"]), "usd_external_debt_share": seed["usd_debt"],
                   "usd_invoicing_share": seed["invoicing"], "fx_deposit_share": seed["deposits"]},
    }


def compute_projection(ind: dict[str, Any], confidence: float, sent_compound: float, base_year: int) -> dict[str, Any]:
    """'Continuité actuelle' scenario: no policy change, mechanical convergence of every driver."""
    p = PROJECTION
    winsorized = [clamp(v, -4.0, 10.0) for v in ind["growth_history_values"]] or [ind["gdp_growth"]]
    ma5 = sum(winsorized) / len(winsorized)
    long_run = clamp(1.0 + 0.7 * ind["pop_growth"] + 0.25 * max(0.0, ma5 - 2.0), -1.0, 6.0)
    debt_drag = -min(1.0, 0.012 * max(0.0, ind["debt_gdp"] - 90.0))
    conf_adj = (confidence - 50.0) / 50.0 * 0.4

    gdp = ind["gdp_usd"]
    debt = ind["debt_gdp"]
    series = []
    for t in range(0, p["horizon_years"] + 1):
        if t == 0:
            g = ind["gdp_growth"]
        else:
            trend = long_run + (ma5 - long_run) * math.exp(-t / p["growth_half_life"])
            g = trend + debt_drag + conf_adj * math.exp(-t / p["confidence_fade"])
            gdp *= 1.0 + g / 100.0
            debt = debt * (1.0 + p["real_interest_rate"] / 100.0) / (1.0 + g / 100.0)

        infl_t = 2.0 + (ind["inflation"] - 2.0) * math.exp(-t / p["inflation_fade"])
        ca_t = ind["current_account"] * math.exp(-t / p["current_account_fade"])
        sent_t = sent_compound * math.exp(-t / p["sentiment_fade"])
        ma_t = ma5 if t == 0 else g
        macro = MACRO_SUBWEIGHTS["growth"] * growth_score(g if t else ind["gdp_growth"], ma_t) \
            + MACRO_SUBWEIGHTS["inflation"] * inflation_score(infl_t)
        fiscal = FISCAL_SUBWEIGHTS["debt"] * debt_score(debt) + FISCAL_SUBWEIGHTS["current_account"] * current_account_score(ca_t)
        stability = (CONFIDENCE_WEIGHTS["macro"] * macro + CONFIDENCE_WEIGHTS["fiscal"] * fiscal
                     + CONFIDENCE_WEIGHTS["sentiment"] * sentiment_score(sent_t))
        if t == 0:
            stability = confidence
        series.append({"year": base_year + t, "gdp": round(gdp / 1e9, 1), "growth": r2(g), "debt": r1(debt), "stability": r1(stability)})

    def at(t: int) -> dict[str, Any]:
        return series[t]

    def cagr(t: int) -> float:
        return ((series[t]["gdp"] / series[0]["gdp"]) ** (1.0 / t) - 1.0) * 100.0

    return {
        "scenario": "Continuité actuelle",
        "base_year": base_year,
        "unit": "USD constants de l'année de base (milliards)",
        "assumptions": {"growth_ma5": r2(ma5), "long_run_growth": r2(long_run), "debt_drag": r2(debt_drag),
                        "confidence_adjustment": r2(conf_adj), "real_interest_rate": p["real_interest_rate"]},
        "cagr_10": r2(cagr(10)), "cagr_25": r2(cagr(25)),
        "gdp_10": at(10)["gdp"], "gdp_25": at(25)["gdp"],
        "stability_10": at(10)["stability"], "stability_25": at(25)["stability"],
        "debt_10": at(10)["debt"], "debt_25": at(25)["debt"],
        "series": series,
    }


# ---------------------------------------------------------------------------
# Assembly
# ---------------------------------------------------------------------------

IMPUTABLE = ["inflation", "debt_gdp", "current_account", "pop_growth", "tourism_exports_pct", "tourism_gdp_pct", "commo"]
STALE_MAX_AGE = 6
CORE_FIELDS = ["gdp_usd", "gdp_growth", "inflation", "debt_gdp", "current_account", "pop_growth", "tourism_exports_pct"]
FIELD_LABELS = {
    "inflation": "Inflation", "debt_gdp": "Dette / PIB", "current_account": "Balance courante",
    "pop_growth": "Démographie", "tourism_exports_pct": "Tourisme (% export.)", "tourism_gdp_pct": "Tourisme (% PIB)",
    "commo": "Part des matières premières",
}


def gather_indicators(iso3: str, wb: dict[str, Series], imf: dict[str, Series]) -> tuple[dict[str, Any], dict[str, str], int] | None:
    """Merge World Bank, IMF and seed values. Returns None when GDP or growth is unavailable."""
    seed = SEED_BY_ISO.get(iso3)
    ages = {fld: age for fld, age in WB_INDICATORS.values()}
    ind: dict[str, Any] = {}
    sources: dict[str, str] = {}
    years: dict[str, int] = {}

    def take(fld: str, seed_value: float | None, prefer_imf: bool = False, max_age: int | None = None) -> None:
        got = choose(fld, wb, imf, max_age or ages.get(fld, 4), prefer_imf)
        if got:
            ind[fld], sources[fld], years[fld] = got
        elif seed_value is not None:
            ind[fld], sources[fld], years[fld] = seed_value, f"Référence {SEED_YEAR}", SEED_YEAR
        else:
            ind[fld] = None

    take("gdp_usd", seed["gdp_bn"] * 1e9 if seed else None)
    take("gdp_growth", seed["growth_hist"][-1] if seed else None)
    if ind["gdp_usd"] is None or ind["gdp_growth"] is None:
        # Countries with interrupted statistics (e.g. Cuba, Syria): accept older data, dated in the UI.
        take("gdp_usd", None, max_age=STALE_MAX_AGE)
        take("gdp_growth", None, max_age=STALE_MAX_AGE)
        if ind["gdp_usd"] is None or ind["gdp_growth"] is None:
            return None
        ages = {fld: max(age, STALE_MAX_AGE) for fld, age in ages.items()}
    take("inflation", seed["inflation"] if seed else None)
    take("debt_gdp", seed["debt"] if seed else None, prefer_imf=True)  # IMF = general government, comparable
    take("current_account", seed["ca"] if seed else None)
    take("pop_growth", seed["pop"] if seed else None)

    tour = pick_tourism(wb.get("tourism_exports_pct"))
    if tour:
        ind["tourism_exports_pct"], sources["tourism_exports_pct"] = tour[1], tour[2]
    elif seed:
        ind["tourism_exports_pct"], sources["tourism_exports_pct"] = seed["tour_x"], f"Référence {SEED_YEAR}"
    else:
        ind["tourism_exports_pct"] = None

    receipts = pick_tourism(wb.get("tourism_receipts_usd"))
    gdp_same_year = dict(wb.get("gdp_usd", [])).get(receipts[0]) if receipts else None
    if receipts and gdp_same_year:
        ind["tourism_gdp_pct"], sources["tourism_gdp_pct"] = receipts[1] / gdp_same_year * 100.0, receipts[2]
    elif seed:
        ind["tourism_gdp_pct"], sources["tourism_gdp_pct"] = seed["tour_gdp"], f"Référence {SEED_YEAR}"
    else:
        ind["tourism_gdp_pct"] = None

    # Share of merchandise exports in USD-priced commodities (fuels & metals fully, food & agri half).
    parts = {k: pick_fresh(wb.get(k), 5) for k in ("x_fuel", "x_metals", "x_food", "x_agri")}
    if parts["x_fuel"] or parts["x_metals"]:
        v = {k: (p[1] if p else 0.0) for k, p in parts.items()}
        ind["commo"] = min(1.0, (v["x_fuel"] + v["x_metals"] + 0.5 * (v["x_food"] + v["x_agri"])) / 100.0)
        sources["commo"] = f"World Bank {max(p[0] for p in parts.values() if p)}"
    elif seed:
        ind["commo"], sources["commo"] = seed["commo"], f"Référence {SEED_YEAR}"
    else:
        ind["commo"] = None

    last_year = datetime.now(timezone.utc).year - 1
    merged = {y: v for y, v in imf.get("gdp_growth", []) if y <= last_year}
    merged.update({y: v for y, v in wb.get("gdp_growth", []) if y <= last_year})
    hist = sorted(merged.items())[-5:]
    if len(hist) >= 3 and hist[-1][0] >= last_year - 3:
        sources["growth_history"] = f"WB/FMI {hist[0][0]}-{hist[-1][0]}"
    elif seed:
        start = SEED_YEAR - len(seed["growth_hist"]) + 1
        hist = [(start + i, v) for i, v in enumerate(seed["growth_hist"])]
        sources["growth_history"] = f"Référence {start}-{SEED_YEAR}"
    else:
        hist = [(years["gdp_growth"], ind["gdp_growth"])]
        sources["growth_history"] = sources["gdp_growth"]
    ind["growth_history"] = [{"year": y, "value": r2(v)} for y, v in hist]
    ind["growth_history_values"] = [v for _, v in hist]
    ind["growth_5y_avg"] = sum(ind["growth_history_values"]) / len(hist)
    return ind, sources, years["gdp_usd"]


def impute(rows: list[dict[str, Any]]) -> None:
    """Fill missing values with the regional median (world median if the region has no data)."""
    for fld in IMPUTABLE:
        world = [r["ind"][fld] for r in rows if r["ind"][fld] is not None]
        regional: dict[str, list[float]] = {}
        for r in rows:
            if r["ind"][fld] is not None:
                regional.setdefault(r["meta"]["region_id"], []).append(r["ind"][fld])
        for r in rows:
            if r["ind"][fld] is None:
                pool = regional.get(r["meta"]["region_id"]) or world or [0.0]
                r["ind"][fld] = statistics.median(pool)
                r["sources"][fld] = ESTIMATE_LABEL
                r["estimated"].append(FIELD_LABELS[fld])


def load_previous(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {c["iso3"]: c for c in data.get("countries", [])}
    except Exception:  # noqa: BLE001 - missing or corrupt file simply means no cache
        return {}


def resolve_sentiment(iso3: str, live: NewsResult | None, previous: dict[str, Any], today: str) -> dict[str, Any]:
    prev = previous.get(iso3, {}).get("sentiment", {})
    history = [h for h in prev.get("history", []) if h.get("date") != today]

    if live is not None:
        sent = {"compound": r2(live.compound), "n_articles": live.n_articles, "source": live.source,
                "headlines": live.headlines, "as_of": today, "status": "live"}
    elif prev and prev.get("as_of") and prev.get("status") in ("live", "cache"):
        age = (datetime.fromisoformat(today) - datetime.fromisoformat(prev["as_of"])).days
        if age <= 7:
            sent = {**prev, "status": "cache"}
        else:
            sent = {"compound": 0.0, "n_articles": 0, "source": "Neutre (cache expiré)", "headlines": [],
                    "as_of": today, "status": "neutral"}
    else:
        sent = {"compound": 0.0, "n_articles": 0, "source": "Neutre (aucune donnée d'actualité)", "headlines": [],
                "as_of": today, "status": "neutral"}

    sent["score"] = r1(sentiment_score(sent["compound"]))
    if sent["status"] == "live":
        history.append({"date": today, "score": sent["score"]})
    sent["history"] = sorted(history, key=lambda h: h["date"])[-60:]
    return sent


def finalize(row: dict[str, Any], sentiment: dict[str, Any], centroids: dict[str, tuple[float, float]]) -> dict[str, Any]:
    meta, ind, sources = row["meta"], row["ind"], row["sources"]
    iso3 = meta["iso3"]
    seed = SEED_BY_ISO.get(iso3)

    confidence = compute_confidence(ind, sentiment["compound"])
    profile, usd_proxies = usd_profile(iso3, meta["region_id"] or "", meta["income"] or "", ind["commo"])
    usd = compute_usd_dependence(profile, ind)
    projection = compute_projection(ind, confidence["score"], sentiment["compound"], row["base_year"])

    if seed:
        lat, lng = seed["lat"], seed["lng"]
    elif iso3 in centroids:
        lat, lng = centroids[iso3]
    elif meta.get("capital"):
        lat, lng = meta["capital"]
    else:
        lat, lng = 0.0, 0.0

    n_estimated = sum(1 for f in CORE_FIELDS if sources.get(f) == ESTIMATE_LABEL)
    return {
        "iso3": iso3, "iso2": meta["iso2"], "name": meta["name"], "name_fr": seed["name_fr"] if seed else None,
        "region": REGION_FR.get(meta["region_id"] or "", seed["region"] if seed else "Autre"),
        "income": meta.get("income"), "currency": seed["currency"] if seed else None, "lat": lat, "lng": lng,
        "indicators": {
            "gdp_usd": round(ind["gdp_usd"]),
            "gdp_year": row["base_year"],
            "gdp_growth": r2(ind["gdp_growth"]),
            "growth_5y_avg": r2(ind["growth_5y_avg"]),
            "growth_history": ind["growth_history"],
            "inflation": r2(ind["inflation"]),
            "debt_gdp": r1(ind["debt_gdp"]),
            "current_account": r2(ind["current_account"]),
            "pop_growth": r2(ind["pop_growth"]),
            "tourism_exports_pct": r2(ind["tourism_exports_pct"]),
            "tourism_gdp_pct": r2(ind["tourism_gdp_pct"]),
        },
        "sources": sources,
        "data_quality": {
            "score": round(100 * (1 - n_estimated / len(CORE_FIELDS))),
            "estimated": row["estimated"],
            "usd_proxies": usd_proxies,
        },
        "usd": usd,
        "confidence": confidence,
        "sentiment": sentiment,
        "projection": projection,
    }


def build_dataset(offline: bool, with_news: bool, output: Path) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    previous = load_previous(output)

    universe: dict[str, dict[str, Any]] = {}
    wb: dict[str, dict[str, Series]] = {}
    imf: dict[str, dict[str, Series]] = {}
    vintage: str | None = None
    imf_status = news_status = "offline"

    if not offline:
        try:
            universe = fetch_wb_countries()
        except Exception as exc:  # noqa: BLE001
            log(f"World Bank country list FAILED ({exc}), falling back to seed + cached countries")
        wb = fetch_world_bank()
        try:
            imf, vintage = fetch_imf_weo()
            imf_status = f"ok ({vintage.split(':')[1]})"
        except Exception as exc:  # noqa: BLE001
            log(f"IMF WEO via DBnomics FAILED ({exc})")
            imf_status = "indisponible"

    for seed in SEED:
        universe.setdefault(seed["iso3"], {"iso3": seed["iso3"], "iso2": seed["iso2"], "name": seed["name"],
                                           "region_id": None, "income": None, "capital": None})

    rows: list[dict[str, Any]] = []
    reused: list[dict[str, Any]] = []
    for iso3, meta in universe.items():
        gathered = gather_indicators(iso3, wb.get(iso3, {}), imf.get(iso3, {}))
        if gathered is None:
            if iso3 in previous:
                reused.append(previous[iso3])
            continue
        ind, sources, base_year = gathered
        rows.append({"meta": meta, "ind": ind, "sources": sources, "base_year": base_year, "estimated": []})
    for iso3, prev in previous.items():  # keep countries we could not rebuild this run (e.g. offline mode)
        if iso3 not in universe:
            reused.append(prev)
    impute(rows)

    news: dict[str, NewsResult] = {}
    if not offline and with_news:
        news = fetch_news_sentiment([{"iso3": r["meta"]["iso3"], "name": r["meta"]["name"], "gdp": r["ind"]["gdp_usd"]}
                                     for r in rows])
        news_status = f"ok ({len(news)}/{len(rows)} pays)" if news else "fallback (cache / neutre)"
    elif not offline:
        news_status = "désactivé (cache)"

    centroids = load_geo_centroids()
    countries = [finalize(r, resolve_sentiment(r["meta"]["iso3"], news.get(r["meta"]["iso3"]), previous, today), centroids)
                 for r in rows]
    countries += [{**c, "stale": True} for c in reused]
    countries.sort(key=lambda c: c["indicators"]["gdp_usd"], reverse=True)
    for rank, c in enumerate(countries, start=1):
        c["gdp_rank"] = rank

    n_wb = sum(1 for r in rows if any(s.startswith("World Bank") for s in r["sources"].values()))
    wb_status = f"ok ({n_wb}/{len(countries)} pays)" if n_wb else ("offline" if offline else "fallback (référence)")

    return {
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "generated_at": now.isoformat(timespec="seconds"),
            "mode": "offline" if offline else "online",
            "status": {"world_bank": wb_status, "imf": imf_status, "news": news_status},
            "country_count": len(countries),
            "imf_vintage": vintage,
            "sources": [
                {"name": "World Bank Open Data API", "url": "https://api.worldbank.org/v2"},
                {"name": "FMI — World Economic Outlook (via DBnomics)", "url": "https://db.nomics.world/IMF/WEO"},
                {"name": "Google News RSS", "url": "https://news.google.com/rss"},
                {"name": "GDELT DOC 2.0 API", "url": "https://api.gdeltproject.org/api/v2/doc/doc"},
                {"name": "VADER Sentiment", "url": "https://github.com/cjhutto/vaderSentiment"},
            ],
            "methodology": {
                "confidence_weights": CONFIDENCE_WEIGHTS,
                "macro_subweights": MACRO_SUBWEIGHTS,
                "fiscal_subweights": FISCAL_SUBWEIGHTS,
                "usd_weights": USD_WEIGHTS,
                "regime_points": REGIME_POINTS,
                "projection": PROJECTION,
                "notes": [
                    "Score de confiance = 50 + Σ poids × (sous-score − 50) ; la décomposition par facteur est exacte.",
                    "Chaque indicateur prend la valeur la plus récente entre la Banque mondiale et le FMI (WEO) ; la dette publique vient en priorité du FMI (administrations publiques).",
                    "Valeur manquante : médiane de la région, signalée « Estimation » dans le panneau du pays.",
                    "Tourisme : la Banque mondiale n'a pas publié de série post-2020 ; la dernière année pré-Covid (2019) est utilisée.",
                    "Dépendance USD hors 40 pays de référence : régime de change classé à la main, exportations de matières premières de la Banque mondiale, dette/facturation/dépôts estimés par régime et région.",
                    "Projection « Continuité actuelle » en USD constants : la croissance converge de sa moyenne 5 ans vers une ancre de long terme dépendant de la démographie, freinée au-delà de 90 % de dette/PIB.",
                    "La dette projetée suppose un solde primaire nul et un taux réel uniforme ; ce n'est pas une prévision.",
                ],
            },
        },
        "countries": countries,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build MacroGlobe 3D macro_data.json")
    parser.add_argument("--offline", action="store_true", help="use embedded reference data + cached countries only")
    parser.add_argument("--no-news", action="store_true", help="skip headline sentiment (reuse cache)")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    if not args.offline and requests is None:
        log("requests not installed -> switching to offline mode")
        args.offline = True

    data = build_dataset(offline=args.offline, with_news=not args.no_news, output=args.output)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.output.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(args.output)
    status = data["meta"]["status"]
    log(f"Wrote {args.output} ({args.output.stat().st_size / 1024:.0f} KB, {len(data['countries'])} countries, "
        f"WB: {status['world_bank']}, IMF: {status['imf']}, news: {status['news']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
