# Capacity and launch status

The requested target is **100,000 simultaneous players**. This release is not certified for that load. No paid hosting change or 100,000-user traffic test is authorized. A successful functional deployment or local benchmark does not establish that capacity.

The game renders and simulates on each phone/browser. There are no per-frame server calls or persistent sockets. A normal online run makes one ticket request and one score submission. Offline runs and temporarily unavailable scores remain playable. Leaderboard reads cache for 60 seconds, and all queries are indexed and bounded to 25 results. Failed score submissions retain a small local retry queue; no player-facing operation waits indefinitely.

The backend signs run tickets with a server-only HMAC key and replays the submitted controls. It rejects modified tickets, impossible elapsed time, invalid inputs, incomplete runs, and oversized bodies. It stores the computed score rather than a client-provided score. It does not prove a player is human: an automated perfect pilot can generate a valid replay. Do not use these scores for cash prizes.

At an average 60-second run, 100,000 continuously active players imply approximately **3,334 write-oriented API requests/second**, before leaderboard traffic and burst allowance. A 30-second average doubles that figure. The current Sites deployment uses one D1 database; **that database is a capacity bottleneck**, and this implementation must not be marketed as supporting 100,000 concurrent ranked sessions.

Cloudflare states that each D1 database processes queries one at a time; throughput depends on query duration. Workers Free has a daily request limit. These facts apply to Cloudflare accounts and do not establish the quota or SLA supplied by Sites hosting. Confirm the actual Sites limits with the provider before advertising capacity.

Sources checked 2026-10-23:

- [D1 concurrency and throughput](https://developers.cloudflare.com/d1/reference/faq/)
- [Workers account limits](https://developers.cloudflare.com/workers/platform/limits/)

Before a 100,000-concurrent launch:

1. Obtain a paid hosting budget and provider quota/SLA confirmation. Choose a provider that exposes sharded durable storage, queues, edge rate limiting, and monitoring.
2. Replace the single D1 score writer with a partitioned ingestion layer (for example, 64 player-hash partitions backed by durable workers and a queue). Keep score aggregation off the request path. Use an idempotent event key and a bounded queue with explicit overload responses. The current `handleAPI` boundary is the integration point; this infrastructure is not provisioned in this release.
3. Set edge rate limits based on player/session identity as well as IP. The current per-isolate IP limiter and circuit breaker are defense-in-depth, not a global traffic limit. Carrier NAT users may share an IP and need revised limits.
4. Configure alerts for error rate, latency, queue age, rejected writes, database saturation, and spend. Test secret rotation, rollback, database export/restore, and an outage drill.
5. Run `tools/loadtest.js` on an isolated staging deployment with distributed generators, increasing through 100, 1,000, 10,000, and 100,000 users. Test admission, submission, cached reads, cold starts, traffic spikes, dependency failure, and a sustained soak. The supplied defaults are 50 users; a large run is explicitly gated.
6. Define launch thresholds with the hosting provider. Candidate targets: less than 0.1% errors, API p95 below 500 ms, and no lost acknowledged scores. These are proposed acceptance criteria, not measured results.
7. Add bounded scheduled retention for obsolete daily boards, and a user-facing online-data deletion workflow before broad account-based distribution. Local reset currently removes local progress only; pseudonymous server best scores remain.

The unsigned app bundle and iPhone source also require store review, owner signing, privacy declarations, and physical-device checks. None of those approvals are implied by a successful local build.
