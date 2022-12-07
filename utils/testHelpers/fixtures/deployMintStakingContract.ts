import { ethers } from 'hardhat';
import { IERC20 } from '../../../typechain-types';
import { REWARD_RATE } from '../../networkConfigs';

export async function deployMintStakingContract(micToken: IERC20) {
  const MintableTokenFactory = await ethers.getContractFactory('MintableToken');
  const iceToken = await MintableTokenFactory.deploy('MilkyIce ICE', 'ICE');
  await iceToken.deployed();

  const MintStakingContractFactory = await ethers.getContractFactory('MintStaking');
  const mintStakingContract = await MintStakingContractFactory.deploy(
    micToken.address,
    iceToken.address,
    REWARD_RATE,
  );
  await mintStakingContract.deployed();
  await iceToken.grantRole(await iceToken.MINTER_ROLE(), mintStakingContract.address);

  return { mintStakingContract, iceToken };
}
