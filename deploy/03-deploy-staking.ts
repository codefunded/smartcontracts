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

  const multiERC20WeightedLockerDeployment = await get('MultiERC20WeightedLocker');
  const mintableToken = await get('MintableToken');

  const usdcAddress =
    networkConfig.existingContracts?.usdcToken || (await get('MockUSDC')).address;

  const stakingDeployment = await deploy('Staking', {
    from: deployer,
    args: [multiERC20WeightedLockerDeployment.address, usdcAddress],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(stakingDeployment.address, stakingDeployment.args!);
  }

  const mintStakingDeployment = await deploy('MintStaking', {
    from: deployer,
    args: [
      multiERC20WeightedLockerDeployment.address,
      mintableToken.address,
      REWARD_RATE,
    ],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(mintStakingDeployment.address, mintStakingDeployment.args!);
  }

  const iceToken = await ethers.getContractAt('MintableToken', mintableToken.address);
  await iceToken.grantRole(await iceToken.MINTER_ROLE(), mintStakingDeployment.address);

  const locker = await ethers.getContractAt(
    'MultiERC20WeightedLocker',
    multiERC20WeightedLockerDeployment.address,
  );
  await locker.addStakingContract(stakingDeployment.address);
  await locker.addStakingContract(mintStakingDeployment.address);

  const staking = await ethers.getContractAt('Staking', stakingDeployment.address);
  await staking.grantRole(
    await staking.LOCKER_ROLE(),
    multiERC20WeightedLockerDeployment.address,
  );

  log('-----Staking contracts deployed-----');
};

export default deployStaking;
