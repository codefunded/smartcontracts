import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployTokens: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const MAX_SUPPLY = ethers.utils.parseEther(Number(10_000_000).toString());

  const micTokenDeployment = await deploy('DividendToken', {
    from: deployer,
    args: ['MilkyIce', 'MIC', MAX_SUPPLY],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(micTokenDeployment.address, micTokenDeployment.args!);
  }

  const mintableTokenDeployment = await deploy('MintableToken', {
    from: deployer,
    args: ['MilkyIce ICE', 'ICE'],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(mintableTokenDeployment.address, mintableTokenDeployment.args!);
  }

  const governanceTokenDeployment = await deploy('GovernanceDividendTokenWrapper', {
    from: deployer,
    args: ['Governance MilkyIce', 'gMIC'],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(
      governanceTokenDeployment.address,
      governanceTokenDeployment.args!,
    );
  }

  log('-----Tokens deployed-----');
};

export default deployTokens;
