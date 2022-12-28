import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { generateLeaf, generateMerkleTree } from '../utils/generateMerkleTree';
import { deployAirdropContract } from '../utils/testHelpers/fixtures/deployAirdropContract';
import { prepareSimpleTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20 } from '../typechain-types';

describe('Airdrop contract', async () => {
  let micToken: ERC20;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    ({micToken}= await prepareSimpleTestEnv());
    [user1, user2] = await ethers.getSigners();
  });

  test('should allow to claim airdrop when user is listed in the airdrop', async () => {
    const { merkleTree, merkleRoot } = await generateMerkleTree([
      {
        address: user1.address,
        value: ethers.utils.parseEther('1').toString(),
      },
    ]);
    const { airdrop } = await deployAirdropContract(micToken, merkleRoot);
    const leaf = generateLeaf(user1.address, ethers.utils.parseEther('1').toString());
    const proof = merkleTree.getHexProof(leaf);

    const balanceBeforeAirdrop = await micToken.balanceOf(user1.address);

    await airdrop.claim(user1.address, ethers.utils.parseEther('1').toString(), proof);

    const balanceAfterAirdrop = await micToken.balanceOf(user1.address);
    expect(balanceAfterAirdrop.sub(balanceBeforeAirdrop)).to.be.equal(
      ethers.utils.parseEther('1'),
    );
  });

  test('should not allow to claim aidrop when incorrect amount is provided', async () => {
    const { merkleTree, merkleRoot } = await generateMerkleTree([
      {
        address: user1.address,
        value: ethers.utils.parseEther('1').toString(),
      },
    ]);
    const { airdrop } = await deployAirdropContract(micToken, merkleRoot);
    const leaf = generateLeaf(user1.address, ethers.utils.parseEther('1').toString());
    const proof = merkleTree.getHexProof(leaf);

    await expect(
      airdrop.claim(user1.address, ethers.utils.parseEther('10').toString(), proof),
    ).to.be.revertedWithCustomError(airdrop, 'MerkleClaimableAirdrop__InvalidProof');
  });

  test('should not allow to claim aidrop when incorrect address is provided', async () => {
    const { merkleTree, merkleRoot } = await generateMerkleTree([
      {
        address: user1.address,
        value: ethers.utils.parseEther('1').toString(),
      },
    ]);
    const { airdrop } = await deployAirdropContract(micToken, merkleRoot);
    const leaf = generateLeaf(user1.address, ethers.utils.parseEther('1').toString());
    const proof = merkleTree.getHexProof(leaf);

    await expect(
      airdrop.claim(user2.address, ethers.utils.parseEther('1').toString(), proof),
    ).to.be.revertedWithCustomError(airdrop, 'MerkleClaimableAirdrop__InvalidProof');
  });

  test('should not allow to claim aidrop when incorrect proof is provided', async () => {
    const { merkleTree, merkleRoot } = await generateMerkleTree([
      {
        address: user1.address,
        value: ethers.utils.parseEther('1').toString(),
      },
      {
        address: ethers.constants.AddressZero,
        value: ethers.utils.parseEther('2').toString(),
      },
    ]);
    const { airdrop } = await deployAirdropContract(micToken, merkleRoot);

    const leaf = generateLeaf(user2.address, ethers.utils.parseEther('10').toString());
    const proof = merkleTree.getHexProof(leaf);

    await expect(
      airdrop.claim(user1.address, ethers.utils.parseEther('1').toString(), proof),
    ).to.be.rejectedWith('MerkleClaimableAirdrop__InvalidProof');
  });
});
