# Who can reach life's necessities? A study of mobility and access to essential services in Houston, Texas

A scrollytelling map for Harris County, Texas that asks and answers a plain question, "Who can (or most importantly, can't) reach life's necessities?" As the reader scrolls, the map moves through transit need, job access, groceries, childcare, and the historical roots of the pattern, ending on where better bus service would help the most.

Built for MUSA 6110 (JavaScript Programming for Planners & Designers) at the University of Pennsylvania.

## Live version

Published with GitHub Pages: https://gbd2.github.io/MUSA-6110-story-map-project/templates/scrollytelly/

## Local files

The map is in `templates/scrollytelly/`. The repository root holds the linters, GitHub Actions, and the package manifest.

## Viewing it locally

The page loads its data with `fetch`, so it must be served over HTTP. Opening `index.html` directly from the file system will not work. From the repository root:

```bash
# Install dependencies
npm install
cd templates/scrollytelly
npx serve templates/scrollytelly
```

Then open `http://localhost:8000` in a web browser.

## Data sources

All layers are public data.

- **EPA Smart Location Database, v3.0** (geodata.epa.gov). Jobs reachable within a 45-minute transit ride (`D5BR`) and the share of zero-vehicle households (`Pct_AO0`), on 2010 census block groups.
- **American Community Survey, 2019 5-year** (census.gov). Median household income (table B19013), on 2010 block groups to align with the Smart Location Database.
- **USDA Food Access Research Atlas, 2019** (ers.usda.gov). Low-income, low-access grocery-desert tract flags, on 2010 census tracts.
- **Texas HHSC Child Care Licensing operations data** (data.texas.gov, dataset bc5r-88dy). Licensed child-care capacity, with under-5 population from ACS 2020 to 2024 5-year (table B01001), on 2020 census tracts.
- **HOLC Residential Security Map, City of Houston, 1930s** (loc.gov). Digitized image held by the Library of Congress, obtained via the Houston Chronicle.
- **Houston METRO GTFS** (ridemetro.org). Static schedule feed
  `August2026IVOMS_20260828`, used for stops, routes, and the frequent-network subset.
- **Census TIGER/TIGERweb** (census.gov). Block group and tract boundary geometry, 2010 and 2020.

## Methodology notes

- Grocery deserts use the USDA's classification, which is based on the share of a tract's residents who are low-income and more than half a mile from a supermarket.
- Childcare deserts are a proxy. A tract is flagged when it has children under five but fewer than one licensed slot for every three of them, or no licensed slots at all.
- The frequent bus network is derived from the schedule (routes that run all seven days with at least 120 weekday trips), since the feed carries no field. So, it approximates METRO's published frequent network.
