import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { test } from 'mocha';
import { ethers } from 'hardhat';
import { prepareFundswapTestEnv } from '../../utils/testHelpers/fixtures/prepareFundswapTestEnv';
import { expect } from 'chai';
import { DEFAULT_FEE } from '../../utils/constants';

describe('FeeAggregator', () => {
  it('should allow to get current fee value in basis points', async () => {
    const { fundSwap } = await loadFixture(prepareFundswapTestEnv);

    const currentFee = await fundSwap.defaultFee();
    expect(currentFee).to.equal(DEFAULT_FEE);
    const maxFee = await fundSwap.MAX_FEE();
    expect(maxFee).to.equal(10000);
  });

  it('owner should be allowed to set a new fee value', async () => {
    const { fundSwap } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();
    const fundSwapOwner = await fundSwap.owner();
    expect(fundSwapOwner).to.equal(user1.address);

    await fundSwap.setDefaultFee(100);
    const currentFee = await fundSwap.defaultFee();
    expect(currentFee).to.equal(100);

    await expect(fundSwap.connect(user2).setDefaultFee(100)).to.be.revertedWith(
      'Ownable: caller is not the owner',
    );
  });

  it('should accrue fees when public market order is executed', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(0);

    expect(await erc20Token.balanceOf(fundSwap.address)).to.equal(
      ethers.utils.parseEther('0.0024'),
    );
  });

  it('owner should be allowed to withdraw fees', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('2'),
      deadline: 0,
    });

    const user1BalanceBeforeSwap = await erc20Token.balanceOf(user1.address);

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(0);

    expect(await erc20Token.balanceOf(fundSwap.address)).to.equal(
      ethers.utils.parseEther('0.0024'),
    );

    await fundSwap.withdrawFees(erc20Token.address, ethers.constants.MaxUint256);

    expect(await erc20Token.balanceOf(fundSwap.address)).to.equal(
      ethers.utils.parseEther('0'),
    );
    expect(await erc20Token.balanceOf(user1.address)).to.equal(
      ethers.utils.parseEther('0.0024').add(user1BalanceBeforeSwap),
    );
  });

  it('should allow owner to set a fee for a specific token', async () => {
    const { fundSwap, erc20Token, wmaticToken, usdcToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('2'));

    await fundSwap.setFeeForAsset(erc20Token.address, 100);

    await fundSwap.connect(user2).fillPublicOrder(0);

    expect(await erc20Token.balanceOf(fundSwap.address)).to.equal(
      ethers.utils.parseEther('0.01'),
    );

    await usdcToken.approve(fundSwap.address, ethers.utils.parseUnits('1', 6));
    await fundSwap.createPublicOrder({
      offeredToken: usdcToken.address,
      amountOffered: ethers.utils.parseUnits('1', 6),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(1);

    // default fee is 0.24%, if not set for a specific token
    expect(await usdcToken.balanceOf(fundSwap.address)).to.equal(
      ethers.utils.parseUnits('0.0024', 6),
    );
  });

  it('should allow to get all fees set for all tokens', async () => {
    const { fundSwap, erc20Token, usdcToken } = await loadFixture(prepareFundswapTestEnv);

    await fundSwap.setFeeForAsset(erc20Token.address, 100);
    await fundSwap.setFeeForAsset(usdcToken.address, 200);

    const fees = await fundSwap.getFeesForAllAssets();

    expect(fees.assets[0]).to.equal(erc20Token.address);
    expect(fees.fees[0]).to.equal(100);
    expect(fees.assets[1]).to.equal(usdcToken.address);
    expect(fees.fees[1]).to.equal(200);
  });

  it('should allow to disable swap fee by setting the fee to 0', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [, user2] = await ethers.getSigners();

    await fundSwap.setFeeForAsset(erc20Token.address, 0);

    const fees = await fundSwap.getFeesForAllAssets();
    expect(fees.assets[0]).to.equal(erc20Token.address);
    expect(fees.fees[0]).to.equal(0);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('2'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('2'));

    await fundSwap.connect(user2).fillPublicOrder(0);

    expect(await erc20Token.balanceOf(fundSwap.address)).to.equal(0);
  });
});
