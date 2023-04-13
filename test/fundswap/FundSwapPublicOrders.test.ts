import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { test } from 'mocha';
import { ethers } from 'hardhat';
import { prepareFundswapTestEnv } from '../../utils/testHelpers/fixtures/prepareFundswapTestEnv';

describe('PublicOrders', () => {
  it('Should deploy FundSwap and FundSwapOrderManager', async () => {
    const { fundSwap, fundSwapOrderManager } = await loadFixture(prepareFundswapTestEnv);

    expect(fundSwap.address).to.be.properAddress;
    expect(fundSwapOrderManager.address).to.be.properAddress;
  });

  it('Should allow to create a public order', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));

    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });

    const tokenId = await fundSwapOrderManager.tokenOfOwnerByIndex(user1.address, 0);
    const order = await fundSwapOrderManager.getOrder(tokenId);
    expect(await fundSwapOrderManager.balanceOf(user1.address)).to.equal(1);
    expect(order.offeredToken).to.equal(erc20Token.address);
    expect(order.amountOffered).to.equal(ethers.utils.parseEther('1'));
    expect(order.wantedToken).to.equal(wmaticToken.address);
    expect(order.amountWanted).to.equal(ethers.utils.parseEther('1'));
    expect(order.deadline).to.equal(0);
  });
  it('Should allow to cancel a public order with withdrawal of offered tokens', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1] = await ethers.getSigners();

    const balanceBeforeOrderCreation = await erc20Token.balanceOf(user1.address);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });
    const balanceAfterOrderCreation = await erc20Token.balanceOf(user1.address);

    await fundSwap.cancelOrder(0);
    const balanceAfterOrderCancellation = await erc20Token.balanceOf(user1.address);
    expect(await fundSwapOrderManager.balanceOf(user1.address)).to.equal(0);
    expect(balanceBeforeOrderCreation).to.equal(balanceAfterOrderCancellation);
    expect(balanceAfterOrderCreation).to.be.lessThan(balanceAfterOrderCancellation);
  });

  it('Should allow to fill a particular public order', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.address);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.connect(user2).fillPublicOrder(0);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.address);

    const FEE = ethers.utils.parseEther('0.0024'); // 1 * 0.24%

    expect(await fundSwapOrderManager.totalSupply()).to.equal(0);
    expect(erc20User1BalanceBefore.sub(ethers.utils.parseEther('1'))).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(
      erc20User2BalanceBefore.add(ethers.utils.parseEther('1')).sub(FEE),
    ).to.be.equal(erc20User2BalanceAfter);
    expect(wethUser1BalanceBefore.add(ethers.utils.parseEther('1'))).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore.sub(ethers.utils.parseEther('1'))).to.be.equal(
      wethUser2BalanceAfter,
    );
    expect(await erc20Token.balanceOf(fundSwap.address)).to.equal(FEE);
  });

  it('Should allow to fill by market with exact amount of input tokens', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.address);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('3'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('2'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('1.5'));

    await fundSwap.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.utils.parseEther('1'),
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        maxAmountIn: 0,
        minAmountOut: 0,
        amountOut: 0,
      },
      {
        orderId: 1,
        amountIn: ethers.utils.parseEther('0.5'),
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        maxAmountIn: 0,
        minAmountOut: 0,
        amountOut: 0,
      },
    ]);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.address);

    const FEE = ethers.utils.parseEther('0.003'); // 1 * 0.24%

    expect(erc20User1BalanceBefore.sub(ethers.utils.parseEther('3'))).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(
      erc20User2BalanceBefore.add(ethers.utils.parseEther('1.25')).sub(FEE),
    ).to.be.equal(erc20User2BalanceAfter);
    expect(wethUser1BalanceBefore.add(ethers.utils.parseEther('1.5'))).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore.sub(ethers.utils.parseEther('1.5'))).to.be.equal(
      wethUser2BalanceAfter,
    );

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const remainingOrder = await fundSwapOrderManager.getOrder(1);
    expect(remainingOrder.amountOffered).to.be.equal(ethers.utils.parseEther('1.75'));
    expect(remainingOrder.amountWanted).to.be.equal(ethers.utils.parseEther('3.5'));
  });

  it('Should allow to fill by market with exact amount of output tokens', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.address);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('3'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('2'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('1.5'));

    await fundSwap.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.utils.parseEther('1'),
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        maxAmountIn: 0,
        minAmountOut: 0,
        amountOut: 0,
      },
      {
        orderId: 1,
        amountIn: 0, //ethers.utils.parseEther('0.5'),
        orderType: 1, // ExactInput = 0, ExactOutput = 1
        maxAmountIn: 0,
        minAmountOut: 0,
        amountOut: ethers.utils.parseEther('0.25'),
      },
    ]);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.address);

    const FEE = ethers.utils.parseEther('0.003'); // 1 * 0.24%

    expect(erc20User1BalanceBefore.sub(ethers.utils.parseEther('3'))).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(
      erc20User2BalanceBefore.add(ethers.utils.parseEther('1.25')).sub(FEE),
    ).to.be.equal(erc20User2BalanceAfter);
    expect(wethUser1BalanceBefore.add(ethers.utils.parseEther('1.5'))).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore.sub(ethers.utils.parseEther('1.5'))).to.be.equal(
      wethUser2BalanceAfter,
    );

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const remainingOrder = await fundSwapOrderManager.getOrder(1);
    expect(remainingOrder.amountOffered).to.be.equal(ethers.utils.parseEther('1.75'));
    expect(remainingOrder.amountWanted).to.be.equal(ethers.utils.parseEther('3.5'));
  });

  it('Should allow to fill by market with exact amount of output tokens', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceBefore = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceBefore = await wmaticToken.balanceOf(user2.address);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('3'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('2'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('1.5'));

    await fundSwap.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: 0,
        orderType: 1, // ExactInput = 0, ExactOutput = 1
        amountOut: ethers.utils.parseEther('1.25'),
        maxAmountIn: 0,
        minAmountOut: 0,
      },
      {
        orderId: 1,
        amountIn: 0,
        orderType: 1, // ExactInput = 0, ExactOutput = 1
        amountOut: ethers.utils.parseEther('0.25'),
        maxAmountIn: 0,
        minAmountOut: 0,
      },
    ]);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.address);
    const wethUser1BalanceAfter = await wmaticToken.balanceOf(user1.address);
    const wethUser2BalanceAfter = await wmaticToken.balanceOf(user2.address);

    const FEE = ethers.utils.parseEther('0.003'); // 1.25 * 0.24%

    expect(erc20User1BalanceBefore.sub(ethers.utils.parseEther('3'))).to.be.equal(
      erc20User1BalanceAfter,
    );
    expect(
      erc20User2BalanceBefore.add(ethers.utils.parseEther('1.25')).sub(FEE),
    ).to.be.equal(erc20User2BalanceAfter);
    expect(wethUser1BalanceBefore.add(ethers.utils.parseEther('1.5'))).to.be.equal(
      wethUser1BalanceAfter,
    );
    expect(wethUser2BalanceBefore.sub(ethers.utils.parseEther('1.5'))).to.be.equal(
      wethUser2BalanceAfter,
    );

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const remainingOrder = await fundSwapOrderManager.getOrder(1);
    expect(remainingOrder.amountOffered).to.be.equal(ethers.utils.parseEther('1.75'));
    expect(remainingOrder.amountWanted).to.be.equal(ethers.utils.parseEther('3.5'));
  });

  it('Should allow to fill by market when tokens have different decimals', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, usdcToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [user1, user2] = await ethers.getSigners();

    const erc20User1BalanceBefore = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceBefore = await erc20Token.balanceOf(user2.address);
    const usdcUser1BalanceBefore = await usdcToken.balanceOf(user1.address);
    const usdcUser2BalanceBefore = await usdcToken.balanceOf(user2.address);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('3'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: usdcToken.address,
      amountWanted: ethers.utils.parseUnits('100', 6),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('2'),
      wantedToken: usdcToken.address,
      amountWanted: ethers.utils.parseUnits('400', 6),
      deadline: 0,
    });

    await usdcToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseUnits('150', 6));

    await fundSwap.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        amountIn: ethers.utils.parseUnits('100', 6),
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        amountOut: 0,
        maxAmountIn: 0,
        minAmountOut: 0,
      },
      {
        orderId: 1,
        amountIn: 0,
        orderType: 1, // ExactInput = 0, ExactOutput = 1
        amountOut: ethers.utils.parseEther('0.25'),
        maxAmountIn: 0,
        minAmountOut: 0,
      },
    ]);

    const erc20User1BalanceAfter = await erc20Token.balanceOf(user1.address);
    const erc20User2BalanceAfter = await erc20Token.balanceOf(user2.address);
    const usdcUser1BalanceAfter = await usdcToken.balanceOf(user1.address);
    const usdcUser2BalanceAfter = await usdcToken.balanceOf(user2.address);

    const FEE = ethers.utils.parseEther('0.003'); // 1.25 * 0.24%

    expect(erc20User1BalanceAfter).to.be.equal(
      erc20User1BalanceBefore.sub(ethers.utils.parseEther('3')),
    );
    expect(erc20User2BalanceAfter).to.be.equal(
      erc20User2BalanceBefore.add(ethers.utils.parseEther('1.25')).sub(FEE),
    );
    expect(usdcUser1BalanceAfter).to.be.equal(
      usdcUser1BalanceBefore.add(ethers.utils.parseUnits('150', 6)),
    );
    expect(usdcUser2BalanceAfter).to.be.equal(
      usdcUser2BalanceBefore.sub(ethers.utils.parseUnits('150', 6)),
    );

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const remainingOrder = await fundSwapOrderManager.getOrder(1);
    expect(remainingOrder.amountOffered).to.be.equal(ethers.utils.parseEther('1.75'));
    expect(remainingOrder.amountWanted).to.be.equal(ethers.utils.parseUnits('350', 6));
  });

  it('Fill partially a single order', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('1'));

    await fundSwap.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        amountIn: ethers.utils.parseEther('0.5'),
        amountOut: 0,
        maxAmountIn: 0,
        minAmountOut: 0,
      },
    ]);

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(ethers.utils.parseEther('0.5'));
    expect(order.amountWanted).to.be.equal(ethers.utils.parseEther('0.5'));
  });

  it('Fill partially a single order when tokens have different decimals', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, usdcToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: usdcToken.address,
      amountWanted: ethers.utils.parseUnits('100', 6),
      deadline: 0,
    });

    await usdcToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseUnits('100', 6));

    await fundSwap.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        amountIn: ethers.utils.parseUnits('50', 6),
        amountOut: 0,
        maxAmountIn: 0,
        minAmountOut: 0,
      },
    ]);

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(ethers.utils.parseEther('0.5'));
    expect(order.amountWanted).to.be.equal(ethers.utils.parseUnits('50', 6));
  });

  it('Fill partially a single order when tokens have different decimals and base asset has 6 decimals', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, usdcToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [, user2] = await ethers.getSigners();

    await usdcToken.approve(fundSwap.address, ethers.utils.parseUnits('200', 6));
    await fundSwap.createPublicOrder({
      offeredToken: usdcToken.address,
      amountOffered: ethers.utils.parseUnits('200', 6),
      wantedToken: erc20Token.address,
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
    });

    await erc20Token
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('0.5'));

    await fundSwap.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        amountIn: ethers.utils.parseEther('0.5'),
        amountOut: 0,
        maxAmountIn: 0,
        minAmountOut: 0,
      },
    ]);

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(ethers.utils.parseUnits('100', 6));
    expect(order.amountWanted).to.be.equal(ethers.utils.parseEther('0.5'));
    expect(await usdcToken.balanceOf(fundSwap.address)).to.be.equal(
      ethers.utils.parseUnits('100.24', 6), //remaining 100 USDC is still on the contract balance
    );
  });

  it('Fill single order with not even amounts (tests precision)', async () => {
    const { fundSwap, fundSwapOrderManager, erc20Token, wmaticToken } = await loadFixture(
      prepareFundswapTestEnv,
    );
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1.25'));
    await fundSwap.createPublicOrder({
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1.25'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1.4'),
      deadline: 0,
    });

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('0.5'));

    await fundSwap.connect(user2).batchFillPublicOrders([
      {
        orderId: 0,
        orderType: 0, // ExactInput = 0, ExactOutput = 1
        amountIn: ethers.utils.parseEther('0.5'),
        amountOut: 0,
        maxAmountIn: 0,
        minAmountOut: 0,
      },
    ]);

    expect(await fundSwapOrderManager.totalSupply()).to.be.equal(1);
    const order = await fundSwapOrderManager.getOrder(0);
    expect(order.amountOffered).to.be.equal(
      ethers.utils.parseEther('0.803571428571428571'),
    );
    expect(order.amountWanted).to.be.equal(ethers.utils.parseEther('0.9'));
  });

  it('Should return an empty list when there are no orders for a given pair', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('2'));
    expect(
      await fundSwap.getOrdersForPair(erc20Token.address, wmaticToken.address),
    ).to.be.deep.equal([]);
  });

  it('should not allow to create an order when offered and wanted tokens are the same', async () => {
    const { fundSwap, erc20Token } = await loadFixture(prepareFundswapTestEnv);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await expect(
      fundSwap.createPublicOrder({
        offeredToken: erc20Token.address,
        amountOffered: ethers.utils.parseEther('1'),
        wantedToken: erc20Token.address,
        amountWanted: ethers.utils.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__InvalidPath');
  });

  it('should not allow to create an order when offered or wanted amount is zero', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await expect(
      fundSwap.createPublicOrder({
        offeredToken: erc20Token.address,
        amountOffered: 0,
        wantedToken: wmaticToken.address,
        amountWanted: ethers.utils.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__OfferedAmountIsZero');
    await expect(
      fundSwap.createPublicOrder({
        offeredToken: erc20Token.address,
        amountOffered: ethers.utils.parseEther('1'),
        wantedToken: wmaticToken.address,
        amountWanted: 0,
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__WantedAmountIsZero');
  });
});
