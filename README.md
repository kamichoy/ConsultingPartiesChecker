# Indiana Consulting Parties Finder

A simple tool for looking up, by county, the contacts you need for historic preservation in Indiana:

- The Indiana Landmarks regional office (and staff) for that county (https://www.indianalandmarks.org/news/in-your-area/)
- Local preservation and historical organizations (https://www.indianalandmarks.org/resources/indiana-preservation-directory/ & https://indianahistory.org/across-indiana/hometown-resources/find-who-you-need-by-county/)
- Tribal contacts on file for that county (https://egis.hud.gov/tdat/)

## Quick start (just want to use it)

It's live at **https://consultingpartieschecker.pages.dev** — just open that
link and pick a county from the dropdown. The three sections below will fill
in with whatever is on file for that county.

No install, no download needed. You can ignore everything below; it's only
needed if you want to run it locally or refresh the data.

### Running it locally instead

1. Download the whole project folder (it must include both
   **`public/index.html`** and **`public/data.js`** — `data.js` holds all the
   contact data and `index.html` won't work without it sitting right next to
   it).
2. Double-click **`public/index.html`**. It opens directly in your browser —
   no install, no server, no internet connection required (except to load the
   Tailwind CSS styling from a CDN).

## Updating the data (optional)

The contact data in `data.js` is pulled from live sources (Indiana Landmarks,
Indiana Historical Society, and the HUD Tribal Directory Assistance Tool) and
can go stale. To rebuild it:

1. Install [Node.js](https://nodejs.org/) if you don't already have it.
2. In the project folder, install dependencies:
   ```
   npm install
   ```
3. Run the build script:
   ```
   node build-data.js
   ```
   This re-scrapes all 92 counties and overwrites `data.js`. It takes a few
   minutes and prints progress per county.
4. Refresh `public/index.html` in your browser to see the updated data.

`public/data.js` is generated — don't hand-edit it, since the next rebuild
will overwrite your changes.

If you've pushed the rebuilt `public/data.js` to GitHub, the live site at
https://consultingpartieschecker.pages.dev picks it up automatically (it's
deployed from the `public/` folder via Cloudflare Pages).

## Files

| File | Purpose |
|---|---|
| `public/index.html` | The tool itself — this is what's deployed and what you'd open in a browser |
| `public/data.js` | Generated contact data that `index.html` reads |
| `build-data.js` | Node script that regenerates `data.js` from live sources |
| `package.json` | Dependencies needed to run `build-data.js` (`axios`, `cheerio`) |
