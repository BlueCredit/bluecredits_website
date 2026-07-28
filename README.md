# bluecredits_website

Consulting website — a static site served via nginx.

## Running locally

Serve the site root with any static file server, for example:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080 in a browser.

You can also build and run the production nginx image:

```bash
docker build -t bluecredits-website .
docker run -p 8080:8080 bluecredits-website
```

## Tests

`tests/smoke_test.py` checks that every page loads and that internal links/assets resolve. Run it against a live server:

```bash
python3 tests/smoke_test.py [base_url]
```

`base_url` defaults to `http://localhost:8080`.
