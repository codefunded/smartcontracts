import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { test } from 'mocha';
import { ethers } from 'hardhat';
import { prepareFundswapTestEnv } from '../../utils/testHelpers/fixtures/prepareFundswapTestEnv';
import { getPermitSignature } from '../../utils/testHelpers/permit';

describe('Orders with permit', () => {
  it('Should allow to create a public order with permit', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1] = await ethers.getSigners();

    const deadline = ethers.constants.MaxUint256;
    const { v, r, s } = await getPermitSignature(
      user1,
      erc20Token,
      fundSwap.address,
      ethers.utils.parseEther('1'),
      deadline,
    );

    await fundSwap.createPublicOrderWithPermit(
      {
        offeredToken: erc20Token.address,
        amountOffered: ethers.utils.parseEther('1'),
        wantedToken: wmaticToken.address,
        amountWanted: ethers.utils.parseEther('1'),
        deadline: 0,
      },
      deadline,
      v,
      r,
      s,
    );

    const tokenId = await fundSwapOrderManager.tokenOfOwnerByIndex(user1.address, 0);
    const order = await fundSwapOrderManager.getOrder(tokenId);
    expect(await fundSwapOrderManager.balanceOf(user1.address)).to.equal(1);
    expect(order.offeredToken).to.equal(erc20Token.address);
    expect(order.amountOffered).to.equal(ethers.utils.parseEther('1'));
    expect(order.wantedToken).to.equal(wmaticToken.address);
    expect(order.amountWanted).to.equal(ethers.utils.parseEther('1'));
    expect(order.deadline).to.equal(0);
  });

  it('Should allow to fill a particular public order with permit', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.address);

    await wmaticToken.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: wmaticToken.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: erc20Token.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });

    const deadline = ethers.constants.MaxUint256;
    const { v, r, s } = await getPermitSignature(
      user2,
      erc20Token,
      fundSwap.address,
      ethers.utils.parseEther('1'),
    );

    await fundSwap.connect(user2).fillPublicOrderWithPermit(0, deadline, v, r, s);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.address);

    const FEE = ethers.utils.parseEther('0.0024'); // 1 * 0.24%

    expect(await fundSwapOrderManager.totalSupply()).to.equal(0);

    expect(erc20User1BalanceBefore.add(ethers.utils.parseEther('1'))).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(erc20User2BalanceBefore.sub(ethers.utils.parseEther('1'))).to.be.equal(
      erc20User2BalanceAfter,
    );
    expect(wethUser1BalanceBefore.sub(ethers.utils.parseEther('1'))).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore.add(ethers.utils.parseEther('1')).sub(FEE)).to.be.equal(
      wethUser2BalanceAfter,
    );
    expect(await wmaticToken.balanceOf(fundSwap.address)).to.equal(FEE);
  });

  it('Should allow to fill by market with permit', async () => {
    const { fundSwap, wmaticToken, usdcToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const wmaticUser1BalanceBefore = await wmaticToken.balanceOf(user1.address);
    const wmaticUser2BalanceBefore = await wmaticToken.balanceOf(user2.address);
    const usdcUser1BalanceBefore = await usdcToken.balanceOf(user1.address);
    const usdcUser2BalanceBefore = await usdcToken.balanceOf(user2.address);

    await wmaticToken.approve(fundSwap.address, ethers.utils.parseEther('3'));
    await fundSwap.createPublicOrder({
      offeredToken: wmaticToken.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: usdcToken.address,
      amountWanted: ethers.utils.parseUnits('1', 6),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      offeredToken: wmaticToken.address,
      amountOffered: ethers.utils.parseEther('2'),
      wantedToken: usdcToken.address,
      amountWanted: ethers.utils.parseUnits('2', 6),
      deadline: 0,
    });

    const deadline = ethers.constants.MaxUint256;
    const { v, r, s } = await getPermitSignature(
      user2,
      usdcToken,
      fundSwap.address,
      ethers.utils.parseUnits('2', 6),
    );

    await fundSwap.connect(user2).batchFillPublicOrdersWithEntryPermit(
      [
        {
          orderId: 0,
          orderType: 0,
          amountIn: ethers.utils.parseUnits('1', 6),
          amountOut: 0,
          maxAmountIn: 0,
          minAmountOut: 0,
        },
        {
          orderId: 1,
          orderType: 0,
          amountIn: ethers.utils.parseUnits('1', 6),
          amountOut: 0,
          maxAmountIn: 0,
          minAmountOut: 0,
        },
      ],
      ethers.utils.parseUnits('2', 6),
      deadline,
      v,
      r,
      s,
    );

    const wmaticUser1BalanceAfter = await wmaticToken.balanceOf(user1.address);
    const wmaticUser2BalanceAfter = await wmaticToken.balanceOf(user2.address);
    const usdcUser1BalanceAfter = await usdcToken.balanceOf(user1.address);
    const usdcUser2BalanceAfter = await usdcToken.balanceOf(user2.address);

    const FEE = ethers.utils.parseEther('0.0048'); // 2 * 0.24%

    expect(usdcUser1BalanceAfter).to.be.equal(
      usdcUser1BalanceBefore.add(ethers.utils.parseUnits('2', 6)),
    );
    expect(usdcUser2BalanceAfter).to.be.equal(
      usdcUser2BalanceBefore.sub(ethers.utils.parseUnits('2', 6)),
    );
    expect(wmaticUser1BalanceAfter).to.be.equal(
      wmaticUser1BalanceBefore.sub(ethers.utils.parseEther('3')),
    );
    expect(wmaticUser2BalanceAfter).to.be.equal(
      wmaticUser2BalanceBefore.add(ethers.utils.parseEther('2')).sub(FEE),
    );
  });

  it('Fill partially a single orderXX', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [, user2] = await ethers.getSigners();

    await wmaticToken.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: wmaticToken.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: erc20Token.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });

    const deadline = ethers.constants.MaxUint256;
    const { v, r, s } = await getPermitSignature(
      user2,
      erc20Token,
      fundSwap.address,
      ethers.utils.parseEther('0.5'),
    );

    await fundSwap.connect(user2).fillPublicOrderPartiallyWithPermit(
      {
        orderId: 0,
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        amountIn: ethers.utils.parseEther('0.5'),
        amountOut: 0,
        maxAmountIn: 0,
        minAmountOut: 0,
      },
      deadline,
      v,
      r,
      s,
    );

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(ethers.utils.parseEther('0.5'));
    expect(order.amountWanted).to.be.equal(ethers.utils.parseEther('0.5'));
  });
});
