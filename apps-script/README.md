# HEARTCODE — Google Sheets analytics

## Current status
The spreadsheet and website code are prepared, but **automatic collection is off**
until the administrator deploys this Google Apps Script and sets its public `/exec` URL.
Never share access to the Google Sheet with all users or put Google credentials in GitHub.

## One-time activation (administrator)
1. Open the private HEARTCODE Google Sheet.
2. Click **Extensions → Apps Script**.
3. Replace the initial `Code.gs` contents with [Code.gs](Code.gs) and save.
4. Select **Deploy → New deployment → Web app**.
5. Choose **Execute as: Me** (your Google account), and **Who has access: Anyone**.
   Approve the Google authorization screen. The endpoint is publicly writable
   but does NOT grant spreadsheet read access.
6. Copy the deployed URL ending in **/exec**. Open it in a browser: it should say
   `HEARTCODE analytics collector is ready` and must reveal no student information.
7. In GitHub, edit the single file `analytics-config.js`:
   `window.HEARTCODE_ANALYTICS_URL = "https://script.google.com/macros/s/.../exec";`
   Commit the edit to `main` so GitHub Pages publishes it. Alternatively,
   send this URL to the HEARTCODE administrator/developer for configuration.
8. Open the site in a **private/incognito window**, fill the entry form and agree
   to the new tracking consent. Check the private sheet for an actual new row in
   `Посещения` and `Посетители`.
9. Open and close a lesson. `Активность` and `Дашборд` should show real events.

## Current columns and event meanings

* `Посещения` — one row per new browser session after consent. Name, only
  the last four WhatsApp digits, normalized role, timestamp, session and source.
* `Посетители` — one row per anonymous browser visitor ID; returning visits
  update the last seen time. A cleared browser creates a new anonymous ID.
* `Активность` — page views, lesson opens/closes, contact and purchase clicks.
  Purchase click events only occur when matching buttons exist on the site.
* `Дашборд` — summaries and three charts fed by these tabs.

## Privacy and operational limitations

* Consent is required before collection; previous local-only consent is not
  automatically upgraded.
* This static site cannot guarantee that every `sendBeacon` is delivered.
  Network errors, offline devices, blockers and Apps Script quotas may cause
  missing records.
* The web app is intentionally *publicly writable* for visitors without accounts.
  Data can be spammed by third parties, so treat it as indicative analytics and
  not as a trusted audit log. Keep read access to the Google Sheet private.
* No server-side private credentials or personal student data are stored in GitHub.
* The last 4 WhatsApp digits are not a unique identity. Unique/returning figures
  use a locally generated pseudonymous browser identifier.
* Time spent on a lesson estimates time while the lesson page is open; it does
  not prove the user watched the entire video.
* If you change the Apps Script code, redeploy the updated version of the web app.

## Troubleshooting

* If there are no new rows, first check whether the `/exec` URL is present in
  `analytics-config.js`, and whether Google Apps Script was deployed as
  **Execute as: Me / Anyone**.
* Run an incognito test because existing users must approve the updated consent.
* Check **Apps Script → Executions** for server errors, and ensure tab names
  are unchanged.
* Check the sheet sharing status: it should be restricted to the owner/admin.
