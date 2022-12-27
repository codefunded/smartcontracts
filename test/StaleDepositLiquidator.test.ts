import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { ERC20, MultiERC20WeightedLocker } from '../typechain-types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { prepareFullTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('StaleDepositLiquidator', () => {
  test('should correctly get the list of stale deposits to liquidate', async () => {
    const { liquidator, micToken, locker } = await loadFixture(prepareFullTestEnv);
    const [user] = await ethers.getSigners();

    const whenThereAreNoDeposits = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(whenThereAreNoDeposits.canExec).to.be.equal(false);

    await micToken.approve(locker.address, ethers.utils.parseEther('1'));
    await locker.stake(0, 0, ethers.utils.parseEther('1'), 1);

    await time.increase(time.duration.days(91));

    const withOneDepositsToLiquidate =
      await liquidator.getListOfStaleDepositsToLiquidate();
    expect(withOneDepositsToLiquidate.canExec).to.be.equal(true);
    const txData = liquidator.interface.encodeFunctionData('liquidateStaleDeposits', [
      [
        {
          depositor: user.address,
          depositId: 1,
        },
      ],
    ]);
    expect(withOneDepositsToLiquidate.execPayload).to.be.equal(txData);
  });

  test('should not count deposits that are not locked', async () => {
    const { liquidator, micToken, locker } = await loadFixture(prepareFullTestEnv);

    const emptyDepositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(emptyDepositsToLiquidate.canExec).to.be.equal(false);

    await micToken.approve(locker.address, ethers.utils.parseEther('1'));
    await locker.stake(0, 0, ethers.utils.parseEther('1'), 0);

    const depositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(depositsToLiquidate.canExec).to.be.equal(false);
  });

  test('should not count deposits that are no longer ongoing', async () => {
    const { liquidator, micToken, locker } = await loadFixture(prepareFullTestEnv);

    await micToken.approve(locker.address, ethers.utils.parseEther('1'));
    await locker.stake(0, 0, ethers.utils.parseEther('1'), 1);

    await time.increase(time.duration.days(91));

    await locker.withdraw(1);

    const depositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(depositsToLiquidate.canExec).to.be.equal(false);
  });

  test('should be able to liquidate deposits', async () => {
    const { liquidator, micToken, locker } = await loadFixture(prepareFullTestEnv);
    const [user] = await ethers.getSigners();

    await micToken.approve(locker.address, ethers.utils.parseEther('1'));
    await locker.stake(0, 0, ethers.utils.parseEther('1'), 1);

    await time.increase(time.duration.days(91));

    const depositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(depositsToLiquidate.canExec).to.be.equal(true);

    await liquidator.liquidateStaleDeposits([
      {
        depositor: user.address,
        depositId: 1,
      },
    ]);

    const deposit = await locker.getDeposit(user.address, 1);
    expect(deposit.isOngoing).to.be.equal(false);
  });

  test('Should allow to start a task for constantly checking for possible liquidations', async () => {
    const { liquidator } = await loadFixture(prepareFullTestEnv);

    const tx = await liquidator.createTask();
    const receipt = await tx.wait();

    expect(receipt.events?.length).to.be.greaterThanOrEqual(1);
    expect(
      receipt.events?.some(
        (event) => event.event === 'StaleDepositLiquidatorTaskScheduled',
      ),
    ).to.be.equal(true);
    expect(await liquidator.liquidatorTaskId()).to.be.not.equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );
  });

  test('Should allow to cancel a task for constantly checking for possible liquidations', async () => {
    const { liquidator } = await loadFixture(prepareFullTestEnv);

    await liquidator.createTask();
    expect(await liquidator.liquidatorTaskId()).to.be.not.equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );

    const tx = await liquidator.cancelTask();
    const receipt = await tx.wait();
    expect(await liquidator.liquidatorTaskId()).to.be.equal(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    );
    expect(receipt.events?.length).to.be.greaterThanOrEqual(1);
    expect(
      receipt.events?.some(
        (event) => event.event === 'StaleDepositLiquidatorTaskCancelled',
      ),
    ).to.be.equal(true);
  });
});
