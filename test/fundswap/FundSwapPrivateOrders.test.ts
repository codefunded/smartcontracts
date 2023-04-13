import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { test } from 'mocha';
import { ethers } from 'hardhat';
import { prepareFundswapTestEnv } from '../../utils/testHelpers/fixtures/prepareFundswapTestEnv';
import { hashOrder } from '../../utils/testHelpers/hashOrder';

describe('PrivateOrders', () => {
  it('Create private order should correctly hash message', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();
    const order = {
      nonce: '0',
      creator: user1.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };
    const hashedOrderInContract = await fundSwap.createPrivateOrder(order);

    const hashedOrderInEthers = hashOrder(order);
    expect(hashedOrderInContract).to.equal(hashedOrderInEthers);
  });

  it('Should not allow recipient to modify the order', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const order = {
      nonce: '0',
      creator: user1.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.utils.arrayify(orderHash));

    const modifiedOrder = {
      ...order,
      amountOffered: ethers.utils.parseEther('2'),
    };
    const modifiedOrderHash = hashOrder(order);

    await expect(
      fundSwap.fillPrivateOrder(modifiedOrder, modifiedOrderHash, signature),
    ).to.be.revertedWithCustomError(fundSwap, 'OrderSignatureVerifier__InvalidOrderHash');
  });

  it('Should correctly verify the signature', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    const order = {
      nonce: '0',
      creator: user1.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.utils.arrayify(orderHash));
    const isSignedByCreator = await fundSwap.verifyOrder(order, orderHash, signature);

    expect(isSignedByCreator).to.equal(true);
    expect(user1.address).to.equal(order.creator);

    const wrongSignature = await user2.signMessage(ethers.utils.arrayify(orderHash));
    const wrongSignatureVerificationResult = await fundSwap.verifyOrder(
      order,
      orderHash,
      wrongSignature,
    );
    expect(wrongSignatureVerificationResult).to.equal(false);
  });

  it('Should allow to fill private order', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    // user1 has all erc20 tokens and user2 has all wmatic tokens
    await erc20Token
      .connect(user2)
      .transfer(user1.address, erc20Token.balanceOf(user2.address));
    await wmaticToken
      .connect(user1)
      .transfer(user2.address, wmaticToken.balanceOf(user1.address));

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));

    const order = {
      nonce: '0',
      creator: user1.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.utils.arrayify(orderHash));

    await wmaticToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseEther('1'));

    await fundSwap.connect(user2).fillPrivateOrder(order, orderHash, signature);

    expect(await wmaticToken.balanceOf(user1.address)).to.be.greaterThan(0);
    expect(await erc20Token.balanceOf(user2.address)).to.be.greaterThan(0);
  });

  it('Should not allow other users to accept a private order', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));

    const order = {
      nonce: '0',
      creator: user1.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('1'),
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.utils.arrayify(orderHash));

    await wmaticToken.approve(fundSwap.address, ethers.utils.parseEther('1'));

    await expect(
      fundSwap.fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__YouAreNotARecipient');
  });

  it('Private swaps should work with tokens that have different decimal values', async () => {
    const { fundSwap, erc20Token, usdcToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));

    const order = {
      creator: user1.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: usdcToken.address,
      amountWanted: ethers.utils.parseUnits('100', 6), // USDC decimals are 6
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.utils.arrayify(orderHash));

    await usdcToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseUnits('100', 6));

    await erc20Token
      .connect(user2)
      .transfer(fundSwap.address, erc20Token.balanceOf(user2.address));
    await usdcToken
      .connect(user1)
      .transfer(fundSwap.address, usdcToken.balanceOf(user1.address));

    await fundSwap.connect(user2).fillPrivateOrder(order, orderHash, signature);

    expect(await usdcToken.balanceOf(user1.address)).to.be.equal(
      ethers.utils.parseUnits('100', 6),
    );
    const feeAmount = ethers.utils
      .parseEther('1')
      .mul(await fundSwap.defaultFee())
      .div(10000);
    expect(await erc20Token.balanceOf(user2.address)).to.be.equal(
      ethers.utils.parseEther('1').sub(feeAmount),
    );
  });

  it('Should not allow to fill the same private order multiple times', async () => {
    const { fundSwap, erc20Token, usdcToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));

    const order = {
      creator: user1.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: usdcToken.address,
      amountWanted: ethers.utils.parseUnits('100', 6), // USDC decimals are 6
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.utils.arrayify(orderHash));

    await usdcToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseUnits('100', 6));

    await erc20Token
      .connect(user2)
      .transfer(fundSwap.address, erc20Token.balanceOf(user2.address));
    await usdcToken
      .connect(user1)
      .transfer(fundSwap.address, usdcToken.balanceOf(user1.address));

    await fundSwap.connect(user2).fillPrivateOrder(order, orderHash, signature);

    expect(await usdcToken.balanceOf(user1.address)).to.be.equal(
      ethers.utils.parseUnits('100', 6),
    );

    const feeAmount = ethers.utils
      .parseEther('1')
      .mul(await fundSwap.defaultFee())
      .div(10000);
    expect(await erc20Token.balanceOf(user2.address)).to.be.equal(
      ethers.utils.parseEther('1').sub(feeAmount),
    );

    await expect(
      fundSwap.connect(user2).fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__OrderHaveAlreadyBeenExecuted');
  });

  it('should allow to invalidate a private order', async () => {
    const { fundSwap, erc20Token, usdcToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));

    const order = {
      creator: user1.address,
      deadline: Math.floor(Date.now() / 1000) + 60,
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: usdcToken.address,
      amountWanted: ethers.utils.parseUnits('100', 6), // USDC decimals are 6
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };

    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.utils.arrayify(orderHash));

    await usdcToken
      .connect(user2)
      .approve(fundSwap.address, ethers.utils.parseUnits('100', 6));

    await erc20Token
      .connect(user2)
      .transfer(fundSwap.address, erc20Token.balanceOf(user2.address));
    await usdcToken
      .connect(user1)
      .transfer(fundSwap.address, usdcToken.balanceOf(user1.address));

    await expect(
      fundSwap.connect(user2).invalidatePrivateOrder(order),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__NotAnOwner');

    await fundSwap.invalidatePrivateOrder(order);

    await expect(
      fundSwap.connect(user2).fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(fundSwap, 'FundSwap__OrderHaveAlreadyBeenExecuted');
  });
});
