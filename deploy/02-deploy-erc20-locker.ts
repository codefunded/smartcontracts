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
          baseRewardModifier: 10000,
          isEntitledToVote: true,
          isLPToken: false,
          lockPeriods: [{ durationInSeconds: 0, rewardModifier: 10000 }],
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
  await governanceTokenContract.transferOwnership(
    multiERC20WeightedLockerDeployment.address,
  );

  log('-----ERC20 Locker deployed-----');
};

export default deployERC20Locker;
