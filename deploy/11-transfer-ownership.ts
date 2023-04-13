import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { ethers } from 'hardhat';

const transferOwnershipToTimelock: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { get, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const timelockDeployment = await get('TimeLock');
  const multiERC20WeightedLockerDeployment = await get('MultiERC20WeightedLocker');
  const stakingDeployment = await get('Staking');

  const locker = await ethers.getContractAt(
    'MultiERC20WeightedLocker',
    multiERC20WeightedLockerDeployment.address,
  );
  if ((await locker.owner()) !== timelockDeployment.address) {
    await (
      await locker.transferOwnership(timelockDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  const staking = await ethers.getContractAt('Staking', stakingDeployment.address);
  const adminRole = await staking.DEFAULT_ADMIN_ROLE();
  if (!(await staking.hasRole(adminRole, timelockDeployment.address))) {
    log('Granting admin role to timelock contract');
    await (
      await staking.grantRole(adminRole, timelockDeployment.address)
    ).wait(networkConfig.confirmations);
  }
  if (await staking.hasRole(adminRole, deployer)) {
    log('Revoking deployer admin role from Staking');
    await (
      await staking.revokeRole(adminRole, deployer)
    ).wait(networkConfig.confirmations);
  }

  log('-----Ownership transferred to TimeLock-----');
};

export default transferOwnershipToTimelock;

transferOwnershipToTimelock.tags = ['staking', 'transferOwnership'];
