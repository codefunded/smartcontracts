import { ethers } from 'ethers';

export const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
export const USDC_WHALE = '0xf977814e90da44bfa03b6295a0616a897441acec';

/// To get 1 new token in a year you need to stake 5 tokens
/// reward / seconds_in_period * required_stake_to_get_1_reward_token
/// 1 ICE / (31_556_926s * 5MIC) = 0.000000006337752923
export const REWARD_RATE = ethers.utils.parseEther('0.000000006337752923');

export const VESTING_START_TIMESTAMP_IN_SECONDS = 1680343098; // 1 of April 2023

type NetworkConfig = {
  chainId: number;
  name: string;
  deployMocks: boolean;
  existingContracts: {
    usdcToken?: string;
    pairFactoryCreator?: string;
    dexRouter?: string;
    gelatoAutomate?: string;
  };
  confirmations: number;
  shouldVerifyContracts: boolean;
  TEAM_ADDRESS: string;
  AIRDROP_ROOT: string;
  VESTING_START_TIMESTAMP: number;
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
    deployMocks: true,
    existingContracts: {
      pairFactoryCreator: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', // Sushiswap factory
      dexRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Sushiswap router
      gelatoAutomate: '0x527a819db1eb0e34426297b03bae11F2f8B3A19E',
    },
    confirmations: 1,
    shouldVerifyContracts: false,
    TEAM_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    AIRDROP_ROOT: '0xa3d214ce3f418ac1f421084d23e3daaaacb558cbd4a4c88f6b30656f784cd9e0',
    VESTING_START_TIMESTAMP: VESTING_START_TIMESTAMP_IN_SECONDS,
  },
  '137': {
    chainId: 137,
    name: 'polygon',
    deployMocks: false,
    existingContracts: {
      usdcToken: USDC_ADDRESS,
      gelatoAutomate: '0x527a819db1eb0e34426297b03bae11F2f8B3A19E',
    },
    confirmations: 20,
    shouldVerifyContracts: true,
    TEAM_ADDRESS: ethers.constants.AddressZero,
    AIRDROP_ROOT: ethers.constants.AddressZero,
    VESTING_START_TIMESTAMP: VESTING_START_TIMESTAMP_IN_SECONDS,
  },
  '80001': {
    chainId: 80001,
    name: 'mumbai',
    deployMocks: true,
    existingContracts: {
      pairFactoryCreator: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', // Sushiswap factory
      dexRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // Sushiswap router
      gelatoAutomate: '0xB3f5503f93d5Ef84b06993a1975B9D21B962892F',
    },
    confirmations: 3,
    shouldVerifyContracts: false,
    TEAM_ADDRESS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    AIRDROP_ROOT: '0xa3d214ce3f418ac1f421084d23e3daaaacb558cbd4a4c88f6b30656f784cd9e0',
    VESTING_START_TIMESTAMP: VESTING_START_TIMESTAMP_IN_SECONDS,
  },
};
