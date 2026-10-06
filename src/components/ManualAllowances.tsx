import { useState } from "react";
import {
  ArrowUpRight,
  CircleHelp,
  Infinity as InfinityIcon,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { FormEvent } from "react";
import type { useAllowanceWrites } from "../hooks/useAllowanceWrites";
import type { useManualAllowances } from "../hooks/useManualAllowances";
import { ApprovalScanPanel } from "./ApprovalScan";
import { displayTokenAmount, exposure } from "../lib/liveAllowances";

export function ManualAllowances({
  checks,
  writes,
  supported,
}: {
  checks: ReturnType<typeof useManualAllowances>;
  writes: ReturnType<typeof useAllowanceWrites>;
  supported: boolean;
}) {
  const [showRevoked, setShowRevoked] = useState(false);
  const visible = checks.results.filter(
    (row) => showRevoked || row.allowance > 0n,
  );
  const [token, setToken] = useState("");
  const [spender, setSpender] = useState("");
  const disabled =
    !checks.enabled || checks.pending || checks.scan.status === "loading";
  function submit(event: FormEvent) {
    event.preventDefault();
    void checks.check(token, spender);
  }
  return (
    <section className="manual-allowances" aria-labelledby="manual-heading">
      <ApprovalScanPanel checks={checks} />
      <div className="section-title">
        <div>
          <h2 id="manual-heading">Check allowance</h2>
          <p>Manual check · Selected token and spender only.</p>
        </div>
        <span className="sample-note">Read-only</span>
      </div>
      <form
        className="allowance-check-form"
        onSubmit={submit}
        aria-busy={checks.pending}
      >
        <div>
          <label className="input-label" htmlFor="token-address">
            Token contract address
          </label>
          <input
            id="token-address"
            className="address-input"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            required
            disabled={!checks.enabled || checks.scan.status === "loading"}
            aria-describedby="check-help"
          />
        </div>
        <div>
          <label className="input-label" htmlFor="spender-address">
            Spender address
          </label>
          <input
            id="spender-address"
            className="address-input"
            value={spender}
            onChange={(event) => setSpender(event.target.value)}
            placeholder="0x…"
            autoComplete="off"
            spellCheck={false}
            required
            disabled={!checks.enabled || checks.scan.status === "loading"}
            aria-describedby="check-help"
          />
        </div>
        <button className="primary-button" type="submit" disabled={disabled}>
          <Search size={15} />
          {checks.pending ? "Checking…" : "Check"}
        </button>
      </form>
      <p className="wallet-helper" id="check-help">
        Owner: your connected wallet. A spender can be a contract or a regular
        account. The token must contain contract code.
      </p>
      {!supported && (
        <p className="exposure-warning">
          Checks are disabled. Connect your wallet on Base Sepolia to continue.
        </p>
      )}
      <p className="check-status" role="status" aria-live="polite">
        {checks.message}
      </p>
      {checks.error && (
        <p className="form-error check-error" role="alert">
          {checks.error} Existing rows, if any, remain snapshots of their
          displayed blocks.
        </p>
      )}
      <div className="checked-results-toolbar">
        <p>
          Manual + scanned pairs · Verified rows only · Each row shows its
          snapshot block.
        </p>
        <label className="show-revoked">
          <input
            type="checkbox"
            checked={showRevoked}
            onChange={(event) => setShowRevoked(event.target.checked)}
          />{" "}
          Show revoked
        </label>
      </div>
      {checks.results.length > 0 && (
        <>
          <p className="checked-summary-label">
            Summary · {checks.results.length} successfully verified unique{" "}
            {checks.results.length === 1 ? "pair" : "pairs"} only
          </p>
          <div
            className="summary-grid live-summary"
            aria-label="Checked pairs summary"
          >
            {[
              [
                "Active checked approvals",
                checks.results.filter(
                  (row) => exposure(row.balance, row.allowance).active,
                ).length,
                <ShieldCheck size={18} />,
              ],
              [
                "Unlimited checked approvals",
                checks.results.filter(
                  (row) => exposure(row.balance, row.allowance).unlimited,
                ).length,
                <InfinityIcon size={18} />,
              ],
              [
                "Checked approvals above balance",
                checks.results.filter(
                  (row) => exposure(row.balance, row.allowance).aboveBalance,
                ).length,
                <ArrowUpRight size={18} />,
              ],
            ].map(([label, value, icon]) => (
              <div className="summary-card" key={String(label)}>
                <div className="summary-top">
                  {label}
                  <span className="card-icon">{icon}</span>
                </div>
                <div className="summary-value">{value}</div>
                <div className="summary-bottom">Selected pairs only</div>
              </div>
            ))}
          </div>
          <div className="context-banner">
            <CircleHelp size={17} />
            <p>
              Unlimited and above-balance allowances describe exposure. They do
              not prove a spender is malicious.
            </p>
          </div>
          {visible.length === 0 && (
            <div className="empty-state">
              <h3>No active approvals in verified results.</h3>
              <p>
                Use Show revoked to see zero allowances. Scan coverage is
                limited to the displayed token and range.
              </p>
            </div>
          )}
          <p className="mobile-table-hint">
            Swipe to see amounts and actions <ArrowUpRight size={12} />
          </p>
          <div
            className="table-scroll checked-table"
            tabIndex={0}
            role="region"
            aria-label="Verified live allowances"
          >
            <table>
              <thead>
                <tr>
                  <th>Token contract</th>
                  <th>Spender</th>
                  <th>Wallet balance</th>
                  <th>Current allowance</th>
                  <th>Block</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const state = exposure(row.balance, row.allowance);
                  return (
                    <tr key={row.key}>
                      <td>
                        <strong className="checked-token-name">
                          {row.symbol ?? "Unknown symbol"}
                        </strong>
                        <span className="checked-metadata">
                          {row.name ?? "Name unavailable"}
                        </span>
                        <span className="checked-address">{row.token}</span>
                        <span className="checked-metadata">
                          {row.decimals === null
                            ? "Decimals unavailable · raw integer values"
                            : `Decimals: ${row.decimals}`}
                        </span>
                      </td>
                      <td>
                        <span className="checked-address">{row.spender}</span>
                      </td>
                      <td>
                        <span className="checked-amount">
                          {displayTokenAmount(row.balance, row.decimals)}
                        </span>
                        <span className="allowance-note">
                          {row.decimals === null
                            ? "Raw integer · no decimal scaling"
                            : (row.symbol ?? "Token units")}
                        </span>
                      </td>
                      <td>
                        <span className="checked-amount">
                          {state.unlimited ? (
                            <>
                              <InfinityIcon size={16} /> Unlimited
                            </>
                          ) : (
                            displayTokenAmount(row.allowance, row.decimals)
                          )}
                        </span>
                        {state.unlimited && (
                          <span className="checked-raw">
                            Raw allowance: {row.allowance.toString()}
                          </span>
                        )}
                        <span
                          className={`allowance-note ${state.aboveBalance ? "exposure" : ""}`}
                        >
                          Exceeds balance: {state.aboveBalance ? "Yes" : "No"}
                          {row.allowance === 0n
                            ? " · No spending permission"
                            : ""}
                        </span>
                      </td>
                      <td>
                        <span className="checked-block">
                          {row.blockNumber.toString()}
                        </span>
                        <span className="allowance-note">Base Sepolia</span>
                      </td>
                      <td>
                        <div className="checked-actions">
                          <button
                            className="edit-button"
                            disabled={disabled}
                            onClick={() =>
                              void checks.check(row.token, row.spender)
                            }
                            aria-label={`Refresh allowance for ${row.token} and ${row.spender}`}
                          >
                            <RefreshCw size={12} /> Refresh
                          </button>
                          <div className="row-actions">
                            <button
                              className="edit-button"
                              disabled={
                                disabled ||
                                writes.blocked ||
                                row.decimals === null
                              }
                              onClick={() => writes.store.begin(row, "edit")}
                            >
                              Edit
                            </button>
                            <button
                              className="revoke-button"
                              disabled={
                                disabled ||
                                writes.blocked ||
                                row.allowance === 0n
                              }
                              onClick={() => writes.store.begin(row, "revoke")}
                            >
                              Revoke
                            </button>
                          </div>
                          <span className="allowance-note">
                            {row.decimals === null
                              ? "Edit unavailable · Decimals missing"
                              : "Confirmation required · Testnet gas"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span>
              {visible.length} visible / {checks.results.length} verified unique
              pairs · Each row is a block snapshot
            </span>
            <span>USDC range scan + selected manual pairs only</span>
          </div>
        </>
      )}
      {checks.results.length === 0 && (
        <div className="empty-state manual-empty">
          <Search size={25} />
          <h3>No pairs checked yet.</h3>
          <p>
            Scan the selected USDC range or check one token and spender
            manually. No whole-wallet scan has been performed.
          </p>
        </div>
      )}
    </section>
  );
}
