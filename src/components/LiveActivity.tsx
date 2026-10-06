import { ArrowUpRight, History, RefreshCw } from "lucide-react";
import { baseSepolia } from "viem/chains";
import type { useAllowanceWrites } from "../hooks/useAllowanceWrites";
import { displayTokenAmount } from "../lib/liveAllowances";

export function LiveActivity({
  writes,
}: {
  writes: ReturnType<typeof useAllowanceWrites>;
}) {
  return (
    <section
      className="live-transactions"
      aria-label="Live transaction activity"
    >
      <div className="section-title">
        <div>
          <h2>
            Live Activity <span>{writes.activity.length}</span>
          </h2>
          <p>Base Sepolia · Current account only · This page session</p>
        </div>
      </div>
      {writes.activity.length === 0 ? (
        <div className="empty-state">
          <History size={27} />
          <h3>No allowance transactions yet.</h3>
          <p>
            Manually checking an allowance does not create a transaction. Demo
            activity stays separate.
          </p>
        </div>
      ) : (
        <ul className="activity-list">
          {writes.activity.map((entry) => (
            <li key={entry.id}>
              <span className="activity-icon">
                <ArrowUpRight size={18} />
              </span>
              <div className="live-activity-content">
                <h3>
                  {entry.step === "reset"
                    ? "Reset allowance to zero"
                    : entry.step === "revoke"
                      ? "Revoke allowance"
                      : "Set finite allowance"}
                  <span className={`transaction-tag status-${entry.status}`}>
                    {entry.status.replaceAll("-", " ")}
                  </span>
                </h3>
                <p>
                  Token:{" "}
                  <span className="activity-address">{entry.pair.token}</span>
                </p>
                <p>
                  Spender:{" "}
                  <span className="activity-address">{entry.pair.spender}</span>
                </p>
                <p>
                  Requested:{" "}
                  {displayTokenAmount(entry.requested, entry.pair.decimals)}{" "}
                  {entry.pair.decimals === null
                    ? ""
                    : (entry.pair.symbol ?? "token units")}
                </p>
                {entry.actual && (
                  <p>
                    Verified allowance:{" "}
                    {displayTokenAmount(
                      entry.actual.allowance,
                      entry.actual.decimals,
                    )}{" "}
                    · Balance:{" "}
                    {displayTokenAmount(
                      entry.actual.balance,
                      entry.actual.decimals,
                    )}{" "}
                    · Block {entry.actual.blockNumber.toString()}
                  </p>
                )}
                <p className="transaction-message">{entry.message}</p>
                {entry.hash ? (
                  <a
                    className="transaction-link"
                    href={`${baseSepolia.blockExplorers.default.url}/tx/${entry.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {entry.hash} <ArrowUpRight size={13} />
                    <span>View on Base Sepolia explorer</span>
                  </a>
                ) : (
                  <span className="activity-disclaimer">
                    No transaction hash returned.{" "}
                    {entry.status === "rejected"
                      ? "Wallet request was rejected."
                      : "Check the status above."}
                  </span>
                )}
                {entry.hash &&
                  (entry.status === "confirmation-unknown" ||
                    (entry.status === "confirmed" && !entry.actual)) && (
                    <button
                      className="secondary-button receipt-check"
                      disabled={writes.busy}
                      onClick={() => void writes.store.checkReceipt(entry.id)}
                    >
                      <RefreshCw size={14} />
                      {entry.status === "confirmed"
                        ? "Refresh verification"
                        : "Check receipt"}
                    </button>
                  )}
              </div>
              <time dateTime={entry.time}>
                {new Date(entry.time).toLocaleTimeString("en", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
