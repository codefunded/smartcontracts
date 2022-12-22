import { ethers } from 'ethers';

export const MIC_ADDRESS = '0x296480179b8b79c9C9588b275E69d58f0d1BCa67';
export const MIC_WHALE = '0x59186dea2cc06c04676a14f6a0c77914dd9594fe';
export const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
export const USDC_WHALE = '0x6e685a45db4d97ba160fa067cb81b40dfed47245';

/// To get 1 new token in a year you need to stake 5 tokens
/// reward / seconds_in_period * required_stake_to_get_1_reward_token
/// 1 ICE / (31_556_926s * 5MIC) = 0.000000006337752923
export const REWARD_RATE = ethers.utils.parseEther('0.000000006337752923');

type NetworkConfig = {
  chainId: number;
  name: string;
  deployMocks: boolean;
  existingContracts: {
    micToken?: string;
    usdcToken?: string;
    pairFactoryCreator?: string;
    dexRouter?: string;
    gelatoAutomate: string;
  };
  confirmations: number;
  isLocal: boolean;
  TEAM_ADDRESS: string;
  AIRDROP_ROOT: string;
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
    existingContracts: {
      micToken: MIC_ADDRESS,
      usdcToken: USDC_ADDRESS,
      pairFactoryCreator: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', // Sushiswap factory
      dexRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Sushiswap router
      gelatoAutomate: '0x527a819db1eb0e34426297b03bae11F2f8B3A19E',
    },
    confirmations: 1,
    isLocal: true,
    TEAM_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    AIRDROP_ROOT: '0xe99467d027c1d99b544d929e378c5ecfc6b0e521f7cc79d93719111138a166eb',
  },
  '137': {
    chainId: 137,
    name: 'polygon',
    deployMocks: false,
    existingContracts: {
      micToken: MIC_ADDRESS,
      usdcToken: USDC_ADDRESS,
      gelatoAutomate: '0x527a819db1eb0e34426297b03bae11F2f8B3A19E',
    },
    confirmations: 20,
    isLocal: false,
    TEAM_ADDRESS: ethers.constants.AddressZero,
    AIRDROP_ROOT: ethers.constants.AddressZero,
  },
  '80001': {
    chainId: 80001,
    name: 'mumbai',
    deployMocks: true,
    existingContracts: {
      micToken: MIC_ADDRESS,
      usdcToken: USDC_ADDRESS,
      gelatoAutomate: '0xB3f5503f93d5Ef84b06993a1975B9D21B962892F',
    },
    confirmations: 20,
    isLocal: false,
    TEAM_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    AIRDROP_ROOT: '0xe99467d027c1d99b544d929e378c5ecfc6b0e521f7cc79d93719111138a166eb',
  },
};
