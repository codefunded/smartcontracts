import { ethers } from 'hardhat';
import { IERC20 } from '../../../typechain-types';

export async function deployAirdropContract(
  micToken: IERC20,
  rewardToken: IERC20,
  merkleRoot: string,
) {
  const AirdropFactory = await ethers.getContractFactory('MerkleClaimableAirdrop');
  const airdrop = await AirdropFactory.deploy(
    micToken.address,
    rewardToken.address,
    merkleRoot,
  );
  await airdrop.deployed();

  await micToken.transfer(airdrop.address, ethers.utils.parseEther('100'));
  await rewardToken.transfer(airdrop.address, ethers.utils.parseUnits('10', 6));

  return { airdrop };
}
