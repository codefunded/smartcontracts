import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

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

  const vestingWalletDeployment = await deploy('TeamVestingWallet', {
    from: deployer,
    args: [
      networkConfig.TEAM_ADDRESS,
      networkConfig.VESTING_START_TIMESTAMP,
      time.duration.weeks(4),
    ],
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

  log('-----Vesting wallet deployed-----');
};

export default deployVestingWallet;

deployVestingWallet.tags = ['vesting'];
