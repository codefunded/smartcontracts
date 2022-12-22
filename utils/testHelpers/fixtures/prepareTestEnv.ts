import { ethers } from 'hardhat';
import { createDexPair } from '../../createDexPair';
import { getNetworkConfig } from '../../networkConfigs';
import { deployMintStakingContract } from './deployMintStakingContract';
import { deployStakingContract } from './deployStakingContract';
import { distributeTokens } from './distributeTokens';

/**
 * Simple test env, which deploys staking contracts and distributes tokens. Deployer is the owner of
 * staking contracts and tokens.
 */
export const prepareSimpleTestEnv = async () => {
  const { micToken, micTokenPermit, usdcToken } = await distributeTokens();
  const { stakingContract } = await deployStakingContract(micToken, usdcToken);
  const { mintStakingContract, iceToken } = await deployMintStakingContract(micToken);

  return {
    stakingContract,
    micToken,
    micTokenPermit,
    usdcToken,
    mintStakingContract,
    iceToken,
  };
};

export const prepareFullTestEnv = async () => {
  const { micToken, micTokenPermit, usdcToken } = await distributeTokens();

  const GovernanceTokenFactory = await ethers.getContractFactory(
    'GovernanceDividendTokenWrapper',
  );
  const governanceToken = await GovernanceTokenFactory.deploy('Governance MIC', 'gMIC');

  const lpPairAddress = await createDexPair({
    token0: micToken.address,
    token1: usdcToken.address,
  });

  const micUsdcLpPair = await ethers.getContractAt('IUniswapV2Pair', lpPairAddress);

  const MultiERC20WeightedLockerFactory = await ethers.getContractFactory(
    'MultiERC20WeightedLocker',
  );
  const lockableAssets = [
    {
      token: micToken.address,
      baseRewardModifier: 10000,
      isEntitledToVote: true,
      isLPToken: false,
    },
    {
      token: lpPairAddress,
      baseRewardModifier: 11000,
      isEntitledToVote: false,
      isLPToken: true,
    },
  ];
  const locker = await MultiERC20WeightedLockerFactory.deploy(
    'Staked MIC',
    'stMIC',
    lockableAssets,
    governanceToken.address,
  );
  await governanceToken.transferOwnership(locker.address);

  const StakingFactory = await ethers.getContractFactory('Staking');
  const staking = await StakingFactory.deploy(locker.address, usdcToken.address);
  await staking.grantRole(staking.LOCKER_ROLE(), locker.address);
  const [user] = await ethers.getSigners();
  await staking.grantRole(staking.PERIOD_STARTER(), user.address);
  await locker.addStakingContract(staking.address);

  const periodStarterFactory = await ethers.getContractFactory('PeriodStarter');
  const periodStarter = await periodStarterFactory.deploy(
    getNetworkConfig('31337').existingContracts.gelatoAutomate,
    staking.address,
  );
  await periodStarter.grantRole(periodStarter.SCHEDULER_ROLE(), user.address);

  return {
    micToken,
    micTokenPermit,
    usdcToken,
    staking,
    locker,
    governanceToken,
    micUsdcLpPair,
    periodStarter,
  };
};
