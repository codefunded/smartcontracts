import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployERC20Locker: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, get, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const dividendToken = await get('DividendToken');
  const governanceToken = await get('GovernanceDividendTokenWrapper');

  const multiERC20WeightedLockerDeployment = await deploy('MultiERC20WeightedLocker', {
    from: deployer,
    args: [
      'Staked MilkyIce',
      'sMIC',
      [
        {
          token: dividendToken.address,
          isEntitledToVote: true,
          isLPToken: false,
          lockPeriods: [{ durationInSeconds: 0, rewardModifier: 10000 }],
          dividendTokenFromPair: ethers.constants.AddressZero,
          priceOracle: ethers.constants.AddressZero,
        },
      ],
      governanceToken.address,
    ],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(
      multiERC20WeightedLockerDeployment.address,
      multiERC20WeightedLockerDeployment.args!,
    );
  }

  const governanceTokenContract = await ethers.getContractAt(
    'GovernanceDividendTokenWrapper',
    governanceToken.address,
  );
  if (
    (await governanceTokenContract.owner()) !== multiERC20WeightedLockerDeployment.address
  ) {
    log(
      'Transferring ownership of GovernanceDividendTokenWrapper to MultiERC20WeightedLocker',
    );
    await (
      await governanceTokenContract.transferOwnership(
        multiERC20WeightedLockerDeployment.address,
      )
    ).wait(networkConfig.confirmations);
  }

  log('-----ERC20 Locker deployed-----');
};

export default deployERC20Locker;

deployERC20Locker.tags = ['locker'];
