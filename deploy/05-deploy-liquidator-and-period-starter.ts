import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployLiquidatorAndPeriodStarter: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, get, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const lockerDeployment = await get('MultiERC20WeightedLocker');
  const stakingDeploymentAddress = await get('Staking');

  if (!networkConfig.existingContracts?.gelatoAutomate) {
    log(
      'Gelato Automate address not found in network config, skipping deployment of automation dependent contracts',
    );
    log('----------');
    return;
  }

  const staleDepositLiquidatorDeployment = await deploy('StaleDepositLiquidator', {
    from: deployer,
    args: [networkConfig.existingContracts.gelatoAutomate, lockerDeployment.address],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(
      staleDepositLiquidatorDeployment.address,
      staleDepositLiquidatorDeployment.args!,
    );
  }

  const staking = await ethers.getContractAt('Staking', stakingDeploymentAddress.address);
  const periodStarterDeployment = await deploy('PeriodStarter', {
    from: deployer,
    args: [networkConfig.existingContracts.gelatoAutomate, staking.address],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(periodStarterDeployment.address, periodStarterDeployment.args!);
  }

  if (
    !(await staking.hasRole(staking.PERIOD_STARTER(), periodStarterDeployment.address))
  ) {
    log('Granting period starter role to period starter contract');
    await (
      await staking.grantRole(staking.PERIOD_STARTER(), periodStarterDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  log('-----Stale deposit liquidator and period starter deployed-----');
};

export default deployLiquidatorAndPeriodStarter;

deployLiquidatorAndPeriodStarter.tags = ['staking', 'liquidator', 'periodStarter'];
