"""Build site/data/water_demand.json (TopoJSON) for the Water Demand layers.

Inputs
  1. USGS county water use, 2015 (usco2015v2.0.csv) from
     https://www.sciencebase.gov/catalog/item/5af3311be4b0da30c1b245d8
  2. County boundaries: us-atlas 3.x counties-10m.json (U.S. Census Bureau cartographic boundaries),
     `npm install us-atlas@3`

Usage
  python build_water_demand.py usco2015v2.0.csv node_modules/us-atlas/counties-10m.json ../site/data/water_demand.json

All water values are withdrawals in million gallons per day (Mgal/d); population and irrigated
acres are in thousands, as published by USGS.
"""
import csv
import json
import sys


def num(v):
    v = (v or '').strip()
    if v in ('', '--', 'NA'):
        return None
    try:
        return round(float(v), 3)
    except ValueError:
        return None


def main(csv_path, atlas_path, out_path):
    with open(csv_path, newline='', encoding='latin-1') as f:
        rows = list(csv.reader(f))
    head_i = next(i for i, r in enumerate(rows) if r and r[0].strip() == 'STATE')
    head = [h.strip() for h in rows[head_i]]
    col = {h: i for i, h in enumerate(head)}

    def g(r, k):
        return num(r[col[k]]) if k in col and col[k] < len(r) else None

    wu = {}
    for r in rows[head_i + 1:]:
        if len(r) < 10 or not r[col['FIPS']].strip():
            continue
        fips = r[col['FIPS']].strip().zfill(5)
        wu[fips] = {
            'st': r[col['STATE']].strip(),
            'cn': r[col['COUNTY']].strip(),   # USGS county name, e.g. 'Fairfax County', 'Fairfax city'
            'p': g(r, 'TP-TotPop'),     # total population (thousands)
            'pp': g(r, 'PS-TOPop'),     # population served by public supply (thousands)
            'sp': g(r, 'DO-SSPop'),     # self-supplied domestic population (thousands)
            'd': g(r, 'DO-WDelv'),      # domestic use: self-supplied withdrawals + public-supply deliveries
            'ps': g(r, 'PS-Wtotl'),     # public-supply withdrawals (all customers)
            'i': g(r, 'IN-Wtotl'),      # industrial, self-supplied
            'm': g(r, 'MI-Wtotl'),      # mining
            'ir': g(r, 'IR-WFrTo'),     # irrigation (crops + golf)
            'li': g(r, 'LI-WFrTo'),     # livestock
            'aq': g(r, 'AQ-Wtotl'),     # aquaculture
            't': g(r, 'PT-Wtotl'),      # thermoelectric power
            'tot': g(r, 'TO-Wtotl'),    # total withdrawals
            'ac': g(r, 'IR-IrTot'),     # irrigated area (thousand acres)
        }

    topo = json.load(open(atlas_path))
    states = {s['id']: s['properties']['name'] for s in topo['objects']['states']['geometries']}
    matched = 0
    for geo in topo['objects']['counties']['geometries']:
        fips = str(geo.get('id', '')).zfill(5)
        props = {'n': geo.get('properties', {}).get('name', ''), 's': states.get(fips[:2], '')}
        w = wu.get(fips)
        if w:
            matched += 1
            props.update({k: v for k, v in w.items() if v is not None})
        geo['properties'] = props
    del topo['objects']['nation']
    for s in topo['objects']['states']['geometries']:
        s.pop('properties', None)
    topo['objects']['states']['geometries'] = []   # arcs are shared with counties; states object not needed
    with open(out_path, 'w') as f:
        json.dump(topo, f, separators=(',', ':'))
    print(f'{len(wu)} USGS county rows, {matched} of {len(topo["objects"]["counties"]["geometries"])} map counties matched')


if __name__ == '__main__':
    main(*sys.argv[1:4])
