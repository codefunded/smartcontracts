import { time } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { addLiquidityToPair } from '../../addLiquidityToPair';
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
    micToken,
    micTokenPermit,
    usdcToken,
    stakingContract,
    mintStakingContract,
    iceToken,
  };
};

export const prepareFullTestEnv = async () => {
  const { micToken, micTokenPermit, usdcToken } = await distributeTokens();

  const [user1] = await ethers.getSigners();

  const GovernanceTokenFactory = await ethers.getContractFactory(
    'GovernanceDividendTokenWrapper',
  );
  const governanceToken = await GovernanceTokenFactory.deploy('Governance MIC', 'gMIC');

  const lpPairAddress = await createDexPair({
    token0: micToken.address,
    token1: usdcToken.address,
  });

  const micUsdcLpPair = await ethers.getContractAt('IUniswapV2Pair', lpPairAddress);

  await addLiquidityToPair({
    token0: micToken,
    token1: usdcToken,
    amount0: ethers.utils.parseEther('100'),
    amount1: ethers.utils.parseUnits('125', 6),
    userAddress: user1.address,
  });

  const MultiERC20WeightedLockerFactory = await ethers.getContractFactory(
    'MultiERC20WeightedLocker',
  );

  const oracleFactory = await ethers.getContractFactory('UniswapV2TwapOracle');
  const oracle = await oracleFactory.deploy(
    getNetworkConfig('31337').existingContracts.gelatoAutomate!,
    micUsdcLpPair.address,
    time.duration.hours(6),
  );
  await time.increase(time.duration.hours(6));
  await oracle.update();
  await time.increase(time.duration.hours(6));

  const lockableAssets = [
    {
      token: micToken.address,
      isEntitledToVote: true,
      isLPToken: false,
      lockPeriods: [
        { durationInSeconds: 0, rewardModifier: 10000 },
        { durationInSeconds: time.duration.days(90), rewardModifier: 10200 },
        { durationInSeconds: time.duration.days(180), rewardModifier: 10500 },
        { durationInSeconds: time.duration.days(360), rewardModifier: 11200 },
      ],
      dividendTokenFromPair: ethers.constants.AddressZero,
      priceOracle: ethers.constants.AddressZero,
    },
    {
      token: lpPairAddress,
      isEntitledToVote: false,
      isLPToken: true,
      lockPeriods: [
        { durationInSeconds: 0, rewardModifier: 10000 },
        { durationInSeconds: time.duration.days(90), rewardModifier: 11220 },
        { durationInSeconds: time.duration.days(180), rewardModifier: 11550 },
        { durationInSeconds: time.duration.days(360), rewardModifier: 12320 },
      ],
      dividendTokenFromPair: micToken.address,
      priceOracle: oracle.address,
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
    getNetworkConfig('31337').existingContracts.gelatoAutomate!,
    staking.address,
  );
  await periodStarter.grantRole(periodStarter.SCHEDULER_ROLE(), user.address);

  const liquidatorFactory = await ethers.getContractFactory('StaleDepositLiquidator');
  const liquidator = await liquidatorFactory.deploy(
    getNetworkConfig('31337').existingContracts.gelatoAutomate!,
    locker.address,
  );

  return {
    micToken,
    micTokenPermit,
    usdcToken,
    staking,
    locker,
    governanceToken,
    micUsdcLpPair,
    oracle,
    periodStarter,
    liquidator,
  };
};
