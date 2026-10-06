import { maxUint256, parseUnits } from "viem";
import type { Hash } from "viem";
import { baseSepolia } from "viem/chains";
import type { CheckedPair, WalletScope } from "./liveAllowances";

export function parseFiniteAllowance(
  input: string,
  decimals: number | null,
): bigint {
  if (decimals === null)
    throw new Error("Token decimals are unavailable. Edit is disabled.");
  const value = input.trim();
  if (!/^\d+(\.\d+)?$/.test(value))
    throw new Error(
      "Enter an explicit non-negative amount. Scientific notation and negative values are not supported.",
    );
  if ((value.split(".")[1]?.length ?? 0) > decimals)
    throw new Error(`Use no more than ${decimals} decimal places.`);
  if (value.length > 400) throw new Error("The amount is outside uint256.");
  const raw = parseUnits(value, decimals);
  if (raw > maxUint256) throw new Error("The amount is outside uint256.");
  if (raw === maxUint256)
    throw new Error(
      "Enter an amount below maxUint256. Unlimited approval is not available in this flow.",
    );
  return raw;
}

export type Phase =
  | "editing"
  | "review"
  | "reading"
  | "simulating"
  | "awaiting-wallet"
  | "pending"
  | "reset-ready"
  | "confirmed"
  | "rejected"
  | "reverted"
  | "failed"
  | "confirmation-unknown"
  | "invalidated"
  | "unchanged";
export type TxStatus =
  | "awaiting-wallet"
  | "pending"
  | "confirmed"
  | "rejected"
  | "reverted"
  | "failed"
  | "confirmation-unknown"
  | "replaced";
export type WriteDialog = {
  id: number;
  open: boolean;
  pair: CheckedPair;
  kind: "edit" | "revoke";
  proposed: bigint | null;
  phase: Phase;
  resetVerified: boolean;
  message: string;
};
export type LiveTransaction = {
  id: number;
  scopeKey: string;
  pair: CheckedPair;
  step: "reset" | "set" | "revoke";
  requested: bigint;
  desired: bigint;
  status: TxStatus;
  hash?: Hash;
  blockNumber?: bigint;
  actual?: CheckedPair;
  message: string;
  time: string;
};
export type ReceiptOutcome = {
  hash: Hash;
  blockNumber: bigint;
  status: "success" | "reverted" | "replaced";
};
export type WriteDependencies = {
  read: (pair: CheckedPair, blockNumber?: bigint) => Promise<CheckedPair>;
  assertWallet: (pair: CheckedPair) => Promise<void>;
  prepare: (pair: CheckedPair, amount: bigint) => Promise<() => Promise<Hash>>;
  receipt: (hash: Hash) => Promise<ReceiptOutcome>;
  observed: (pair: CheckedPair) => void;
};
type Snapshot = {
  scope: WalletScope | null;
  dialog: WriteDialog | null;
  activity: readonly LiveTransaction[];
  busy: boolean;
  message: string;
};

function errorDetails(error: unknown): {
  rejected: boolean;
  insufficient: boolean;
  definitive: boolean;
  message: string;
} {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const item = current as {
      code?: number;
      name?: string;
      message?: string;
      cause?: unknown;
    };
    if (item.code === 4001 || item.name === "UserRejectedRequestError")
      return {
        rejected: true,
        insufficient: false,
        definitive: true,
        message:
          "Request rejected in the wallet. No transaction hash was returned.",
      };
    if (
      item.name === "InsufficientFundsError" ||
      item.message?.toLowerCase().includes("insufficient funds")
    )
      return {
        rejected: false,
        insufficient: true,
        definitive: true,
        message:
          "Insufficient Base Sepolia ETH for testnet gas. No transaction hash was returned.",
      };
    if (
      [
        "WalletContextChangedError",
        "ChainMismatchError",
        "ConnectorAccountNotFoundError",
      ].includes(item.name ?? "")
    )
      return {
        rejected: false,
        insufficient: false,
        definitive: true,
        message:
          "Account or network changed. No transaction was requested. Refresh and start a new confirmation.",
      };
    current = item.cause;
  }
  return {
    rejected: false,
    insufficient: false,
    definitive: false,
    message: error instanceof Error ? error.message : "The request failed.",
  };
}

export class AllowanceWrites {
  private generation = 0;
  private nextId = 0;
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = {
    scope: null,
    dialog: null,
    activity: [],
    busy: false,
    message: "",
  };
  constructor(private readonly deps: WriteDependencies) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private dialog(patch: Partial<WriteDialog>, id: number) {
    if (this.snapshot.dialog?.id === id)
      this.publish({ dialog: { ...this.snapshot.dialog, ...patch } });
  }
  private updateEntry(id: number, patch: Partial<LiveTransaction>) {
    this.publish({
      activity: this.snapshot.activity.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    });
  }
  private sameContext(pair: CheckedPair, generation: number) {
    return (
      generation === this.generation &&
      this.snapshot.scope?.key ===
        `${pair.chainId}:${pair.owner.toLowerCase()}` &&
      pair.chainId === baseSepolia.id
    );
  }
  private unresolved() {
    return this.snapshot.activity.some(
      (entry) =>
        entry.status === "pending" ||
        entry.status === "awaiting-wallet" ||
        entry.status === "confirmation-unknown" ||
        (entry.status === "confirmed" && !entry.actual),
    );
  }
  isBlocked() {
    return this.snapshot.busy || this.unresolved();
  }
  setScope(scope: WalletScope | null) {
    if (scope?.key === this.snapshot.scope?.key) return;
    this.generation++;
    this.publish({
      scope,
      message: "",
      dialog: this.snapshot.dialog
        ? {
            ...this.snapshot.dialog,
            open: false,
            phase: "invalidated",
            message:
              "Account or network changed. Start a new confirmation for the current wallet. Already submitted transactions remain in their original account’s activity.",
          }
        : null,
    });
  }
  begin(pair: CheckedPair, kind: "edit" | "revoke") {
    if (this.isBlocked() || !this.sameContext(pair, this.generation)) return;
    if (kind === "edit" && pair.decimals === null) return;
    if (kind === "revoke" && pair.allowance === 0n) return;
    this.publish({
      dialog: {
        id: ++this.nextId,
        open: true,
        pair,
        kind,
        proposed: kind === "revoke" ? 0n : null,
        phase: kind === "revoke" ? "review" : "editing",
        resetVerified: false,
        message: "",
      },
      message: "",
    });
  }
  review(input: string) {
    const dialog = this.snapshot.dialog;
    if (!dialog || dialog.phase !== "editing" || this.isBlocked()) return;
    try {
      const proposed = parseFiniteAllowance(input, dialog.pair.decimals);
      this.dialog({ proposed, phase: "review", message: "" }, dialog.id);
    } catch (error) {
      this.dialog({ message: errorDetails(error).message }, dialog.id);
    }
  }
  close() {
    const dialog = this.snapshot.dialog;
    if (!dialog) return;
    const message = this.isBlocked()
      ? "Wallet requests or submitted transactions are not cancelled by hiding this dialog. Follow their status in Activity."
      : dialog.resetVerified
        ? "Reset was confirmed. The last verified allowance is zero. No new allowance transaction was submitted."
        : "";
    this.publish({ dialog: { ...dialog, open: false }, message });
  }
  async confirm() {
    const dialog = this.snapshot.dialog;
    if (
      !dialog ||
      dialog.proposed === null ||
      this.isBlocked() ||
      !["review", "reset-ready", "rejected", "failed"].includes(dialog.phase)
    )
      return;
    const generation = this.generation;
    if (!this.sameContext(dialog.pair, generation)) return;
    this.publish({ busy: true });
    this.dialog(
      {
        phase: "reading",
        message:
          "Re-reading the current allowance before requesting a transaction…",
      },
      dialog.id,
    );
    let entry: LiveTransaction | undefined;
    let submitting = false;
    try {
      await this.deps.assertWallet(dialog.pair);
      const pair = await this.deps.read(dialog.pair);
      if (!this.sameContext(pair, generation)) return;
      this.deps.observed(pair);
      if (
        dialog.kind === "edit" &&
        (pair.decimals === null || pair.decimals !== dialog.pair.decimals)
      ) {
        this.dialog(
          {
            pair,
            phase: "editing",
            proposed: null,
            resetVerified: false,
            message:
              "Token decimals changed or became unavailable. Re-enter an amount using the current metadata.",
          },
          dialog.id,
        );
        return;
      }
      if (pair.allowance !== dialog.pair.allowance) {
        this.dialog(
          {
            pair,
            phase: "review",
            resetVerified: false,
            message:
              "The allowance changed since your snapshot. Review the updated allowance and confirm again. No transaction was requested.",
          },
          dialog.id,
        );
        return;
      }
      if (pair.allowance === dialog.proposed) {
        this.dialog(
          {
            pair,
            phase: "unchanged",
            message:
              "The allowance already equals this amount. No transaction is needed.",
          },
          dialog.id,
        );
        return;
      }
      const step =
        dialog.proposed === 0n
          ? "revoke"
          : pair.allowance > 0n
            ? "reset"
            : "set";
      const amount = step === "reset" ? 0n : dialog.proposed;
      this.dialog(
        {
          pair,
          phase: "simulating",
          message: `Simulating ${step === "reset" ? "the reset to zero" : "approve"} before opening your wallet…`,
        },
        dialog.id,
      );
      const submit = await this.deps.prepare(pair, amount);
      if (!this.sameContext(pair, generation)) return;
      await this.deps.assertWallet(pair);
      if (!this.sameContext(pair, generation)) return;
      entry = {
        id: ++this.nextId,
        scopeKey: `${pair.chainId}:${pair.owner.toLowerCase()}`,
        pair,
        step,
        requested: amount,
        desired: dialog.proposed,
        status: "awaiting-wallet",
        time: new Date().toISOString(),
        message:
          "Waiting for your wallet. A transaction has not been confirmed.",
      };
      this.publish({ activity: [entry, ...this.snapshot.activity] });
      this.dialog(
        {
          phase: "awaiting-wallet",
          message:
            "Awaiting wallet confirmation. Check the account and Base Sepolia network in your wallet.",
        },
        dialog.id,
      );
      submitting = true;
      const hash = await submit();
      this.updateEntry(entry.id, {
        hash,
        status: "pending",
        message: "Transaction submitted. Waiting for a receipt.",
      });
      if (this.sameContext(pair, generation))
        this.dialog(
          {
            phase: "pending",
            message:
              "Transaction pending on Base Sepolia. Do not submit it again.",
          },
          dialog.id,
        );
      await this.monitor(entry.id, hash, dialog.id, generation);
    } catch (error) {
      const details = errorDetails(error);
      const phase = details.rejected
        ? "rejected"
        : submitting && !details.definitive
          ? "confirmation-unknown"
          : "failed";
      const suffix = dialog.resetVerified
        ? " The reset was already confirmed; the last verified allowance remains zero."
        : "";
      const message =
        phase === "confirmation-unknown"
          ? "The wallet request returned no reliable transaction outcome. Check your wallet and explorer before any further submission. Veto will not retry automatically."
          : details.message + suffix;
      if (entry) this.updateEntry(entry.id, { status: phase, message });
      if (this.sameContext(dialog.pair, generation))
        this.dialog({ phase, message }, dialog.id);
    } finally {
      this.publish({ busy: false });
    }
  }
  private async monitor(
    entryId: number,
    hash: Hash,
    dialogId: number | undefined,
    generation: number,
  ) {
    const entry = this.snapshot.activity.find((item) => item.id === entryId)!;
    let receipt: ReceiptOutcome;
    try {
      receipt = await this.deps.receipt(hash);
    } catch {
      this.updateEntry(entryId, {
        status: "confirmation-unknown",
        message:
          "Receipt unavailable or timed out. This is not proof of failure. Check receipt to resume observation; no transaction will be resubmitted.",
      });
      if (dialogId && this.sameContext(entry.pair, generation))
        this.dialog(
          {
            phase: "confirmation-unknown",
            message:
              "Confirmation is unknown. The transaction may still be pending or confirmed. Use Check receipt in Activity; do not submit it again.",
          },
          dialogId,
        );
      return;
    }
    this.updateEntry(entryId, {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === "success" ? "confirmed" : receipt.status,
      message:
        receipt.status === "reverted"
          ? "Transaction reverted. Testnet gas may still have been spent."
          : receipt.status === "replaced"
            ? "The wallet replaced or cancelled this transaction. No next transaction will be requested."
            : "Receipt confirmed. Reading the actual allowance and balance…",
    });
    if (receipt.status !== "success") {
      if (dialogId && this.sameContext(entry.pair, generation))
        this.dialog(
          {
            phase: receipt.status === "reverted" ? "reverted" : "failed",
            message:
              receipt.status === "reverted"
                ? "Transaction reverted. No next step will be requested."
                : "Transaction replaced or cancelled. Refresh the allowance before starting a new change.",
          },
          dialogId,
        );
      return;
    }
    await this.verify(entryId, dialogId, generation);
  }
  private async verify(
    entryId: number,
    dialogId: number | undefined,
    generation: number,
  ) {
    const entry = this.snapshot.activity.find((item) => item.id === entryId)!;
    try {
      const actual = await this.deps.read(entry.pair, entry.blockNumber);
      const message = `Receipt confirmed. Actual raw allowance: ${actual.allowance}. Actual raw balance: ${actual.balance}. Verified at block ${actual.blockNumber}.`;
      this.updateEntry(entryId, { actual, message });
      if (!this.sameContext(entry.pair, generation)) return;
      this.deps.observed(actual);
      if (dialogId) {
        if (
          entry.step === "reset" &&
          (actual.decimals === null || actual.decimals !== entry.pair.decimals)
        ) {
          this.dialog(
            {
              pair: actual,
              resetVerified: actual.allowance === 0n,
              proposed: null,
              phase: "failed",
              message:
                "Reset receipt confirmed, but token decimals changed or became unavailable. Refresh the token and start a new finite-amount confirmation. No second transaction was requested.",
            },
            dialogId,
          );
          return;
        }
        if (entry.step === "reset")
          this.dialog(
            {
              pair: actual,
              resetVerified: actual.allowance === 0n,
              phase: actual.allowance === 0n ? "reset-ready" : "failed",
              message:
                actual.allowance === 0n
                  ? "Reset confirmed and zero allowance verified. The allowance remains zero until you click Continue and confirm the second transaction."
                  : "Reset receipt confirmed, but the actual allowance is not zero. The second transaction is blocked. Review the actual result.",
            },
            dialogId,
          );
        else
          this.dialog(
            {
              pair: actual,
              resetVerified: false,
              phase: "confirmed",
              message:
                actual.allowance === entry.requested
                  ? "Receipt confirmed. The displayed allowance and balance are verified onchain."
                  : "Receipt confirmed, but the actual allowance differs from the requested amount. The displayed result is the actual onchain value.",
            },
            dialogId,
          );
      }
    } catch {
      this.updateEntry(entryId, {
        message:
          "Receipt confirmed, but allowance/balance verification failed. Refresh verification before relying on the requested amount.",
      });
      if (dialogId && this.sameContext(entry.pair, generation))
        this.dialog(
          {
            phase: "failed",
            message:
              "Receipt confirmed, but actual allowance verification failed. No next transaction is allowed until verification succeeds. Use Refresh verification in Activity.",
          },
          dialogId,
        );
    }
  }
  async checkReceipt(id: number) {
    if (this.snapshot.busy) return;
    const entry = this.snapshot.activity.find((item) => item.id === id);
    if (!entry?.hash) return;
    const dialog = this.snapshot.dialog;
    const matchingDialog =
      dialog &&
      dialog.pair.key === entry.pair.key &&
      dialog.proposed === entry.desired
        ? dialog.id
        : undefined;
    this.publish({ busy: true });
    try {
      if (entry.status === "confirmed")
        await this.verify(id, matchingDialog, this.generation);
      else await this.monitor(id, entry.hash, matchingDialog, this.generation);
    } finally {
      this.publish({ busy: false });
    }
  }
}
