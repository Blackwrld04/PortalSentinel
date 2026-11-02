# PortalSentinel — Production Hardening Plan

> Goal: move PortalSentinel from a convincing hackathon demo to a service that a node
> operator can run 24/7 without losing funds, leaking keys, or lying to users about what
> it detects. This is a hardening track, not a rewrite: the contract/daemon/dashboard
> split stays.

## 1. Current-state assessment

> This table is the pre-hardening baseline that motivated the sprint. See §1a for what
> has since landed on `feat/production-hardening`.

| Area | What works today | What blocks production |
|---|---|---|
| Contracts | Registry, executor, mock token, mock drainer compile; 6 Foundry tests pass | Batch revoke silently reports success when the token has no guardian hook; no pause; sweep accounting is a counter named `totalValueRescuedCount`; guardian key is all-powerful; no invariant/fuzz tests |
| Detection | Block poller reacts to `AttackInitiated` from the mock fixture | No real mempool/allowance monitoring; only the demo contract can trigger a signal; logs are not filtered by emitter, so any contract can spoof the event |
| Scoring | Three additive rules → 100/100 | Score is effectively constant; ignores the user's on-chain policy mode (hardcoded BALANCED); no velocity, reputation, or allowance features |
| Dispatch | 1.35× gas price, single send | No nonce manager, no retry/gas bump, no timeout, no idempotency; duplicate daemons double-send |
| Config/secrets | `.env` support | Hard-coded Anvil key in `config.ts`, `docker-compose.yml`, and the deploy script; no validation; secrets can leak into logs |
| Ops | Prometheus `/metrics`, `/health`, Dockerfile | Docker build is broken (`npm ci` at root without a lockfile); compose maps the wrong port; healthcheck hits the RPC instead of the daemon; no persistence, no leader election, no RPC failover |
| CLI | `health`, `audit`, `matrix`, `benchmark`, `telegram:test` | `audit` calls `isShieldActive` and a 7-field policy tuple that do not exist on the deployed registry; `matrix` prints thresholds that contradict the code; Telegram `/audit` returns a hard-coded safe report |
| Frontend | Polished dashboard, wallet connect, allowance scanner | Demo-only labels ("LIVE MEMPOOL"), hard-coded fallback addresses, no error boundary, no tests |
| Tests/CI | Foundry + typecheck + build in GitHub Actions | No daemon unit tests, no frontend tests, no fuzzing/invariants, no dependency or contract static analysis |

## 1a. P0 implementation status (branch `feat/production-hardening`)

Done and verified locally:

- **Secrets/config:** no default private key anywhere; key required only when `DRY_RUN=false`;
  RPC/chain/address/URL validation at startup; dry-run defaults on.
- **Contracts:** revoke verifies the allowance reached zero (and reverts if nothing was
  revoked); sweep enforces zero-custody against `msg.sender`/executor, tracks real rescued
  amounts, and reverts if nothing moved; registry is pausable; mock token cannot be revoked
  by a zero-address caller; the fake `simulateDefenseExecution` event path was removed;
  12 Foundry tests including a fuzz sweep invariant and sweep-accounting test.
- **Dispatcher:** `NonceManager`, pre-broadcast retries with 1.35×/1.60×/1.85× fees, receipt
  timeout without unsafe resend, in-flight idempotency keys, dry-run result type.
  **Fail-fast startup check:** executor→registry linkage, registry not paused, and the
  signer is an authorized guardian. **Preflight:** a recommended sweep falls back to a
  revoke when the victim has not approved the executor; a successful sweep triggers a
  best-effort residual-allowance revoke. Deterministic errors (`CALL_EXCEPTION`,
  `INSUFFICIENT_FUNDS`, bad nonce) are not retried.
- **Detection:** logs filtered by emitter and topic, real amount decoded, fail-fast on the
  initial RPC call, persisted block journal with atomic writes, batched catch-up
  (`PORTALDOT_LOG_RANGE_BLOCKS`, default 500).
- **Honesty:** dry-run/simulated/failure messages no longer claim a transaction exists; the
  dashboard walkthrough does not fabricate a tx hash; the browser no longer holds a Telegram
  bot token or calls the Telegram API (all alerts are daemon-side); README states the
  post-hoc detection limit.
- **Tests/CI:** 12 Foundry + 15 daemon unit tests pass; CI runs both, plus container builds.
- **End-to-end (local Anvil):** drain → detect → sweep remaining balance to the cold safe →
  revoke the residual allowance → metrics report one executed defense. Verified on a real
  EVM, not just unit tests.

Still open before calling this production-ready:

- Detection is post-hoc for the demo fixture: the event is emitted inside the drain tx, so
  the triggering transfer cannot be undone. P1 must inspect transactions/approvals before
  execution and run observe-only first.
- No spender allowlist/reputation yet, so generic detection would false-positive; that is why
  the listener is still scoped to `MOCK_EXPLOIT_ADDRESS`.
- Dockerfile/compose are written but the image build could not be verified here (no registry
  access in this environment).
- **Leaked Telegram bot token:** a bot token was committed to `frontend/src/App.tsx` in
  commit `2ab4515` and is still present in git history. It has been removed from the working
  tree, but it must be revoked with `@BotFather` and replaced, and the history should be
  rewritten before the repository is treated as public. Do not reuse the old token.
- Guardian key rotation, KMS/HSM, leader election, and an external audit remain P2/P3.

## 2. P0 — Safety and correctness (this sprint)

Acceptance: no hard-coded secrets; a failed revoke can never be reported as success; the
daemon cannot double-spend a nonce or silently drop a defense; every claim in the UI/logs
matches observed behavior.

1. **Secrets and config** (`daemon/src/config.ts`, `daemon/.env.example`, `docker-compose.yml`, `contracts/script/DeployPortalSentinel.s.sol`)
   - Remove every default private key. `GUARDIAN_PRIVATE_KEY` is required unless `DRY_RUN=true`.
   - Validate chain ID, RPC URL, contract addresses, thresholds, and Telegram config at startup; fail fast with actionable messages.
   - Add `DRY_RUN` mode that simulates dispatch without broadcasting.
   - Redact secrets from logs and health output.

2. **Contract correctness** (`contracts/src/SentinelRegistry.sol`, `contracts/src/DefenseExecutor.sol`, `contracts/src/MockERC20.sol`)
   - `executeEmergencyBatchRevoke` must verify the allowance actually reached zero and emit a failure event otherwise; revert when nothing was revoked.
   - `executeEmergencySweep` must enforce the zero-custody invariant against `msg.sender` and `address(this)`, track real rescued amounts, and revert when nothing moved.
   - Add owner-controlled pause on the registry; executor refuses defense while paused.
   - Remove the `guardianExecutor == address(0)` bypass from the mock token.
   - Pass the real threat score into the on-chain `ThreatNeutralized` event.

3. **Dispatcher resilience** (`daemon/src/dispatcher.ts`)
   - `NonceManager`, bounded retries with gas bump, receipt timeout, and in-flight idempotency keys.
   - EIP-1559 path when the RPC exposes `maxFeePerGas`; legacy path otherwise.
   - Structured result object that distinguishes sent / simulated / failed.

4. **Detection honesty** (`daemon/src/listener.ts`, `daemon/src/index.ts`)
   - Filter logs by the known emitter, decode the real event payload, and stop describing a 1-second block poll as a mempool.
   - Read the user's actual `DefenseMode` from the registry instead of hard-coding BALANCED.

5. **CLI drift** (`daemon/src/cli.ts`)
   - Fix `audit` to use `isProtected` and the real 5-field `UserPolicy`.
   - Derive `matrix` output from the scorer constants so it cannot drift again.
   - Remove the hard-coded Telegram `/audit` report; return a real "not implemented" or query the chain.

6. **Tests and CI**
   - Foundry: unsupported-token revoke failure, no-approval sweep, paused defense, zero-custody invariant, fuzz sweep amounts.
   - Daemon: `node:test` coverage for scorer thresholds and config validation.
   - CI: run daemon tests; add a Docker build job.

7. **Deployment**
   - Fix the Dockerfile (no root lockfile assumption, non-root user, healthcheck against `/health`).
   - Fix compose ports and require secrets from the environment.
   - Add `.dockerignore`.

## 3. P1 — Real detection engine (next sprint)

- **Transport:** `eth_subscribe("newHeads")` / `pendingTransactions` over WebSocket where
  Portaldot exposes it; HTTP block polling fallback with full transaction bodies.
- **Signals:** `Approval` events, `Transfer` events, `transferFrom` calldata, spender
  reputation/age, allowance-to-balance ratio, per-hour outflow velocity.
- **Policy:** read mode and limits from `SentinelRegistry` per user; cache with block tags.
- **Persistence:** last processed block and pending-defense journal in SQLite/Postgres so a
  restart does not replay or skip blocks.
- **Scorer v2:** weighted, explainable features; unit tests for every rule; calibration
  against recorded attack traces.
- **Detection metrics:** time-to-detect, time-to-dispatch, false-positive rate, missed-block
  count.

## 4. P2 — Operations and scale

- RPC failover pool with health scoring and circuit breakers.
- Leader election (Postgres advisory lock or Redis lease) so N daemon replicas do not
  double-send; per-user defense nonce on-chain as the final idempotency guard.
- Durable audit log: every signal, score, decision, tx hash, and outcome.
- Structured JSON logs; Prometheus alerts (RPC down, no blocks in N seconds, defense failed,
  queue depth); Grafana dashboard.
- KMS/HSM signer abstraction; key rotation runbook; per-environment guardian keys.
- Docker/Kubernetes manifests, resource limits, PodDisruptionBudget, secrets via files.
- Load tests: 10k protected users, 100 signals/s, 99.9% dispatch under 250 ms.

## 5. P3 — Product and compliance

- Replace demo simulator values with live data or label them clearly as simulations.
- Frontend: env-driven RPC/contracts, error boundaries, wallet/network mismatch handling,
  accessibility pass, Playwright smoke tests.
- Multi-chain adapter (Portaldot first, then other `pallet-revive` deployments).
- Threat model and incident-response runbook; user-facing limitations and ToS.
- External contract audit before any mainnet deployment with real funds.

## 6. Definition of done for "production scale"

- A compromised guardian key cannot move user funds anywhere except that user's registered
  cold safe, and cannot silently claim a defense succeeded.
- Two daemon replicas running concurrently produce exactly one defense transaction per
  incident.
- Killing the daemon mid-incident and restarting it neither replays nor skips the defense.
- Every alert links to a transaction that exists on-chain and a decision record that
  explains the score.
- `docker compose up` works from a clean clone with only a `.env` file.
- Foundry invariants, daemon unit tests, frontend smoke tests, and a Docker build all pass
  in CI.

## 7. Security assumptions and residual risks (read before mainnet)

- **The guardian is trusted.** The zero-custody invariant prevents theft, but a compromised
  guardian can still force-sweep a user's tokens into that user's emergency safe at any
  time, causing availability and gas costs. Guardian keys belong in KMS/HSM, not `.env`.
- **Sweep requires a prior approval.** The victim must approve the `DefenseExecutor` to
  spend their tokens. That approval is itself a centralization surface; document it in the
  UI and consider scoped allowance or permit-based rescue in P2.
- **The cold safe is user-supplied.** The contract cannot verify that the user controls it.
  A typo or social-engineering attack can send rescued funds to the wrong address. Add a
  two-step confirmation and a delay for safe changes.
- **No external audit yet.** The contracts are hardened but unaudited. Do not deploy with
  real funds before a professional review and a bug bounty.
- **Detection is heuristic.** False positives can trigger unnecessary sweeps; false
  negatives can miss real drains. Calibrate against recorded attacks and keep a manual
  kill switch (registry pause) available.
