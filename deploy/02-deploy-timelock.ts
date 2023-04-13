import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { time } from '@nomicfoundation/hardhat-network-helpers';

const deployTimelock: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const timelockDeployment = await deploy('TimeLock', {
    from: deployer,
    args: [time.duration.hours(24), [deployer], [deployer]],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(timelockDeployment.address, timelockDeployment.args!);
  }

  log('-----TimeLock deployed-----');
};

export default deployTimelock;

deployTimelock.tags = ['staking', 'timelock'];
