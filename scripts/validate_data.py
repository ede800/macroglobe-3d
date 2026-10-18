#!/usr/bin/env python3
"""Sanity checks on public/data/macro_data.json + macro_details.json (run after the pipeline, and in CI).

Exits with status 1 and a list of problems when an invariant is broken.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

DATA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "public" / "data"
CATEGORIES = {
    "Extrême-Gauche / Communiste", "Gauche / Social-démocrate", "Centre / Libéral", "Droite / Conservateur",
    "Droite Nationaliste / Extrême-Droite", "Monarchie Absolue / Théocratie / Autre", None,
}
problems: list[str] = []


def bad(iso: str, msg: str) -> None:
    problems.append(f"{iso}: {msg}")


def walk_numbers(obj: Any, path: str = ""):
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_numbers(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_numbers(v, f"{path}[{i}]")


def in_range(iso: str, name: str, value: Any, lo: float, hi: float, nullable: bool = False) -> None:
    if value is None:
        if not nullable:
            bad(iso, f"{name} is null")
        return
    if not isinstance(value, (int, float)) or not (lo <= value <= hi):
        bad(iso, f"{name}={value!r} outside [{lo}, {hi}]")


def main() -> int:
    data = json.loads((DATA / "macro_data.json").read_text(encoding="utf-8"))
    details = json.loads((DATA / "macro_details.json").read_text(encoding="utf-8"))["countries"]
    countries = data["countries"]
    if len(countries) < 150:
        problems.append(f"only {len(countries)} countries")
    seen: set[str] = set()

    for c in countries:
        iso = c.get("iso3", "?")
        if iso in seen:
            bad(iso, "duplicate iso3")
        seen.add(iso)
        for path, v in walk_numbers(c):
            if isinstance(v, float) and not math.isfinite(v):
                bad(iso, f"non-finite number at {path}")
        if not c.get("iso2") or len(c["iso2"]) != 2:
            bad(iso, f"bad iso2 {c.get('iso2')!r}")
        in_range(iso, "lat", c.get("lat"), -90, 90)
        in_range(iso, "lng", c.get("lng"), -180, 180)
        ind = c["indicators"]
        in_range(iso, "gdp_usd", ind["gdp_usd"], 1e7, 5e13)
        in_range(iso, "gdp_growth", ind["gdp_growth"], -60, 100)
        in_range(iso, "inflation", ind["inflation"], -30, 5000)
        in_range(iso, "debt_gdp", ind["debt_gdp"], 0, 400)
        in_range(iso, "tourism_exports_pct", ind["tourism_exports_pct"], 0, 100)
        in_range(iso, "confidence", c["confidence"]["score"], 0, 100)
        if c["confidence"]["label"] not in ("Pessimiste", "Neutre", "Optimiste"):
            bad(iso, f"confidence label {c['confidence']['label']!r}")
        # exact decomposition: score = 50 + sum(impacts)
        total = 50 + sum(f["impact"] for f in c["confidence"]["factors"])
        if abs(total - c["confidence"]["score"]) > 0.6:
            bad(iso, f"factor impacts sum to {total:.1f}, score is {c['confidence']['score']}")
        in_range(iso, "usd.score", c["usd"]["score"], 0, 100)
        in_range(iso, "sentiment.score", c["sentiment"]["score"], 0, 100)
        if c["sentiment"]["status"] not in ("live", "cache", "neutral"):
            bad(iso, f"sentiment status {c['sentiment']['status']!r}")

        p = c["projection"]
        for k in ("stability_10", "stability_25"):
            in_range(iso, k, p[k], 0, 100)
        in_range(iso, "cagr_25", p["cagr_25"], -15, 15)
        if p["gdp_10"] <= 0 or p["gdp_25"] <= 0:
            bad(iso, "non-positive projected GDP")

        dep = c.get("dependencies")
        if dep:
            score = dep["exposure"]["score"]
            in_range(iso, "exposure", score, 0, 100, nullable=True)
            for axis in dep["exposure"]["axes"]:
                in_range(iso, f"axis {axis['key']}", axis["value"], 0, 100, nullable=True)
            partners = dep["partners"]
            if partners:
                shares = sum((partners[k] or {}).get("share", 0) for k in ("china", "us", "eu"))
                if shares > 100.5:
                    bad(iso, f"partner shares sum to {shares:.1f} %")
        demo = c.get("demography") or {}
        in_range(iso, "fertility", demo.get("fertility_rate"), 0.5, 9, nullable=True)
        in_range(iso, "life_expectancy", demo.get("life_expectancy"), 30, 95, nullable=True)
        in_range(iso, "median_age", demo.get("median_age"), 10, 65, nullable=True)
        in_range(iso, "share_65plus", demo.get("share_65plus"), 0, 45, nullable=True)
        soc = c.get("society") or {}
        in_range(iso, "hdi", soc.get("hdi"), 0, 1, nullable=True)
        in_range(iso, "gini", soc.get("gini"), 0, 100, nullable=True)
        in_range(iso, "unemployment", soc.get("unemployment"), 0, 60, nullable=True)
        in_range(iso, "corruption", soc.get("corruption_cpi"), 0, 100, nullable=True)
        in_range(iso, "low_carbon", soc.get("low_carbon_electricity"), 0, 100, nullable=True)

        pol = c.get("politics")
        if pol:
            if pol["political_category"] not in CATEGORIES:
                bad(iso, f"political category {pol['political_category']!r}")
            in_range(iso, "political score", pol["political_position_score"], -100, 100, nullable=True)
            for leader in pol["leaders"]:
                if not leader.get("name") or leader["name"] == "—":
                    bad(iso, f"leader without name ({leader.get('wikidata')})")
                url = leader.get("photo_url")
                if url and not url.startswith("https://commons.wikimedia.org/"):
                    bad(iso, f"unexpected photo url {url[:60]}")
                if leader.get("since") is not None and not (1900 <= leader["since"] <= 2100):
                    bad(iso, f"leader since {leader['since']}")

        d = details.get(iso)
        if not d:
            bad(iso, "missing from macro_details.json")
        else:
            if len(d["series"]) != 26:
                bad(iso, f"projection series has {len(d['series'])} points")
            for h in d["headlines"]:
                if not str(h.get("url", "")).startswith(("http://", "https://")):
                    bad(iso, f"headline url {str(h.get('url'))[:40]!r}")

    for msg in problems:
        print("PROBLEM", msg)
    print(f"{len(countries)} countries checked, {len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
