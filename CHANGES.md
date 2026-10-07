# Website update — 2026-10-07

## Copy these files into the repo root (replace existing)
index.html, capabilities.html, industries.html, past-performance.html, research.html,
partnerships.html, investors.html, careers.html, newsroom.html, bluefund.html (new)

## What changed
- Nav: "Platforms" is now "Solutions" (Marketplace, Atlas, The Blue Fund). Footer "Products" is now "Solutions".
- New page: bluefund.html (The Blue Fund: short intro, how it works, contact).
- Investors: Blue Fund banner, "Interested in" field on the form.
- Home: Solutions section heading, "Explore Solutions" button, Blue Fund banner under the two platforms.
- Newsroom: fixed nav (Research was wrongly highlighted; broken Newsroom link class).
- Cleanup: removed empty CSS blocks; closing </html> added to index; footer year 2026.

## Delete from the repo (site is on GitHub Pages)
- Dockerfile
- cloudbuild.yaml
- .dockerignore
- "Claude outputs/" folder, if it is still in this repo (GitHub Pages serves every file publicly, including zips)

Keep: CNAME, favicon.svg, assets/, .gitattributes, README.md, .github/ (check it holds only a Pages workflow).
`tests/` is only needed if something runs it; delete it if it was for the Docker build.
