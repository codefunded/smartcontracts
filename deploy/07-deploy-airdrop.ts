import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployAirdrop: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, get, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const dividendTokenDeployment = await get('DividendToken');
  const dividendToken = await ethers.getContractAt(
    'DividendToken',
    dividendTokenDeployment.address,
  );

  const airdropDeployment = await deploy('MerkleClaimableAirdrop', {
    from: deployer,
    args: [dividendToken.address, networkConfig.AIRDROP_ROOT],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(airdropDeployment.address, airdropDeployment.args!);
  }
  await dividendToken.transfer(
    airdropDeployment.address,
    ethers.utils.parseEther('1400000'), // amount claimable by users
  );

  log('-----Airdrop deployed-----');
};

export default deployAirdrop;
