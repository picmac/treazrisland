# Grafana dashboard snippets

Use these snippets as starting points for a Treazrisland observability dashboard. Panels assume Prometheus is scraping
`/metrics` with the accompanying recording rules and that Grafana also has a Postgres data source pointing at the
application database for catalog insights.

## ROM catalog size

- **Data source:** Postgres (`treazrisland-db`)
- **Query:**
  ```sql
  SELECT count(*) AS rom_count FROM "Rom";
  ```
- **Visualization:** Stat panel with `Thresholds` at 50/100 to highlight growth.
- **Description:** Shows how many ROMs are currently indexed; pair with annotations from deployments to correlate spikes.

## Active refresh-token sessions

- **Data source:** Prometheus (`treazrisland-prom`)
- **Query:**
  ```promql
  treazr_active_sessions
  ```
- **Visualization:** Time series with a 5m rate-of-change transformation to spot unexpected growth.
- **Description:** Mirrors the Redis-backed refresh token store. Sustained increases can indicate long-lived device sessions
  or token leakage.

## Emulator performance (FPS)

- **Data source:** Prometheus (`treazrisland-prom`)
- **Query:**
  ```promql
  job:treazr_emulator_fps:avg_rate5m
  ```
- **Visualization:** Time series with `rom_id` as a legend label; apply a panel threshold at 45 FPS to flag slowdowns.
- **Description:** Aggregated frame-rate samples reported by the web emulator. Layer a heatmap using
  `histogram_quantile(0.5, sum(rate(treazr_emulator_fps_bucket[5m])) by (le, rom_id))` to visualize jitter per ROM.

## Emulator memory pressure (p95)

- **Data source:** Prometheus (`treazrisland-prom`)
- **Query:**
  ```promql
  job:treazr_emulator_memory_used_mb:p95_5m
  ```
- **Visualization:** Time series with multi-line legends for each `rom_id`.
- **Description:** Highlights clients nearing heap exhaustion; combine with browser dimension filters if exposed via labels.
