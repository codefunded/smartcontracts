import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployVestingWallet: DeployFunction = async function ({
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

  const vestingWalletDeployment = await deploy('StepVestingWallet', {
    from: deployer,
    args: [dividendToken.address],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(vestingWalletDeployment.address, vestingWalletDeployment.args!);
  }

  if ((await dividendToken.balanceOf(vestingWalletDeployment.address)).eq(0)) {
    log('Transferring tokens to vesting wallet');
    await (
      await dividendToken.transfer(
        vestingWalletDeployment.address,
        ethers.utils.parseEther('5000000'),
      )
    ).wait(networkConfig.confirmations);
  }

  const vestingWallet = await ethers.getContractAt(
    'StepVestingWallet',
    vestingWalletDeployment.address,
  );
  const beneficiaries = await vestingWallet.getBeneficiaries();
  if (beneficiaries.addresses.length === 0) {
    log('Adding beneficiaries to vesting wallet');
    await (
      await vestingWallet.setBeneficiaries([], [])
    ).wait(networkConfig.confirmations);
  }

  log('-----Vesting wallet deployed-----');
};

export default deployVestingWallet;

deployVestingWallet.tags = ['vesting'];
