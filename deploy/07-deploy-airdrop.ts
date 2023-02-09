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
  const usdcAddress =
    networkConfig.existingContracts?.usdcToken || (await get('MockUSDC')).address;
  const timelockDeployment = await get('TimeLock');

  const airdropDeployment = await deploy('MerkleClaimableAirdrop', {
    from: deployer,
    args: [dividendToken.address, usdcAddress, networkConfig.AIRDROP_ROOT],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(airdropDeployment.address, airdropDeployment.args!);
  }

  const airdrop = await ethers.getContractAt(
    'MerkleClaimableAirdrop',
    airdropDeployment.address,
  );
  if ((await dividendToken.balanceOf(airdropDeployment.address)).eq(0)) {
    log('Transferring tokens to airdrop contract');
    await (
      await dividendToken.transfer(
        airdropDeployment.address,
        ethers.utils.parseEther('1400000'), // amount claimable by users
      )
    ).wait(networkConfig.confirmations);
  }

  const usdc = await ethers.getContractAt('IERC20', usdcAddress);
  if ((await usdc.balanceOf(airdropDeployment.address)).eq(0)) {
    log('Transferring rewards tokens to airdrop contract');
    await (
      await usdc.transfer(
        airdropDeployment.address,
        ethers.utils.parseUnits('100', 6), // amount claimable by users
      )
    ).wait(networkConfig.confirmations);
  }

  if ((await airdrop.owner()) === deployer) {
    log('Transferring ownership of airdrop contract to timelock');
    await (
      await airdrop.transferOwnership(timelockDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  log('-----Airdrop deployed-----');
};

export default deployAirdrop;

deployAirdrop.tags = ['airdrop'];
