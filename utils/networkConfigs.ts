import { ethers } from 'ethers';

export const MIC_ADDRESS = '0x296480179b8b79c9C9588b275E69d58f0d1BCa67';
export const MIC_WHALE = '0x59186dea2cc06c04676a14f6a0c77914dd9594fe';
export const WETH_ADDRESS = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619';
export const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
export const USDC_WHALE = '0x6e685a45db4d97ba160fa067cb81b40dfed47245';
export const WETH_WHALE = '0xdeD8C5159CA3673f543D0F72043E4c655b35b96A';

/// To get 1 new token in a year you need to stake 5 tokens
/// reward / seconds_in_period * required_stake_to_get_1_reward_token
/// 1 ICE / (31_556_926s * 5MIC) = 0.000000006337752923
export const REWARD_RATE = ethers.utils.parseEther('0.000000006337752923');

const existingContracts = {
  micToken: MIC_ADDRESS,
  usdcToken: USDC_ADDRESS,
  wethToken: WETH_ADDRESS,
};

type NetworkConfig = {
  chainId: number;
  name: string;
  deployMocks: boolean;
  existingContracts?: typeof existingContracts;
  confirmations: number;
  isLocal: boolean;
};

export const getNetworkConfig = (chainId: string): NetworkConfig => {
  const networkConfig = NETWORK_CONFIGS[chainId];
  if (!networkConfig) {
    throw new Error(`No network config found for chainId ${chainId}`);
  }
  return networkConfig;
};

export const NETWORK_CONFIGS: { [chainId: string]: NetworkConfig | undefined } = {
  '31337': {
    chainId: 31337,
    name: 'localhost/hardhat',
    deployMocks: false, // it is a fork of the polygon mainnet
    existingContracts,
    confirmations: 1,
    isLocal: true,
  },
  '137': {
    chainId: 137,
    name: 'polygon',
    deployMocks: false,
    existingContracts,
    confirmations: 20,
    isLocal: false,
  },
  '80001': {
    chainId: 80001,
    name: 'mumbai',
    deployMocks: true,
    confirmations: 20,
    isLocal: false,
  },
};
