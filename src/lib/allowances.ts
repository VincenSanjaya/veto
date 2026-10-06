import type { Approval } from "../data/approvals";

export const MAX_UINT256 = (1n << 256n) - 1n;

export function toUnits(value: string, decimals: number): bigint {
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  );
}

export function aboveBalance(approval: Approval): boolean {
  return (
    approval.allowance === "unlimited" ||
    toUnits(approval.allowance, approval.decimals) >
      toUnits(approval.balance, approval.decimals)
  );
}

export function active(approval: Approval): boolean {
  return (
    approval.allowance === "unlimited" ||
    toUnits(approval.allowance, approval.decimals) > 0n
  );
}

export function validateAllowance(
  value: string,
  decimals: number,
): string | null {
  if (!/^\d+(\.\d+)?$/.test(value))
    return "Enter a non-negative token amount, such as 100 or 0.5.";
  if ((value.split(".")[1]?.length ?? 0) > decimals)
    return `This token supports up to ${decimals} decimal places.`;
  if (value.length > 100 || toUnits(value, decimals) > MAX_UINT256)
    return "This amount exceeds the ERC20 allowance limit.";
  return null;
}

export function formatAmount(value: string): string {
  const [whole, fraction] = value.split(".");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction ? `.${fraction}` : "")
  );
}

export function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
