import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { prepareFullTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('PeriodStarter', () => {
  test('should allow to schedule the next period end date', async () => {
    const { periodStarter } = await loadFixture(prepareFullTestEnv);

    const currentTimestamp = (
      await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
    ).timestamp;

    const nextStakingRewardsPeriodFinishAt = currentTimestamp + time.duration.days(90);

    await periodStarter.scheduleNextRewardsPeriod(nextStakingRewardsPeriodFinishAt);

    const fetchedNextStakingPeriodFinishAt =
      await periodStarter.nextStakingPeriodFinishAt();

    expect(fetchedNextStakingPeriodFinishAt).to.be.equal(
      nextStakingRewardsPeriodFinishAt,
    );
  });

  test('should correctly return true when previous staking period has been finished', async () => {
    const { periodStarter, usdcToken, staking } = await loadFixture(prepareFullTestEnv);

    await usdcToken.transfer(staking.address, ethers.utils.parseUnits('10', 6));
    await staking.startNewRewardsPeriod(time.duration.days(90));

    const currentTimestamp = (
      await ethers.provider.getBlock(await ethers.provider.getBlockNumber())
    ).timestamp;

    await periodStarter.scheduleNextRewardsPeriod(
      currentTimestamp + time.duration.days(180),
    );

    await time.increase(time.duration.days(90));

    const { canExec, execPayload } = await periodStarter.canStartNewRewardsPeriod();
    expect(canExec).to.be.equal(true);
    expect(execPayload).to.be.equal(
      staking.interface.encodeFunctionData('startNewRewardsPeriod', [
        time.duration.days(90),
      ]),
    );
  });

  test('Should allow to start a task for constantly checking for period start', async () => {
    const { periodStarter } = await loadFixture(prepareFullTestEnv);

    const tx = await periodStarter.createTask();
    const receipt = await tx.wait();

    expect(receipt.events?.length).to.be.greaterThanOrEqual(1);
    expect(
      receipt.events?.some((event) => event.event === 'PeriodStarterTaskScheduled'),
    ).to.be.equal(true);
    expect(await periodStarter.periodSchedulerTaskId()).to.be.not.equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  test('Should allow to cancel a task for constantly checking for period start', async () => {
    const { periodStarter } = await loadFixture(prepareFullTestEnv);

    await periodStarter.createTask();
    expect(await periodStarter.periodSchedulerTaskId()).to.be.not.equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );

    const tx = await periodStarter.cancelTask();
    const receipt = await tx.wait();
    expect(await periodStarter.periodSchedulerTaskId()).to.be.equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );
    expect(receipt.events?.length).to.be.greaterThanOrEqual(1);
    expect(
      receipt.events?.some((event) => event.event === 'PeriodStarterTaskCancelled'),
    ).to.be.equal(true);
  });
});
