# GeoConversion

Privacy-first location timeline reconstruction for Adobe Lightroom Classic. Production: https://geoconversion.third-ai.com.

## Develop and test

Requires Node 22+ and npm. `npm ci`, `npm run dev`, `npm run check`, `npm test`, `npm run build`. Synthetic fixtures are generated in `tests/core.test.ts`; no personal data is included. `npm audit --omit=dev` audits browser/server dependencies.

## Architecture and privacy

Vite builds the TypeScript browser application. A dedicated Web Worker holds normalized GPS points in memory and performs parsing, merging, reconstruction and GPX generation. The browser thread receives a bounded display representation. There are no accounts, photograph inputs, file upload APIs, location databases, service workers, IndexedDB, localStorage, sessionStorage, analytics SDKs or location logs. Clear all drops the worker's data; leaving the page terminates it.

The Cloudflare Worker serves static assets and validates an exact four-field aggregate event schema. It forwards only event category, source category, integer duration and a size bucket (plus Cloudflare's country code) to the existing administration Worker via a service binding. Unknown fields are rejected, never logged or stored. Administration stores hourly operational counters in its existing Strata D1 database with 90-day retention. GeoConversion has no D1, KV or R2 binding. Neither imported timestamps nor filenames enter telemetry. Page views count server HTML responses, including bots; sessions and unique users are explicitly unavailable.

Leaflet draws tracks locally. Map tiles are **off by default**. Opting in fetches standard OpenStreetMap tiles; the tile service sees IP and viewed map areas. Attribution remains visible, no prefetch/offline downloads occur, and browser HTTP caching is respected. See https://operations.osmfoundation.org/policies/tiles/.

## Supported inputs

Content-based detection precedes extensions. Google Timeline: current Android `semanticSegments`, iOS segment arrays, `timelinePath` with absolute times or minute offsets, activity endpoints, visits, rawSignals and legacy E7 locations. Visits/activity endpoints carry reduced quality; inferred locations never imply recorded sensor accuracy. Unknown structures receive an explicit error.

Apple Health: select its ZIP export containing `workout-routes/*.gpx` or select individual route GPX files. Only GPX route entries are decompressed; health XML and other health records are skipped. The workout type is not inferred from unrelated Health records. GPX (track/route points), Garmin FIT (official SDK with integrity check), TCX, KML gx:Track/timestamped placemarks, KMZ and comma/semicolon CSV are supported. Untimed KML geometry cannot be converted into a timestamped track. CSV requires recognizable time, lat and lon columns; timezone-free timestamps are rejected rather than guessed.

128 MB/file, 256 MB declared archive expansion, 5,000 archive entries, 20 files, 1,000,000 combined input points and 500,000 output points. Workers keep the UI responsive, but parsing is bounded in-memory rather than unbounded streaming. Reduce large exports or select individual workout routes.

## Reconstruction and merging

`src/track.ts` contains the dedicated policy: up to 180 seconds is good confidence if speed, accuracy and continuity permit; 180–900 seconds is uncertain; longer gaps, implausible speeds (>55 m/s), explicit segment boundaries and invalid elapsed times remain gaps. Accuracy worse than 100 m downgrades confidence. Nearby speed changes also downgrade certainty. This is conservative straight-line temporal interpolation, not road routing or a recovered real route. All original samples are retained unless overlapping superior coverage replaces them.

Dense plausible coverage from another source suppresses lower-quality samples only inside that coverage. Workout route quality outranks generic GPS, which outranks Timeline semantic estimates. Equal timestamps choose the better-quality sample. Outages cannot suppress other files across a long gap. Generated points are produced only after merging.

Sampling options: original, 5, 10 (default), 30 seconds. UTC milliseconds are canonical. Temporal handles IANA timezone date selection, DST days and rejects ambiguous/nonexistent custom local times. GPX 1.1 has monotonic UTC ISO timestamps, coordinates, optional altitude and separate track segments across gaps. XML and field validation precede download. Load GPX in Lightroom Classic Map → Tracklog → Load Tracklog, select photographs and Auto-Tag; adjust camera offset in Lightroom if necessary.

## Cloudflare deployment

GitHub repository: https://github.com/gattim77/geoconversion. Cloudflare Workers Builds watches `main`: build `npm run build`, deploy `node scripts/deploy.mjs`, root `/`. `wrangler.json` binds static `dist/`, the existing `sites-admin-dashboard` service, version metadata and the custom hostname. It enables no observability logs. `/api/version` exposes the deployed Git revision. Cloudflare custom domains manage the sole requested hostname and certificate.

The admin repository must apply `migrations/geoconversion.sql` to the existing Strata DB, then deploy its aggregate ingestion/detail changes. No GeoConversion secrets are required. Existing admin login/MFA and bindings are preserved. Local telemetry may be unavailable without the service binding and should never block conversion.

## Troubleshooting

- Missing Apple routes: include workout-routes GPX files; export.xml alone has no GPS track.
- No valid samples: verify coordinates and timestamp timezone suffixes.
- Ambiguous DST time: choose a valid time or UTC.
- Sparse/implausible track: gaps remain empty; do not use estimated tracks as evidence of precise whereabouts.
- Large export: shorten the interval or lower sampling density.
- Telemetry unavailable: verify the admin service binding and migration. Conversions work locally regardless.
