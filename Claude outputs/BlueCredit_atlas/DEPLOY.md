# BlueCredit Atlas — deployment guide

**Target:** https://atlas.bluecredits.org  
**Type:** static website (HTML, JS, data files). No server code to host.  
**Accounts and billing:** handled by the **BlueCredit Account** in the Marketplace app (bluecredits-core). Atlas has no database, no Supabase and no PayPal keys of its own.  
**Owner:** BlueCredit Inc. Contact: Nathan Wangusi, barasa@bluecredits.org

This site is separate from datacenterwaterleaks.com. Don't reuse anything from that site.

---

## 1. What's in this package

```
site/                       ← publish this folder as the website root
  index.html                the map (the whole app is in this one file)
  pages/terms.html          Terms & Data: terms, refunds, privacy and all data sources (opens as a pop-up from the side panel)
  404.html                  not-found page (GitHub Pages requires it at the root)
  js/account.js             "Sign in with BlueCredit" + Pro unlock. CONFIG AT THE TOP
  data/                     datasets the map loads
  logo.png, favicon.svg     BlueCredit branding
  CNAME                     atlas.bluecredits.org (GitHub Pages custom domain)
  .nojekyll, .gitignore, README.md
admin/                      not published
  build_water_demand.py rebuilds data/water_demand.json from USGS
DEPLOY.md                   this file
```

External libraries load from unpkg.com (Leaflet 1.9.4, esri-leaflet 3.0.10, Turf 6, leaflet-control-geocoder 4.0.0, topojson-client 3.1.0). Live data comes straight from public services in the browser: USGS, EPA, NOAA, USFWS, Esri and Google tiles. No API keys are needed for these.

## 2. Hosting (GitHub Pages), about 15 minutes

1. Create a new repository, for example `BlueCredit/bluecredit-atlas`. It can be private on a paid GitHub plan; Pages works either way.
2. Commit the **contents** of `site/` to the repository root on `main`. Keep `CNAME` and `.nojekyll`.
3. **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main` / `(root)`. Custom domain = `atlas.bluecredits.org`. Turn on **Enforce HTTPS** once the certificate is issued.
4. **DNS** (wherever bluecredits.org is managed): add `CNAME  atlas  →  <github-org-or-user>.github.io`. Don't change the records for the main site.
5. Optional: **Settings → Pages → Verify domain** in the GitHub org, to prevent takeover.

**Optional:** to also catch people who type maps.bluecredits.org, add a 301 URL forward from `maps.bluecredits.org/*` to `https://atlas.bluecredits.org/$1` in your DNS provider. No extra files are needed.

Any static host works instead (Cloudflare Pages, Netlify, or nginx on the Contabo VPS). Serve `site/` as the web root with `404.html` as the not-found page.

## 3. Sign-in with the BlueCredit account

Atlas uses the same account as the Marketplace. The backend and portal changes are in **bluecredits-core** (see `docs/subscriptions.md` there):

- **Backend:** `/api/v1/sso/code`, `/exchange` and `/session`. Code is in `api/sso.py` and `modules/customer_portal/sso_module/`.
- **Portal:** the Account app at `/account`, including `/account/connect`, which sends people back to Atlas signed in.

How it works:

1. The visitor clicks **Sign in** on Atlas and goes to `https://marketplace.bluecredits.org/account/connect?app=atlas&return=<this page>`.
2. They sign in there if needed, with password, 2FA or Google, exactly as on the Marketplace.
3. They come back to Atlas with a one-time code, which Atlas swaps for their name, email and plan.

Atlas never sees passwords or portal tokens.

**Backend environment** (Contabo `prod.env`), in addition to the subscription settings:

```
SSO_ALLOWED_ORIGINS=atlas=https://atlas.bluecredits.org
```

To test against a staging copy of Atlas, add its address: `atlas=https://atlas.bluecredits.org|https://staging-atlas.example.org`.

**`site/js/account.js` settings** (top of the file):

| Setting | Value |
|---|---|
| `api` | `https://marketplace.bluecredits.org` (the backend that serves `/api/v1/sso/*`) |
| `account` | `https://marketplace.bluecredits.org/account` |
| `price` | `$29/month or $290/year` (text shown in the upgrade window; must match the PayPal plans) |

With `api` set to `''`, sign-in is off and every feature is open. That's safe for staging.

The backend's CORS already allows any origin with `Authorization` and `Content-Type` headers, so no CORS change is needed.

## 4. Plans (set in bluecredits-core)

| | Free | Pro | Enterprise |
|---|---|---|---|
| Price | $0 | $29/month or $290/year | From $149/month, quoted |
| Atlas | Map, free layers, Water Demand, popups, search | + reports (PDF/CSV), Pro layers, Print Map | + everything in Pro |
| Marketplace | Buy and retire credits, 1 site | 10 sites, AI bill upload, site analytics | Unlimited sites, 5 seats, bulk data |

Upgrades happen in the Account app (`/account/billing`). The upgrade window in Atlas links there with `?from=atlas&return=<page>`. After paying, **Back to Atlas** returns the visitor signed in with Pro.

Until the backend has `SUBSCRIPTIONS_ENFORCED=true`, every signed-in user gets Atlas Pro. Signed-out visitors are still asked to sign in for Pro features.

## 5. What Pro unlocks in Atlas

| Free | Pro and Enterprise |
|---|---|
| The map; all free layers and popups; search, "Your location", the right-click menu and the draw tool (area size and quick counts) | Site, location, basin, utility, Loudoun and drawn-area reports (PDF + CSV) |
| Water Demand: domestic and agricultural water use by county; industrial facilities by sector (EPA TRI); power plant cooling water (EIA actual) | Pro layers: Data Centers (Actual Water Use), Higher Education, Hospitality, Dams & Reservoirs, Projected Sites 2035, Wastewater Treatment Plants, Reclaimed Water, Recycled Water Lines, Streamgages (live), Groundwater Wells |
| Data centers (estimated water use), water projects, water and wastewater service areas, drought, streamflow vs. normal, flood zones and flood risk (FEMA), watersheds, wetlands, rivers | Print Map (letter or tabloid PDF) |

Layers are marked `pro: true` in `LAYER_GROUPS` in `index.html`; change that flag to move a layer. The paywall runs in the browser: it stops ordinary users and records who pays, but it doesn't encrypt the data.

## 6. Test before announcing

1. **Backend and portal:** deploy the bluecredits-core changes first, with `SSO_ALLOWED_ORIGINS` set.
2. **Signed out:** open Atlas. The map works. The top right shows **Sign in** and the 9-dot apps menu, with Account, Home, Marketplace and Atlas.
3. **Sign-in prompt:** open a site report. The window asks you to sign in with BlueCredit.
4. **Sign in:** click **Sign in with BlueCredit**, sign in on the Marketplace, and you should land back on the same Atlas page with your name at the top right.
5. **Free user:** open a report. The upgrade window appears. Click **See plans and upgrade**, subscribe to Pro, then click **Back to Atlas**. The chip should show **PRO** and reports should open.
6. **Sign out:** your name → **Sign out of Atlas** signs out of Atlas only.

## 7. Data

| File | Contents | Source |
|---|---|---|
| `water_demand.json` | County boundaries plus 2015 withdrawals by sector (Mgal/d), population and irrigated acres (TopoJSON) | USGS, *Estimated Use of Water in the U.S., County-Level Data for 2015* (doi:10.5066/F7TB15V5); boundaries from U.S. Census via `us-atlas@3` |
| `datacenters_estimated.geojson`, `datacenters_projected.json` | Existing and projected data centers | PNNL IM3 (doi:10.57931/3017294, 10.57931/3020186) |
| `datacenters_wateruse.csv`, `datacenters_wateroffsets.csv`, `datacenters_loudounwater.csv`, `datacenters_waterreclaimed.csv` | FOIA/utility water use, water projects, Loudoun aggregates and reclaimed-water records | public-records responses and utility data compiled by BlueCredit |
| `wastewater_plants.json` | Wastewater treatment plants | U.S. EPA 2022 CWNS |
| `industrial_facilities.json` | 21,482 industrial facilities with sector (grouped into 9 categories), pounds of chemicals discharged to water, sent to sewage plants and released in total | U.S. EPA Toxics Release Inventory 2024 (public domain) |
| `plant_cooling.json` | 737 power plants: actual 2024 cooling-water withdrawal and consumption (million gallons), cooling type, water source | U.S. EIA thermoelectric cooling water data 2024 + EIA *Power Plants in the U.S.* locations (public domain) |
| `higher_education.json` | 6,511 active colleges and universities: enrollment, dorm capacity, employees | DHS HIFLD *Colleges and Universities* (NCES IPEDS), public domain |
| `hospitality.json` | 20,936 hotels, open and in the pipeline: rooms, brand, class, status, year built (contact names and phones removed) | Lodging Econometrics (licensed) |

**Hotels licence:** `hospitality.json` is a static file, so anyone who finds its URL can download it, even though the layer is Pro-only on the map. If the Lodging Econometrics licence doesn't allow public redistribution, serve this file from the backend to signed-in Pro users instead, or show hotels by county only.

**Facility water estimates** (planning-level, shown as estimates in the popups):
- **Hotels:** rooms × 33,500 gal/yr, with a typical range of half to double.
- **Universities:** dorm beds × 82 gal/day × 270 days, plus employees × 11,200 gal/yr.
- **Sources:** WaterSense & ENERGY STAR, *U.S. Water Use Intensity by Property Type: Technical Reference* (June 2023), and EPA WaterSense (82 gal/person/day, from USGS 2015).

To rebuild the county water-use file (for example if USGS publishes an update):

```
npm install us-atlas@3
python admin/build_water_demand.py usco2015v2.0.csv node_modules/us-atlas/counties-10m.json site/data/water_demand.json
```

Water Demand categories:
- **Domestic**: self-supplied plus public-supply deliveries to homes (`DO-WDelv`).
- **Industrial**: industrial self-supplied plus mining (`IN-Wtotl` + `MI-Wtotl`).
- **Agricultural**: irrigation, livestock and aquaculture (`IR-WFrTo` + `LI-WFrTo` + `AQ-Wtotl`).
- **Power plant cooling**: thermoelectric (`PT-Wtotl`).

Only one sector map shows at a time. 2015 is the latest USGS release that covers every sector; USGS's newer model estimates cover only public supply, irrigation and thermoelectric.

## 8. Maintenance notes

- Everything is in `index.html`. Search for these names:
  - `LAYER_GROUPS`: the layer panel.
  - `WD`: Water Demand layers; `brWaterDemandSection`: report section 7.
  - `SG`: streamgages.
  - `GW`: groundwater.
  - `NWM`: NOAA streamflow.
  - `openSiteReport` and `openAreaReport`: reports.
  - `pmBuildTitleBlock`: the print map.
- App launcher (9-dot menu, top right): `BC_APPS` near the end of `index.html`. Order: Account, Home, Marketplace, Atlas. Account and Marketplace links follow `BC_ACCOUNT.account`.
- Terms & Data: everything (terms, refunds, privacy, data sources) is in `pages/terms.html`. The side panel's **Terms & Data** button opens it in a pop-up over the map (`?embed=1` hides its header); it also works as a normal page. Edit data sources there. Contact address on the site: support@bluecredits.org.
- Sign-in: `js/account.js`. It keeps the plan in the browser (`localStorage` key `bc_atlas_session`) and refreshes it every 10 minutes.
- Industry layers: `IND` in `index.html` (TRI sectors are grouped in `data/industrial_facilities.json` → `groups`). Refresh yearly from the TRI basic data file and EIA thermoelectric cooling water data.
- Dams & reservoirs load live from the USACE National Inventory of Dams feature service (`NID.url` in `index.html`, via Esri U.S. Federal Data, CC BY 4.0); smaller dams appear as you zoom in. Site reports list dams within 10 miles; area reports list dams inside the area.
- Draw tool (bottom right, above "Your location"): `DRAW` / `DrawCtrl` in `index.html`. Polygon, rectangle or circle; the popup shows size and counts, and **Open area report** runs `openAreaReport('custom')` on `window._drawnFeature` (same sections as the basin report). Areas over 60,000 sq mi are refused.
- Report maps: `brMap` draws the core layers and `brMapOverlays` adds industry, power plants, dams, the streamgage and well, universities and hospitality once the report sections load. The legend under the map (`BR_PTS`, `brMapLegend`) lists only the layers that have points in view. Area reports show the 250 largest universities and hotels in the area.
- Flood risk (`FLOOD` in `index.html`), all live from FEMA with no key:
  - **Flood Zones:** FEMA National Flood Hazard Layer map service (`FLOOD.nfhl`, layer 28). FEMA's server draws it only from street level (about zoom 14); clicking the map shows the zone.
  - **Flood Risk by Area:** FEMA National Risk Index, counties below zoom 9 and census tracts from zoom 9 (`FLOOD.nriCounty`, `FLOOD.nriTract`). Color is the worse of river/rain and coastal flood risk.
  - **Reports** (section 3, after dams): the FEMA zone at the site and distance to the nearest 100- and 500-year floodplain (within 0.6 mi), the tract's flood risk and expected annual loss, and NFIP flood insurance claims for the county from OpenFEMA (`FLOOD.claims`, NfipClaims v3). Area reports summarize census tracts by rating and claims for up to 12 counties. Payouts are summed for counties with up to 50,000 claims.
  - OpenFEMA retired the old `FimaNfipClaims` v2 endpoint in October 2026; the code uses v3.
- Sewersheds load live from EPA's National Sewershed feature service (`SEWER.url` in `index.html`), from zoom 8 in.
- Live services can change. If a layer goes blank, check the browser console, then the service URL in the code.
- Pin library versions as they are now. `leaflet-control-geocoder` must stay on 4.0.0.
