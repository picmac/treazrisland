# Operations Runbook

This runbook captures the operational standards for the Treazr Island platform. It is designed to be concise, actionable, and to cover the end-to-end lifecycle of detecting, responding to, and preventing incidents.

## Monitoring Checks

| Layer | Signal | Thresholds & Alerts | Action Playbook |
| --- | --- | --- | --- |
| API (backend + frontend) | HTTP error rate (4xx/5xx), latency (p95/p99), saturation (requests per second) | PagerDuty warn at 3% 5xx over 5 minutes; page at 5% over 2 minutes. Latency SLO breach at >1.5s p95 for 10 minutes. | Review recent deploys, inspect logs in observability stack, roll back if regression introduced. Scale API pods if saturation is sustained. |
| Jobs & workers | Queue depth, job failure rate, execution time | Warn at queue depth > 100 for 10 minutes; page if any job type fails > 5% in 5 minutes. | Drain queue by scaling workers, pause non-essential job sources, investigate failing job payloads. |
| Database (Postgres) | CPU, memory, storage consumption, replication lag, connection pool usage | Warn at >75% storage or >80% connections; page at >90% storage or replication lag > 30s. | Add storage, clean old partitions, kill idle connections, ensure replicas healthy. |
| Object storage (MinIO) | Bucket size growth, object error responses, node health | Warn at >70% capacity; page at >85% or if node health degraded. | Expand cluster or archive data; restart unhealthy nodes; verify erasure coding. |
| Infrastructure | Node/pod health, cluster autoscaler events, TLS certificate expiry | Warn for nodes under pressure >10 minutes; page for unschedulable pods >15 minutes; alert at <21 days cert validity. | Rebalance workloads, investigate node resource leaks, renew certificates. |
| End-user experience | Real user monitoring (RUM) LCP/CLS, auth success rate | Warn at LCP > 3s for 5 minutes; page when auth success rate < 97% | Verify CDN/edge health, inspect identity provider status, communicate status to stakeholders. |

**Monitoring hygiene**

1. Every new service must publish metrics with consistent labels (`service`, `env`, `region`).
2. Dashboards live under `Observability > Treazr Island > Services` in Grafana; update them when adding new metrics.
3. Alerts must link to relevant runbooks; validate links quarterly.

## Backup Strategy

### Postgres

- **Snapshot cadence**: Nightly full logical dump (pg_dump) + hourly WAL archiving to durable object storage.
- **Retention**: Daily backups retained 30 days; weekly backups retained 6 months; WAL segments retained 14 days.
- **Validation**: Weekly restore test into isolated staging database; verify checksums and run smoke queries.
- **Encryption**: All backups encrypted at rest using KMS-managed keys; encryption keys rotated quarterly.
- **Restore playbook**:
  1. Freeze writes by placing app into maintenance mode.
  2. Provision clean Postgres instance with matching version.
  3. Restore latest full backup, then replay WAL up to desired timestamp.
  4. Run integrity checks, re-enable application traffic, monitor metrics.

### MinIO

- **Snapshot cadence**: Daily incremental replication to DR MinIO cluster using bucket replication; weekly full consistency scan.
- **Retention**: 60 days of replicated data; delete markers retained 30 days to allow undelete operations.
- **Validation**: Weekly checksum comparison between primary and DR clusters; monthly object restore test of representative sample.
- **Encryption**: Server-side encryption with per-bucket keys; keys rotated quarterly and stored in secure vault.
- **Restore playbook**:
  1. Identify affected buckets/objects and timestamp.
  2. Retrieve replicated objects from DR cluster or latest snapshot.
  3. Verify integrity via checksums before rehydration.
  4. Restore objects into primary cluster (or new cluster) and invalidate CDN caches as needed.

## Incident Response Steps

1. **Detect**: Alert fires via PagerDuty; acknowledge within 5 minutes.
2. **Triage**: On-call engineer assigns severity (SEV-1/2/3), captures context in incident doc, and identifies affected scope.
3. **Stabilize**: Mitigate customer impact (rollback deploy, scale infrastructure, failover services). Keep updates in #status channel every 15 minutes for SEV-1/2.
4. **Communicate**: Notify stakeholders (product, support, leadership) with status, ETA, and customer impact summary.
5. **Resolve**: Verify service health metrics return to baseline and customer impact is addressed.
6. **Document**: Close incident doc within 24 hours with timeline, root cause, and follow-up actions (tag owners and due dates).

## Disaster Recovery (DR) Drill Procedures

1. **Scope selection**: Rotate quarterly between Postgres failover, MinIO regional outage, and full Kubernetes control-plane loss.
2. **Preparation**: Announce drill 1 week prior, freeze risky deploys, ensure runbooks and credentials accessible.
3. **Execution**:
   - Simulate failure (e.g., disable primary Postgres endpoint).
   - Follow corresponding restore/failover playbook.
   - Record timing for detection, failover, validation, and traffic cutover.
4. **Validation**: Run automated smoke tests, verify data integrity, and confirm monitoring dashboards reflect new primary.
5. **Retrospective**: Within 48 hours document lessons learned, gaps, and action items. Track completion in DR backlog.

## Weekly Hygiene Review Checklist

1. ✅ Confirm monitoring alerts fired in last week have owners and postmortems (if required).
2. ✅ Review dashboard SLO compliance; open tickets for any SLO at risk.
3. ✅ Validate backup jobs succeeded; inspect logs for anomalies.
4. ✅ Ensure staging environment matches production configuration drift < 5%.
5. ✅ Check certificate expiry report for items expiring within 45 days.
6. ✅ Verify open security vulnerabilities (Snyk/dependency scan) have owners.
7. ✅ Update runbooks and contact lists if staffing changes occurred.

## Launch Logbook Template

Use this template for every feature or infrastructure launch to capture readiness and outcomes.

```
# Launch Logbook Entry
- Feature/Change:
- Owner(s):
- Date/Time window:
- Target environments:
- Success criteria:
- Monitoring plan:
- Rollback plan:
- Communications plan (internal/external):
- Pre-launch checklist (links to PRs, tests, approvals):
- Launch steps (timestamped):
- Outcome summary:
- Post-launch follow-ups:
```
