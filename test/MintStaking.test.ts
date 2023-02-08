import { time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { getEventFromTxReceipt } from '../utils/testHelpers/extractEventFromTxReceipt';
import { prepareSimpleTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, MintStaking } from '../typechain-types';

describe('Mint staking contract', async () => {
  let micToken: ERC20;
  let iceToken: ERC20;
  let mintStakingContract: MintStaking;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    ({ micToken, iceToken, mintStakingContract } = await prepareSimpleTestEnv());
    [user1, user2] = await ethers.getSigners();
  });

  test('Should allow to stake tokens', async () => {
    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('1'));

    const tx = await mintStakingContract.stakeFor(
      user1.address,
      ethers.utils.parseEther('1'),
    );
    const txReceipt = await tx.wait();

    expect(
      getEventFromTxReceipt<{ amount: BigNumber }>(txReceipt, -1).amount,
    ).to.be.equal(ethers.utils.parseEther('1'));
  });

  test('should allow to collect rewards', async () => {
    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('5'));
    await mintStakingContract.stakeFor(user1.address, ethers.utils.parseEther('5'));

    await time.increase(time.duration.years(1));

    const iceBalanceBefore = await iceToken.balanceOf(user1.address);

    const reward = await mintStakingContract.earnedReward(user1.address);
    const tx = await mintStakingContract.collectRewardsFor(user1.address);

    const txReceipt = await tx.wait();
    expect(
      getEventFromTxReceipt<{ amount: BigNumber }>(txReceipt, -1).amount,
    ).to.be.approximately(reward, ethers.utils.parseEther('0.001'));

    const iceBalanceAfter = await iceToken.balanceOf(user1.address);
    expect(iceBalanceAfter).to.be.approximately(
      iceBalanceBefore.add(reward),
      ethers.utils.parseEther('0.001'),
    );
  });
  test('should allow to withdraw staked tokens', async () => {
    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('1'));
    await mintStakingContract.stakeFor(user1.address, ethers.utils.parseEther('1'));

    const micBalanceOnStaking = await mintStakingContract.balanceOf(user1.address);

    expect(micBalanceOnStaking).to.be.equal(ethers.utils.parseEther('1'));

    await mintStakingContract.withdrawFor(user1.address, ethers.utils.parseEther('1'));

    const micBalanceAfterStaking = await mintStakingContract.balanceOf(user1.address);

    expect(micBalanceAfterStaking).to.be.equal(0);
  });
  test("should correctly calculate reward amount (number of stakers shouldn't make any difference in rewards)", async () => {
    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('5'));
    await micToken
      .connect(user2)
      .approve(mintStakingContract.address, ethers.utils.parseEther('5'));
    await mintStakingContract.stakeFor(user1.address, ethers.utils.parseEther('5'));
    await mintStakingContract.stakeFor(user2.address, ethers.utils.parseEther('10'));

    await time.increase(time.duration.years(1));

    const user1Profit = await mintStakingContract.earnedReward(user1.address);
    const user2Profit = await mintStakingContract.earnedReward(user2.address);

    expect(user1Profit).to.be.approximately(
      ethers.utils.parseEther('1'),
      ethers.utils.parseEther('0.01'),
    );
    expect(user2Profit).to.be.approximately(
      ethers.utils.parseEther('2'),
      ethers.utils.parseEther('0.01'),
    );
  });

  test('access to stake, withdraw and collect functions should be restricted', async () => {
    const notAnOwnerError = 'Ownable: caller is not the owner';

    await micToken
      .connect(user2)
      .approve(mintStakingContract.address, ethers.utils.parseEther('100'));
    await expect(
      mintStakingContract
        .connect(user2)
        .stakeFor(user2.address, ethers.utils.parseEther('100')),
    ).to.be.revertedWith(notAnOwnerError);

    await expect(
      mintStakingContract.connect(user2).collectRewardsFor(user2.address),
    ).to.be.revertedWith(notAnOwnerError);

    await expect(
      mintStakingContract
        .connect(user2)
        .withdrawFor(user2.address, ethers.utils.parseEther('100')),
    ).to.be.revertedWith(notAnOwnerError);
  });
});
