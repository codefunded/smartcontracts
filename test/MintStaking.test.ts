import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { getEventFromTxReceipt } from '../utils/testHelpers/extractEventFromTxReceipt';
import { prepareTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { getPermitSignature } from '../utils/testHelpers/permit';

describe('Mint staking contract', async () => {
  test('Should allow to stake tokens', async () => {
    const { mintStakingContract, micToken } = await loadFixture(prepareTestEnv);

    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('1'));

    const tx = await mintStakingContract.stake(ethers.utils.parseEther('1'));
    const txReceipt = await tx.wait();

    expect(
      getEventFromTxReceipt<{ amount: BigNumber }>(txReceipt, -1).amount,
    ).to.be.equal(ethers.utils.parseEther('1'));
  });
  test('Should allow to stake tokens with permit', async () => {
    const { mintStakingContract, micTokenPermit } = await loadFixture(prepareTestEnv);
    const [user] = await ethers.getSigners();

    const { v, r, s } = await getPermitSignature(
      user,
      micTokenPermit,
      mintStakingContract.address,
      ethers.utils.parseEther('1'),
      ethers.constants.MaxUint256,
    );

    const tx = await mintStakingContract.stakeWithPermit(
      ethers.utils.parseEther('1'),
      ethers.constants.MaxUint256,
      v,
      r,
      s,
    );

    const txReceipt = await tx.wait();
    expect(
      getEventFromTxReceipt<{ amount: BigNumber }>(txReceipt, -1).amount,
    ).to.be.equal(ethers.utils.parseEther('1'));
  });
  test('should allow to collect rewardss', async () => {
    const { mintStakingContract, micToken, iceToken } = await loadFixture(prepareTestEnv);

    const [user] = await ethers.getSigners();

    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('5'));
    await mintStakingContract.stake(ethers.utils.parseEther('5'));

    await time.increase(time.duration.years(1));

    const iceBalanceBefore = await iceToken.balanceOf(user.address);

    const reward = await mintStakingContract.earnedReward(user.address);
    const tx = await mintStakingContract.collectReward();

    const txReceipt = await tx.wait();
    expect(
      getEventFromTxReceipt<{ amount: BigNumber }>(txReceipt, -1).amount,
    ).to.be.approximately(reward, ethers.utils.parseEther('0.001'));

    const iceBalanceAfter = await iceToken.balanceOf(user.address);
    expect(iceBalanceAfter).to.be.approximately(reward, ethers.utils.parseEther('0.001'));
  });
  test('should allow to withdraw staked tokens', async () => {
    const { mintStakingContract, micToken } = await loadFixture(prepareTestEnv);

    const [user] = await ethers.getSigners();

    const micBalanceBefore = await micToken.balanceOf(user.address);

    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('1'));
    await mintStakingContract.stake(ethers.utils.parseEther('1'));

    const micBalanceWhenStaking = await micToken.balanceOf(user.address);

    expect(micBalanceWhenStaking).to.be.equal(
      micBalanceBefore.sub(ethers.utils.parseEther('1')),
    );

    await mintStakingContract.withdraw(ethers.utils.parseEther('1'));

    const micBalanceAfter = await micToken.balanceOf(user.address);

    expect(micBalanceBefore).to.be.equal(micBalanceAfter);
  });
  test("should correctly calculate reward amount (number of stakers shouldn't make any difference in rewards)", async () => {
    const { mintStakingContract, micToken } = await loadFixture(prepareTestEnv);

    const [user, user2] = await ethers.getSigners();

    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('5'));
    await mintStakingContract.stake(ethers.utils.parseEther('5'));

    await micToken
      .connect(user2)
      .approve(mintStakingContract.address, ethers.utils.parseEther('10'));
    await mintStakingContract.connect(user2).stake(ethers.utils.parseEther('10'));

    await time.increase(time.duration.years(1));

    const user1Profit = await mintStakingContract.earnedReward(user.address);
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
});
