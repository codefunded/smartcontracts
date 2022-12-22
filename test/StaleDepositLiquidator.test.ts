import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { ERC20, MultiERC20WeightedLocker } from '../typechain-types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { prepareFullTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('StaleDepositLiquidator', () => {
  let _locker: MultiERC20WeightedLocker;
  let _micToken: ERC20;

  beforeEach(async () => {
    const { locker, micToken } = await prepareFullTestEnv();
    _locker = locker;
    _micToken = micToken;
  });

  test('should correctly get the list of stale deposits to liquidate', async () => {
    const [user] = await ethers.getSigners();

    const liquidatorFactory = await ethers.getContractFactory('StaleDepositLiquidator');
    const liquidator = await liquidatorFactory.deploy(
      getNetworkConfig('31337').existingContracts.gelatoAutomate,
      _locker.address,
    );

    const whenThereAreNoDeposits = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(whenThereAreNoDeposits.canExec).to.be.equal(false);

    await _micToken.approve(_locker.address, ethers.utils.parseEther('1'));
    await _locker.stake(0, 0, ethers.utils.parseEther('1'), 1);

    await time.increase(time.duration.days(91));

    const withOneDepositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
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
    const liquidatorFactory = await ethers.getContractFactory('StaleDepositLiquidator');
    const liquidator = await liquidatorFactory.deploy(
      getNetworkConfig('31337').existingContracts.gelatoAutomate,
      _locker.address,
    );

    const emptyDepositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(emptyDepositsToLiquidate.canExec).to.be.equal(false);

    await _micToken.approve(_locker.address, ethers.utils.parseEther('1'));
    await _locker.stake(0, 0, ethers.utils.parseEther('1'), 0);

    const depositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(depositsToLiquidate.canExec).to.be.equal(false);
  });

  test('should not count deposits that are no longer ongoing', async () => {
    const liquidatorFactory = await ethers.getContractFactory('StaleDepositLiquidator');
    const liquidator = await liquidatorFactory.deploy(
      getNetworkConfig('31337').existingContracts.gelatoAutomate,
      _locker.address,
    );

    await _micToken.approve(_locker.address, ethers.utils.parseEther('1'));
    await _locker.stake(0, 0, ethers.utils.parseEther('1'), 1);

    await time.increase(time.duration.days(91));

    await _locker.withdraw(1);

    const depositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(depositsToLiquidate.canExec).to.be.equal(false);
  });

  test('should be able to liquidate deposits', async () => {
    const [user] = await ethers.getSigners();

    const liquidatorFactory = await ethers.getContractFactory('StaleDepositLiquidator');
    const liquidator = await liquidatorFactory.deploy(
      getNetworkConfig('31337').existingContracts.gelatoAutomate,
      _locker.address,
    );

    await _micToken.approve(_locker.address, ethers.utils.parseEther('1'));
    await _locker.stake(0, 0, ethers.utils.parseEther('1'), 1);

    await time.increase(time.duration.days(91));

    const depositsToLiquidate = await liquidator.getListOfStaleDepositsToLiquidate();
    expect(depositsToLiquidate.canExec).to.be.equal(true);

    await liquidator.liquidateStaleDeposits([
      {
        depositor: user.address,
        depositId: 1,
      },
    ]);

    const deposit = await _locker.getDeposit(user.address, 1);
    expect(deposit.isOngoing).to.be.equal(false);
  });
});
