import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { ethers } from 'hardhat';

const deployMocks: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  if (!networkConfig.deployMocks) {
    log('Skipping mocks deployment');
    return;
  }

  const mockUSDCDeployment = await deploy('MockUSDC', {
    from: deployer,
    args: [],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  log('-----Mocks deployed-----');

  const mockUSDC = await ethers.getContractAt('MockUSDC', mockUSDCDeployment.address);
  if ((await mockUSDC.balanceOf(deployer)).eq(0)) {
    await (
      await mockUSDC.mint(deployer, ethers.utils.parseUnits('1000000', 6))
    ).wait(networkConfig.confirmations);
  }
};

export default deployMocks;

deployMocks.tags = ['staking', 'mocks'];
