#!/usr/bin/env python3
"""Smoke tests for the static site: every page loads, and internal links/assets resolve.

Run against a live server (default http://localhost:8080):
    python3 tests/smoke_test.py [base_url]
"""
import glob
import os
import re
import sys
import urllib.error
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINK_RE = re.compile(r'(?:href|src)="([^"]+)"')


def find_html_files():
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(REPO_ROOT, "*.html")))


def local_targets(html_path):
    with open(html_path, encoding="utf-8") as f:
        content = f.read()
    targets = []
    for match in LINK_RE.findall(content):
        if match.startswith(("http://", "https://", "#", "mailto:", "tel:")):
            continue
        targets.append(match.lstrip("/"))
    return targets


def check_internal_links():
    failures = []
    for html_file in find_html_files():
        for target in local_targets(os.path.join(REPO_ROOT, html_file)):
            target_path = os.path.join(REPO_ROOT, target)
            if not os.path.exists(target_path):
                failures.append(f"{html_file} references missing local file: {target}")
    return failures


def check_pages_load(base_url):
    failures = []
    for html_file in find_html_files():
        url = f"{base_url}/{html_file}"
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                if resp.status != 200:
                    failures.append(f"{url} returned HTTP {resp.status}")
                elif len(resp.read()) == 0:
                    failures.append(f"{url} returned an empty body")
        except (urllib.error.URLError, urllib.error.HTTPError) as exc:
            failures.append(f"{url} failed to load: {exc}")
    return failures


def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
    failures = check_internal_links() + check_pages_load(base_url)

    if failures:
        print(f"FAILED — {len(failures)} problem(s):")
        for f in failures:
            print(f"  - {f}")
        sys.exit(1)

    print(f"OK — all {len(find_html_files())} pages loaded and internal links resolved")


if __name__ == "__main__":
    main()
