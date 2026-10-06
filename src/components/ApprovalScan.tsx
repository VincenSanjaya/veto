import { Radar, X, RefreshCw } from "lucide-react";
import type { useManualAllowances } from "../hooks/useManualAllowances";
import { SCAN_TOKEN } from "../lib/approvalScan";

export function ApprovalScanPanel({
  checks,
}: {
  checks: ReturnType<typeof useManualAllowances>;
}) {
  const scan = checks.scan;
  const loading = scan.status === "loading";
  const total =
    scan.from !== null && scan.to !== null ? scan.to - scan.from + 1n : 0n;
  const covered =
    scan.coveredTo !== null && scan.from !== null
      ? scan.coveredTo - scan.from + 1n
      : 0n;
  const percent = total > 0n ? Number((covered * 100n) / total) : 0;
  return (
    <section
      className="approval-scan-panel"
      aria-labelledby="scan-heading"
      aria-busy={loading}
    >
      <div className="section-title">
        <div>
          <h2 id="scan-heading">Scan approvals</h2>
          <p>USDC only · Last 50,000 blocks · Base Sepolia (84532)</p>
        </div>
        <span className="sample-note">Read-only</span>
      </div>
      <p className="scan-token">
        Token contract <span className="checked-address">{SCAN_TOKEN}</span>
      </p>
      <p className="wallet-helper">
        Discover spenders from your Approval events, then verify current
        permissions. Older approvals and other tokens are outside this scan.
      </p>
      <div className="scan-controls">
        <button
          className="primary-button"
          disabled={!checks.enabled || loading || checks.pending}
          onClick={() => void checks.startScan()}
        >
          {scan.status === "idle" || scan.status === "complete" ? (
            <Radar size={15} />
          ) : (
            <RefreshCw size={15} />
          )}
          {loading
            ? "Scanning…"
            : scan.status === "idle"
              ? "Scan approvals"
              : scan.status === "complete"
                ? "Scan again"
                : "Retry scan"}
        </button>
        {loading && (
          <button className="secondary-button" onClick={checks.cancelScan}>
            <X size={15} />
            Cancel scan
          </button>
        )}
      </div>
      {scan.from !== null && scan.to !== null && (
        <div className="scan-coverage">
          <p>
            Requested blocks:{" "}
            <strong>
              {scan.from.toString()}–{scan.to.toString()}
            </strong>{" "}
            · Snapshot: {scan.to.toString()}
          </p>
          <p>
            Successful log coverage:{" "}
            <strong>
              {scan.coveredTo === null
                ? "None yet"
                : `${scan.from}–${scan.coveredTo}`}
            </strong>{" "}
            · {covered.toString()} / {total.toString()} blocks
          </p>
          <progress
            max={100}
            value={percent}
            aria-label="Approval log scan progress"
          />
          <p>
            {scan.discovered} unique pairs discovered · {scan.verified} verified
            this scan · {scan.failedPairs} verification failures
          </p>
        </div>
      )}
      <p
        className={`check-status scan-status status-${scan.status}`}
        role="status"
        aria-live="polite"
      >
        {scan.message}
      </p>
      {scan.error && (
        <p className="form-error" role="alert">
          {scan.error} Unverified pairs are excluded from summaries. Retry
          starts a new range scan; existing verified rows stay at their
          displayed blocks.
        </p>
      )}
      {scan.status === "complete" && scan.discovered === 0 && (
        <p className="wallet-helper">
          No Approval events found for this owner in the selected USDC range.
          This does not prove there are no older allowances.
        </p>
      )}
      {scan.status === "complete" &&
        scan.discovered > 0 &&
        scan.verified > 0 && (
          <p className="wallet-helper">
            Zero allowances are hidden by default. Use Show revoked to inspect
            them.
          </p>
        )}
    </section>
  );
}
