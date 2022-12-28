import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { prepareFullTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('NativeTokenReceiver', async () => {
  test('should allow to receive and withdraw native tokens', async () => {
    const { periodStarter } = await prepareFullTestEnv();
    const [user] = await ethers.getSigners();

    const userBalance = await ethers.provider.getBalance(user.address);

    await user.sendTransaction({
      to: periodStarter.address,
      value: ethers.utils.parseEther('1'),
    });

    const balance = await ethers.provider.getBalance(periodStarter.address);
    expect(balance).to.be.equal(ethers.utils.parseEther('1'));

    await periodStarter.withdrawFunds(user.address);

    const userBalanceAfter = await ethers.provider.getBalance(user.address);

    const balanceAfter = await ethers.provider.getBalance(periodStarter.address);
    expect(balanceAfter).to.be.equal(0);

    expect(userBalanceAfter).to.be.approximately(
      userBalance,
      ethers.utils.parseEther('0.1'), // deduct gas fee
    );
  });
});
