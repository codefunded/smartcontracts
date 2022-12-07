import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig, REWARD_RATE } from '../utils/networkConfigs';
import { ethers } from 'hardhat';
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

  const dividendToken = await get('DividendToken');
  const mintableToken = await get('MintableToken');

  const usdcAddress =
    networkConfig.existingContracts?.usdcToken || (await get('MockUSDC')).address;

  const stakingDeployment = await deploy('Staking', {
    from: deployer,
    args: [dividendToken.address, usdcAddress],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (!networkConfig.isLocal) {
    await verifyContract(stakingDeployment.address, stakingDeployment.args!);
  }

  const mintStakingDeployment = await deploy('MintStaking', {
    from: deployer,
    args: [dividendToken.address, mintableToken.address, REWARD_RATE],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (!networkConfig.isLocal) {
    await verifyContract(mintStakingDeployment.address, mintStakingDeployment.args!);
  }

  const iceToken = await ethers.getContractAt('MintableToken', mintableToken.address);
  await iceToken.grantRole(await iceToken.MINTER_ROLE(), mintStakingDeployment.address);

  log('-----Staking contracts deployed-----');
};

export default deployStaking;
