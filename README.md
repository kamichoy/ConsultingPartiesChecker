# Indiana Consulting Parties Finder

A simple tool for looking up, by county, the contacts you need for Section 106 /
historic preservation review in Indiana:

- The Indiana Landmarks regional office (and staff) for that county
- Local preservation and historical organizations
- Tribal contacts on file with HUD for that county

## Quick start (just want to use it)

1. Download the whole project folder (it must include both **`index.html`** and
   **`data.js`** — `data.js` holds all the contact data and `index.html` won't
   work without it sitting right next to it).
2. Double-click **`index.html`**. It opens directly in your browser — no
   install, no server, no internet connection required (except to load the
   Tailwind CSS styling from a CDN).
3. Pick a county from the dropdown. The three sections below will fill in with
   whatever is on file for that county.

That's it — this is all you need if you just want to look things up. You can
ignore everything below; it's only needed if you want to refresh the data.

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
4. Refresh `index.html` in your browser to see the updated data.

`data.js` is generated — don't hand-edit it, since the next rebuild will
overwrite your changes.

## Files

| File | Purpose |
|---|---|
| `index.html` | The tool itself — open this in a browser |
| `data.js` | Generated contact data that `index.html` reads |
| `build-data.js` | Node script that regenerates `data.js` from live sources |
| `package.json` | Dependencies needed to run `build-data.js` (`axios`, `cheerio`) |
