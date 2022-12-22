import { ethers } from 'hardhat';
import { IERC20 } from '../../../typechain-types';

export async function deployStakingContract(micToken: IERC20, usdcToken: IERC20) {
  const [user] = await ethers.getSigners();
  const StakingContractFactory = await ethers.getContractFactory('Staking');
  const stakingContract = await StakingContractFactory.deploy(
    micToken.address,
    usdcToken.address,
  );
  await stakingContract.deployed();
  await stakingContract.grantRole(await stakingContract.LOCKER_ROLE(), user.address);
  await stakingContract.grantRole(await stakingContract.PERIOD_STARTER(), user.address);

  return { stakingContract };
}
