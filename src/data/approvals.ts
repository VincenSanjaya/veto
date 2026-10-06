export type Approval = {
  id: string;
  token: string;
  tokenName: string;
  decimals: number;
  color: string;
  spender: string;
  category: string;
  address: `0x${string}`;
  balance: string;
  allowance: string | "unlimited";
};

export const sampleWallet = "0x71C4D3eA95b06fF28a82C905D6549aEF3712b8A6";

// Synthetic spenders; these addresses are examples, not verified deployments.
export const initialApprovals: Approval[] = [
  {
    id: "1",
    token: "USDC",
    tokenName: "USD Coin",
    decimals: 6,
    color: "blue",
    spender: "Orbit Swap",
    category: "Token exchange",
    address: "0x1111111111111111111111111111111111111111",
    balance: "2450",
    allowance: "unlimited",
  },
  {
    id: "2",
    token: "WETH",
    tokenName: "Wrapped Ether",
    decimals: 18,
    color: "violet",
    spender: "Arc Lending",
    category: "Lending market",
    address: "0x2222222222222222222222222222222222222222",
    balance: "1.28",
    allowance: "5",
  },
  {
    id: "3",
    token: "DAI",
    tokenName: "Dai",
    decimals: 18,
    color: "amber",
    spender: "Meadow Vault",
    category: "Token vault",
    address: "0x3333333333333333333333333333333333333333",
    balance: "860",
    allowance: "unlimited",
  },
  {
    id: "4",
    token: "USDC",
    tokenName: "USD Coin",
    decimals: 6,
    color: "blue",
    spender: "Ripple Route",
    category: "Payment router",
    address: "0x4444444444444444444444444444444444444444",
    balance: "2450",
    allowance: "500",
  },
  {
    id: "5",
    token: "UNI",
    tokenName: "Uniswap",
    decimals: 18,
    color: "pink",
    spender: "Prism Pool",
    category: "Liquidity pool",
    address: "0x5555555555555555555555555555555555555555",
    balance: "125",
    allowance: "250",
  },
  {
    id: "6",
    token: "WETH",
    tokenName: "Wrapped Ether",
    decimals: 18,
    color: "violet",
    spender: "North Bridge",
    category: "Token bridge",
    address: "0x6666666666666666666666666666666666666666",
    balance: "1.28",
    allowance: "0.5",
  },
];
