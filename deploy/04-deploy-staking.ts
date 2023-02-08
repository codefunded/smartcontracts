import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig, REWARD_RATE } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';

const deployStaking: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, get, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const multiERC20WeightedLockerDeployment = await get('MultiERC20WeightedLocker');
  const mintableToken = await get('MintableToken');
  const timelockDeployment = await get('TimeLock');

  const usdcAddress =
    networkConfig.existingContracts?.usdcToken || (await get('MockUSDC')).address;

  const stakingDeployment = await deploy('Staking', {
    from: deployer,
    args: [multiERC20WeightedLockerDeployment.address, usdcAddress],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(stakingDeployment.address, stakingDeployment.args!);
  }

  const mintStakingDeployment = await deploy('MintStaking', {
    from: deployer,
    args: [
      multiERC20WeightedLockerDeployment.address,
      mintableToken.address,
      REWARD_RATE,
    ],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(mintStakingDeployment.address, mintStakingDeployment.args!);
  }

  const iceToken = await ethers.getContractAt('MintableToken', mintableToken.address);
  if (!(await iceToken.hasRole(iceToken.MINTER_ROLE(), mintStakingDeployment.address))) {
    log('Granting minter role to mint staking contract');
    await (
      await iceToken.grantRole(iceToken.MINTER_ROLE(), mintStakingDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  const locker = await ethers.getContractAt(
    'MultiERC20WeightedLocker',
    multiERC20WeightedLockerDeployment.address,
  );

  try {
    await locker.stakingContracts(0);
  } catch {
    log('Adding Staking contract to locker');
    await (
      await locker.addStakingContract(stakingDeployment.address)
    ).wait(networkConfig.confirmations);
  }
  try {
    await locker.stakingContracts(1);
  } catch {
    log('Adding MintStaking contract to locker');
    await (
      await locker.addStakingContract(mintStakingDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  const staking = await ethers.getContractAt('Staking', stakingDeployment.address);
  if (
    !(await staking.hasRole(
      staking.LOCKER_ROLE(),
      multiERC20WeightedLockerDeployment.address,
    ))
  ) {
    log('Granting locker role to MultiERC20WeightedLocker contract');
    await (
      await staking.grantRole(
        staking.LOCKER_ROLE(),
        multiERC20WeightedLockerDeployment.address,
      )
    ).wait(networkConfig.confirmations);
  }

  const mintStaking = await ethers.getContractAt(
    'MintStaking',
    mintStakingDeployment.address,
  );
  if ((await locker.owner()) === deployer) {
    log('Transferring ownership of MintStaking to MultiERC20WeightedLocker');
    await (
      await mintStaking.transferOwnership(multiERC20WeightedLockerDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  if ((await locker.owner()) === deployer) {
    log('Transferring ownership of MultiERC20WeightedLocker to TimeLock');
    await locker.transferOwnership(timelockDeployment.address);
  }

  log('-----Staking contracts deployed-----');
};

export default deployStaking;

deployStaking.tags = ['staking'];
