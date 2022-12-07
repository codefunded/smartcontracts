import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';

const deployTokens: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const micTokenDeployment = await deploy('DividendToken', {
    from: deployer,
    args: ['MilkyIce', 'MIC', 10_000_000],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (!networkConfig.isLocal) {
    await verifyContract(micTokenDeployment.address, micTokenDeployment.args!);
  }

  const mintableDeployment = await deploy('MintableToken', {
    from: deployer,
    args: ['MilkyIce ICE', 'ICE'],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (!networkConfig.isLocal) {
    await verifyContract(mintableDeployment.address, mintableDeployment.args!);
  }

  log('-----Tokens deployed-----');
};

export default deployTokens;
