import { useEffect, useRef, useState } from "react";
import { ArrowRight, CircleHelp, X } from "lucide-react";
import type { useAllowanceWrites } from "../hooks/useAllowanceWrites";
import { displayTokenAmount } from "../lib/liveAllowances";
import { verificationLabels } from "../lib/allowanceWrites";

export function AllowanceChangeDialog({
  writes,
}: {
  writes: ReturnType<typeof useAllowanceWrites>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState("");
  const dialog = writes.dialog!;
  const transaction = writes.activity.find((entry) => entry.id === dialog.transactionId);
  useEffect(() => {
    const node = ref.current!;
    node.showModal();
    return () => node.close();
  }, []);
  const twoSteps =
    dialog.proposed !== null &&
    dialog.proposed > 0n &&
    dialog.pair.allowance > 0n;
  const confirmable =
    !writes.blocked &&
    ["review", "reset-ready", "rejected", "failed"].includes(dialog.phase) &&
    dialog.proposed !== null;
  return (
    <dialog
      ref={ref}
      className="dialog allowance-write-dialog"
      aria-labelledby="write-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        writes.store.close();
      }}
    >
      <div className="dialog-header">
        <h2 id="write-dialog-title">
          {dialog.kind === "revoke" ? "Revoke allowance" : "Edit allowance"}
        </h2>
        <button
          className="icon-button"
          onClick={() => writes.store.close()}
          aria-label="Close allowance dialog"
        >
          <X size={20} />
        </button>
      </div>
      <span className="dialog-demo">LIVE · BASE SEPOLIA TESTNET</span>
      <dl className="detail-data write-review">
        <div>
          <dt>Network</dt>
          <dd>Base Sepolia · 84532</dd>
        </div>
        <div className="address-detail">
          <dt>Owner</dt>
          <dd>{dialog.pair.owner}</dd>
        </div>
        <div className="address-detail">
          <dt>Token contract</dt>
          <dd>{dialog.pair.token}</dd>
        </div>
        <div className="address-detail">
          <dt>Spender</dt>
          <dd>{dialog.pair.spender}</dd>
        </div>
        <div>
          <dt>Current allowance</dt>
          <dd>
            {displayTokenAmount(dialog.pair.allowance, dialog.pair.decimals)}{" "}
            {dialog.pair.decimals === null
              ? ""
              : (dialog.pair.symbol ?? "token units")}
          </dd>
        </div>
        <div>
          <dt>Snapshot block</dt>
          <dd>{dialog.pair.blockNumber.toString()}</dd>
        </div>
        {dialog.proposed !== null && (
          <div>
            <dt>Proposed allowance</dt>
            <dd>
              {displayTokenAmount(dialog.proposed, dialog.pair.decimals)}{" "}
              {dialog.pair.decimals === null
                ? ""
                : (dialog.pair.symbol ?? "token units")}
            </dd>
          </div>
        )}
        {transaction && (
          <>
            <div>
              <dt>Requested allowance (this transaction)</dt>
              <dd>{displayTokenAmount(transaction.requested, transaction.pair.decimals)}{" "}
                {transaction.pair.decimals === null ? "" : (transaction.pair.symbol ?? "token units")}</dd>
            </div>
            <div>
              <dt>Actual allowance (receipt block)</dt>
              <dd>{transaction.actual
                ? `${displayTokenAmount(transaction.actual.allowance, transaction.actual.decimals)}${transaction.actual.decimals === null ? "" : ` ${transaction.actual.symbol ?? "token units"}`}`
                : "Not yet verified"}</dd>
            </div>
          </>
        )}
      </dl>
      {dialog.phase === "editing" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            writes.store.review(amount);
          }}
        >
          <label className="input-label" htmlFor="finite-allowance">
            New finite allowance ({dialog.pair.symbol ?? "token units"})
          </label>
          <input
            id="finite-allowance"
            className="amount-input"
            inputMode="decimal"
            autoFocus
            required
            value={amount}
            disabled={dialog.pair.decimals === null || writes.blocked}
            onChange={(event) => setAmount(event.target.value)}
            aria-describedby="finite-help"
          />
          <p id="finite-help" className="input-help">
            {dialog.pair.decimals === null
              ? "Decimals are unavailable. Close and refresh the token before editing."
              : `Up to ${dialog.pair.decimals} decimal places. Enter 0 to remove permission. No unlimited approval shortcut.`}
          </p>
          <button
            className="primary-button"
            disabled={dialog.pair.decimals === null || writes.blocked}
          >
            Review change <ArrowRight size={15} />
          </button>
        </form>
      )}
      <div className="simulation-note">
        <CircleHelp size={16} />
        <span>
          This is a real testnet transaction. Changing allowance changes the
          spender’s permission; it does not transfer your tokens. Each
          transaction costs Base Sepolia ETH for gas.
        </span>
      </div>
      {twoSteps && (
        <div className="write-steps">
          <strong>Two separate transactions</strong>
          <ol>
            <li>
              Reset this spender’s allowance to zero, then wait for a successful
              receipt and verification of zero.
            </li>
            <li>
              Click Continue to request the new finite allowance. Veto will not
              request this second transaction automatically.
            </li>
          </ol>
          <p>
            You can stop after the reset. The verified allowance will remain
            zero unless changed elsewhere.
          </p>
        </div>
      )}
      {dialog.resetVerified && (
        <p className="reset-verified">
          Reset confirmed · Zero allowance verified. Continue is optional.
        </p>
      )}
      {dialog.message && (
        <p
          className={`write-status phase-${dialog.phase}`}
          role="status"
          aria-live="polite"
        >
          <strong>{transaction?.status === "confirmed"
            ? `Transaction confirmed / ${verificationLabels[transaction.verification]}`
            : dialog.phase.replaceAll("-", " ")}</strong>
          <span>{dialog.message}</span>
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="secondary-button"
          onClick={() => writes.store.close()}
        >
          {writes.busy || dialog.phase === "confirmation-unknown"
            ? "Hide status"
            : dialog.resetVerified
              ? "Stop after reset"
              : "Close"}
        </button>
        {confirmable && (
          <button
            className="primary-button"
            onClick={() => void writes.store.confirm()}
          >
            {dialog.resetVerified
              ? "Continue · Submit new allowance"
              : twoSteps
                ? "Confirm reset to zero"
                : dialog.proposed === 0n
                  ? "Confirm revoke"
                  : "Confirm allowance"}
          </button>
        )}
        {transaction?.status === "confirmed" && transaction.verification === "unavailable" && (
          <button className="secondary-button" disabled={writes.busy}
            onClick={() => void writes.store.checkReceipt(transaction.id)}>
            Refresh verification
          </button>
        )}
      </div>
      {dialog.phase === "confirmation-unknown" && (
        <p className="wallet-helper">
          {transaction?.hash
            ? "Open Activity to check the existing receipt. No automatic transaction retry will occur."
            : "No hash is available to check a receipt. Inspect your wallet and explorer manually. Writes remain blocked; Veto will not unlock or submit again automatically."}
        </p>
      )}
      <p className="wallet-helper">
        History and transaction guards apply only to this page session. Reloading or leaving the dashboard
        can clear them; it does not cancel a submitted transaction. Recovery across reloads is not available.
      </p>
    </dialog>
  );
}
