import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { getEventFromTxReceipt } from '../utils/testHelpers/extractEventFromTxReceipt';
import { prepareSimpleTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('Mint staking contract', async () => {
  test('Should allow to stake tokens', async () => {
    const { mintStakingContract, micToken } = await loadFixture(prepareSimpleTestEnv);
    const [user] = await ethers.getSigners();

    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('1'));

    const tx = await mintStakingContract.stakeFor(
      user.address,
      ethers.utils.parseEther('1'),
    );
    const txReceipt = await tx.wait();

    expect(
      getEventFromTxReceipt<{ amount: BigNumber }>(txReceipt, -1).amount,
    ).to.be.equal(ethers.utils.parseEther('1'));
  });

  test('should allow to collect rewards', async () => {
    const { mintStakingContract, micToken, iceToken } = await loadFixture(
      prepareSimpleTestEnv,
    );

    const [user] = await ethers.getSigners();

    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('5'));
    await mintStakingContract.stakeFor(user.address, ethers.utils.parseEther('5'));

    await time.increase(time.duration.years(1));

    const reward = await mintStakingContract.earnedReward(user.address);
    const tx = await mintStakingContract.collectRewardsFor(user.address);

    const txReceipt = await tx.wait();
    expect(
      getEventFromTxReceipt<{ amount: BigNumber }>(txReceipt, -1).amount,
    ).to.be.approximately(reward, ethers.utils.parseEther('0.001'));

    const iceBalanceAfter = await iceToken.balanceOf(user.address);
    expect(iceBalanceAfter).to.be.approximately(reward, ethers.utils.parseEther('0.001'));
  });
  test('should allow to withdraw staked tokens', async () => {
    const { mintStakingContract, micToken } = await loadFixture(prepareSimpleTestEnv);

    const [user] = await ethers.getSigners();

    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('1'));
    await mintStakingContract.stakeFor(user.address, ethers.utils.parseEther('1'));

    const micBalanceOnStaking = await mintStakingContract.balanceOf(user.address);

    expect(micBalanceOnStaking).to.be.equal(ethers.utils.parseEther('1'));

    await mintStakingContract.withdrawFor(user.address, ethers.utils.parseEther('1'));

    const micBalanceAfterStaking = await mintStakingContract.balanceOf(user.address);

    expect(micBalanceAfterStaking).to.be.equal(0);
  });
  test("should correctly calculate reward amount (number of stakers shouldn't make any difference in rewards)", async () => {
    const { mintStakingContract, micToken } = await loadFixture(prepareSimpleTestEnv);

    const [user, user2] = await ethers.getSigners();

    await micToken.approve(mintStakingContract.address, ethers.utils.parseEther('5'));
    await micToken
      .connect(user2)
      .approve(mintStakingContract.address, ethers.utils.parseEther('5'));
    await mintStakingContract.stakeFor(user.address, ethers.utils.parseEther('5'));
    await mintStakingContract.stakeFor(user2.address, ethers.utils.parseEther('10'));

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
