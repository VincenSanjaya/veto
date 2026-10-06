import { getAddress, isAddress, zeroAddress } from "viem";
import type { Address } from "viem";
import { baseSepolia } from "viem/chains";
import type { CheckedPair, WalletScope } from "./liveAllowances";

export const SCAN_TOKEN: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const SCAN_BLOCKS = 50_000n;
export type ScanStatus =
  "idle" | "loading" | "complete" | "partial" | "cancelled" | "failed";
export type ScanSnapshot = {
  status: ScanStatus;
  from: bigint | null;
  to: bigint | null;
  coveredTo: bigint | null;
  discovered: number;
  verified: number;
  failedPairs: number;
  message: string;
  error: string;
};
type Discovery = { owner: Address; spender: Address; value: bigint };
export type ScanDependencies = {
  block: () => Promise<bigint>;
  logs: (
    scope: WalletScope,
    from: bigint,
    to: bigint,
  ) => Promise<readonly Discovery[]>;
  read: (
    scope: WalletScope,
    spender: Address,
    block: bigint,
  ) => Promise<CheckedPair>;
  accept: (pair: CheckedPair) => void;
};
function rangeLimited(error: unknown) {
  return /range|too many|limit exceeded|response size|block span|more than|query returned/i.test(
    error instanceof Error ? error.message : String(error),
  );
}
const idle = (): ScanSnapshot => ({
  status: "idle",
  from: null,
  to: null,
  coveredTo: null,
  discovered: 0,
  verified: 0,
  failedPairs: 0,
  message: "",
  error: "",
});

// Scope and run generations discard late RPC responses, including account A → B → A.
export class ApprovalScan {
  private scope: WalletScope | null = null;
  private generation = 0;
  private snapshot = idle();
  private listeners = new Set<() => void>();
  constructor(private readonly deps: ScanDependencies) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<ScanSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  setScope(scope: WalletScope | null) {
    if (scope?.key === this.scope?.key) return;
    this.scope = scope;
    this.generation++;
    this.snapshot = idle();
    this.publish({});
  }
  cancel() {
    if (this.snapshot.status !== "loading") return;
    this.generation++;
    this.publish({
      status: "cancelled",
      message:
        "Scan cancelled · Partial coverage only. Verified rows are retained.",
    });
  }
  async start() {
    const scope = this.scope;
    if (
      !scope ||
      scope.chainId !== baseSepolia.id ||
      this.snapshot.status === "loading"
    )
      return;
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    this.snapshot = idle();
    this.publish({
      status: "loading",
      message: "Fetching the Base Sepolia snapshot block…",
    });
    let logFailed = false;
    try {
      const to = await this.deps.block();
      if (!current()) return;
      const from = to >= SCAN_BLOCKS - 1n ? to - SCAN_BLOCKS + 1n : 0n;
      this.publish({ from, to });
      const seen = new Set<string>();
      let cursor = from;
      let chunk = 2_000n;
      while (cursor <= to) {
        let events: readonly Discovery[] | undefined;
        let end = cursor;
        for (let attempt = 0; attempt < 5; attempt++) {
          end = cursor + chunk - 1n > to ? to : cursor + chunk - 1n;
          this.publish({
            message: `Reading Approval logs ${cursor}–${end} · Attempt ${attempt + 1}/5`,
          });
          try {
            events = await this.deps.logs(scope, cursor, end);
            break;
          } catch (error) {
            if (!current()) return;
            if (attempt === 4) throw error;
            if (rangeLimited(error) && chunk > 125n) chunk = chunk / 2n;
            // Sequential, bounded retries; no overlapping requests or automatic whole-scan restart.
            await new Promise((resolve) =>
              setTimeout(resolve, 200 * (attempt + 1)),
            );
          }
          if (!current()) return;
        }
        if (!current()) return;
        this.publish({ coveredTo: end });
        for (const event of events ?? []) {
          if (
            event.owner.toLowerCase() !== scope.owner.toLowerCase() ||
            !isAddress(event.spender) ||
            event.spender.toLowerCase() === zeroAddress
          )
            continue;
          const spender = getAddress(event.spender);
          const key = spender.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          this.publish({
            discovered: seen.size,
            message: `Verifying discovered pair ${seen.size} at snapshot block ${to}…`,
          });
          try {
            const pair = await this.deps.read(scope, spender, to);
            if (!current()) return;
            this.deps.accept(pair);
            this.publish({ verified: this.snapshot.verified + 1 });
          } catch (error) {
            if (!current()) return;
            this.publish({
              failedPairs: this.snapshot.failedPairs + 1,
              error:
                error instanceof Error
                  ? error.message
                  : "Pair verification failed.",
            });
          }
        }
        cursor = end + 1n;
      }
    } catch (error) {
      if (!current()) return;
      logFailed = true;
      this.publish({
        error: `Scan stopped after bounded retries. ${error instanceof Error ? error.message : "Base Sepolia RPC request failed."}`,
      });
    }
    if (!current()) return;
    const partial = logFailed || this.snapshot.failedPairs > 0;
    this.publish({
      status: partial
        ? this.snapshot.coveredTo === null
          ? "failed"
          : "partial"
        : "complete",
      message: partial
        ? "Partial results · Only successful log coverage and verified pairs are shown."
        : "Selected USDC range complete · This is not a whole-wallet scan.",
    });
  }
}
