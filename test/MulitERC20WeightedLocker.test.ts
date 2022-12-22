import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { prepareFullTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { getPermitSignature } from '../utils/testHelpers/permit';

describe('MultiERC20WeightedLocker contract', async () => {
  test('should mint an approperiate amount of governance token when depositing and burn it when withdrawing', async () => {
    const { micToken, governanceToken, locker } = await loadFixture(prepareFullTestEnv);
    const [user] = await ethers.getSigners();

    await micToken.approve(locker.address, ethers.utils.parseEther('100'));
    await locker.stake(0, 0, ethers.utils.parseEther('100'), 1); // LockPeriod 1 is 90 days
    expect(await governanceToken.balanceOf(user.address)).to.be.equal(
      ethers.utils.parseEther('102'),
    );

    await time.increase(time.duration.days(90));

    await locker.withdraw(1);

    expect(await governanceToken.balanceOf(user.address)).to.be.equal(0);
  });

  test('should allow owner to add a new lockable asset', async () => {
    const { usdcToken, locker } = await loadFixture(prepareFullTestEnv);

    await locker.addLockableAsset({
      token: usdcToken.address,
      baseRewardModifier: 10000,
      isEntitledToVote: false,
      isLPToken: false,
    });

    const lockableAsset = await locker.lockableAssets(2);
    expect(lockableAsset.token).to.be.equal(usdcToken.address);
    expect(lockableAsset.baseRewardModifier).to.be.equal(10000);
    expect(lockableAsset.isEntitledToVote).to.be.false;
    expect(lockableAsset.isLPToken).to.be.false;
  });

  test('should allow owner to add a new staking contract', async () => {
    const { usdcToken, locker } = await loadFixture(prepareFullTestEnv);

    const StakingFactory = await ethers.getContractFactory('Staking');
    const newStaking = await StakingFactory.deploy(locker.address, usdcToken.address);

    await locker.addStakingContract(newStaking.address);

    expect(await locker.stakingContracts(1)).to.be.equal(newStaking.address);
  });

  test('should allow to deposit tokens without lock period', async () => {
    const { micToken, locker } = await loadFixture(prepareFullTestEnv);
    const [user] = await ethers.getSigners();

    await micToken.approve(locker.address, ethers.utils.parseEther('1'));
    await locker.stake(0, 0, ethers.utils.parseEther('1'), 0);

    const balanceOf = await locker.balanceOf(user.address);
    expect(balanceOf).to.be.equal(ethers.utils.parseEther('1'));
    const deposit = await locker.userDeposits(user.address, 1);
    expect(deposit.isOngoing).to.be.true;
  });

  test('should not allow to withdraw deposits before the lock up period ends', async () => {
    const { micToken, locker } = await loadFixture(prepareFullTestEnv);
    const [user] = await ethers.getSigners();

    await micToken.approve(locker.address, ethers.utils.parseEther('1'));
    await locker.stake(0, 0, ethers.utils.parseEther('1'), 1); // LockPeriod 1 is 90 days

    await expect(locker.withdraw(1)).to.be.revertedWithCustomError(
      locker,
      'MultiERC20WeightedLocker__DepositIsStillLocked',
    );

    await time.increase(time.duration.days(90));

    await locker.withdraw(1);

    const balanceOfStakedTokens = await locker.balanceOf(user.address);
    expect(balanceOfStakedTokens).to.be.equal(0);
    const deposit = await locker.userDeposits(user.address, 1);
    expect(deposit.isOngoing).to.be.false;
  });

  test('should correctly apply modifiers to deposits with lock up periods', async () => {
    const { micToken, locker } = await loadFixture(prepareFullTestEnv);
    const [user] = await ethers.getSigners();

    await micToken.approve(locker.address, ethers.utils.parseEther('300'));
    await locker.stake(0, 0, ethers.utils.parseEther('100'), 1); // LockPeriod 1 is 90 days
    expect(await locker.balanceOf(user.address)).to.be.equal(
      ethers.utils.parseEther('102'),
    );
    await locker.stake(0, 0, ethers.utils.parseEther('100'), 2); // LockPeriod 2 is 180 days
    expect(await locker.balanceOf(user.address)).to.be.equal(
      ethers.utils.parseEther('105').add(ethers.utils.parseEther('102')),
    );
    await locker.stake(0, 0, ethers.utils.parseEther('100'), 3); // LockPeriod 3 is 360 days
    expect(await locker.balanceOf(user.address)).to.be.equal(
      ethers.utils
        .parseEther('112')
        .add(ethers.utils.parseEther('105').add(ethers.utils.parseEther('102'))),
    );
  });

  test('should allow to collect rewards', async () => {
    const { micToken, usdcToken, staking, locker } = await loadFixture(
      prepareFullTestEnv,
    );
    const [user] = await ethers.getSigners();

    await micToken.approve(locker.address, ethers.utils.parseEther('100'));
    await locker.stake(0, 0, ethers.utils.parseEther('100'), 0); // no lockup period

    await usdcToken.transfer(staking.address, ethers.utils.parseUnits('10', 6));
    await staking.startNewRewardsPeriod(time.duration.days(1));

    await time.increase(time.duration.days(1));

    const balanceBeforeCollectingRewards = await usdcToken.balanceOf(user.address);
    await locker.collectRewards(0);
    const balanceAfterCollectingRewards = await usdcToken.balanceOf(user.address);
    expect(
      balanceAfterCollectingRewards.sub(balanceBeforeCollectingRewards),
    ).to.be.approximately(
      ethers.utils.parseUnits('10', 6),
      ethers.utils.parseUnits('0.1', 6),
    );
  });

  test('should allow to liquidate a stale deposit', async () => {
    const { micToken, locker } = await loadFixture(prepareFullTestEnv);
    const [user, liquidator] = await ethers.getSigners();

    await micToken.approve(locker.address, ethers.utils.parseEther('100'));
    await locker.stake(0, 0, ethers.utils.parseEther('100'), 1); // 90 days lockup period

    await time.increase(time.duration.days(90));

    await locker.connect(liquidator).liquidateStaleDeposit(user.address, 1);

    const userDeposit = await locker.userDeposits(user.address, 1);
    expect(userDeposit.isOngoing).to.be.false;
  });

  test('should not allow to liquidate a deposit without a lock', async () => {
    const { micToken, locker } = await loadFixture(prepareFullTestEnv);
    const [user, liquidator] = await ethers.getSigners();

    await micToken.approve(locker.address, ethers.utils.parseEther('100'));
    await locker.stake(0, 0, ethers.utils.parseEther('100'), 0); // no lockup period

    expect(
      locker.connect(liquidator).liquidateStaleDeposit(user.address, 1),
    ).to.be.revertedWithCustomError(
      locker,
      'MultiERC20WeightedLocker__DepositIsNotLocked',
    );
  });

  test('should allow to stake tokens with permit', async () => {
    const { locker, micTokenPermit } = await loadFixture(prepareFullTestEnv);
    const [user] = await ethers.getSigners();

    const { v, r, s } = await getPermitSignature(
      user,
      micTokenPermit,
      locker.address,
      ethers.utils.parseEther('1'),
      ethers.constants.MaxUint256,
    );

    await locker.stakeWithPermit(
      0,
      0,
      ethers.utils.parseEther('1'),
      0,
      ethers.constants.MaxUint256,
      v,
      r,
      s,
    );

    expect(await locker.balanceOf(user.address)).to.be.equal(
      ethers.utils.parseEther('1'),
    );
  });

  test('should allow to disable deposits for a given asset', async () => {
    const { locker, micToken } = await loadFixture(prepareFullTestEnv);

    await locker.disableDepositsForAsset(0);

    await micToken.approve(locker.address, ethers.utils.parseEther('100'));
    await expect(
      locker.stake(0, 0, ethers.utils.parseEther('100'), 0),
    ).to.be.revertedWithCustomError(
      locker,
      'MultiERC20WeightedLocker__DepositsInThisAssetHaveBeenDisabled',
    );
  });

  test('should allow to enable deposits for a given asset', async () => {
    const { locker, micToken } = await loadFixture(prepareFullTestEnv);

    await locker.disableDepositsForAsset(0);

    await micToken.approve(locker.address, ethers.utils.parseEther('100'));
    await expect(
      locker.stake(0, 0, ethers.utils.parseEther('100'), 0),
    ).to.be.revertedWithCustomError(
      locker,
      'MultiERC20WeightedLocker__DepositsInThisAssetHaveBeenDisabled',
    );

    await locker.enableDepositsForAsset(0);

    await expect(locker.stake(0, 0, ethers.utils.parseEther('100'), 0)).not.to.be
      .reverted;
  });
});
