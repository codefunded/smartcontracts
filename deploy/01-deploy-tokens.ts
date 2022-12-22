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

  const mintableTokenDeployment = await deploy('MintableToken', {
    from: deployer,
    args: ['MilkyIce ICE', 'ICE'],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (!networkConfig.isLocal) {
    await verifyContract(mintableTokenDeployment.address, mintableTokenDeployment.args!);
  }

  const governanceTokenDeployment = await deploy('GovernanceDividendTokenWrapper', {
    from: deployer,
    args: ['Governance MilkyIce', 'gMIC'],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (!networkConfig.isLocal) {
    await verifyContract(
      governanceTokenDeployment.address,
      governanceTokenDeployment.args!,
    );
  }

  log('-----Tokens deployed-----');
};

export default deployTokens;
