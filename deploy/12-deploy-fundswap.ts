import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';

const deployFundSwap: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  await deploy('FundSwap', {
    from: deployer,
    args: [0],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  log('-----FundSwap deployed-----');
};

export default deployFundSwap;

deployFundSwap.tags = ['fundswap'];
