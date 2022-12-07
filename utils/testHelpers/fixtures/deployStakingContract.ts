import { ethers } from 'hardhat';
import { IERC20 } from '../../../typechain-types';

export async function deployStakingContract(micToken: IERC20, usdcToken: IERC20) {
  const StakingContractFactory = await ethers.getContractFactory('Staking');
  const stakingContract = await StakingContractFactory.deploy(
    micToken.address,
    usdcToken.address,
  );
  await stakingContract.deployed();

  return { stakingContract };
}
