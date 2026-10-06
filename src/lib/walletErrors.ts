export function walletErrorMessage(
  error: unknown,
  action: "connect" | "switch" | "disconnect",
): string {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const cause = current as { code?: number; name?: string; cause?: unknown };
    if (cause.code === 4001 || cause.name === "UserRejectedRequestError") {
      return action === "switch"
        ? "Network switch declined. Your wallet is still on its current network."
        : "Connection declined. You can choose a wallet and try again.";
    }
    if (cause.code === -32002)
      return "A request is already pending in your wallet. Open the wallet to approve or decline it.";
    if (cause.name === "ProviderNotFoundError")
      return "No browser wallet was found. Install or enable a wallet extension, then refresh the wallet list.";
    if (cause.name === "SwitchChainNotSupportedError" || cause.code === 4200)
      return "This wallet cannot switch networks here. Select Base Sepolia in your wallet, then return to Veto.";
    current = cause.cause;
  }
  return action === "switch"
    ? "Could not switch networks. Try again, or select Base Sepolia in your wallet."
    : action === "disconnect"
      ? "Could not disconnect. Try again or disconnect Veto in your wallet."
      : "Could not connect to the wallet. Check that it is unlocked and try again.";
}
