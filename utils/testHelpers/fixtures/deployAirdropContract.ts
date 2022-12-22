import { ethers } from 'hardhat';
import { IERC20 } from '../../../typechain-types';

export async function deployAirdropContract(micToken: IERC20, merkleRoot: string) {
  const AirdropFactory = await ethers.getContractFactory('MerkleClaimableAirdrop');
  const airdrop = await AirdropFactory.deploy(micToken.address, merkleRoot);
  await airdrop.deployed();

  await micToken.transfer(airdrop.address, ethers.utils.parseEther('100'));

  return { airdrop };
}
