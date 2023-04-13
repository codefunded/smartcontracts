import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { test } from 'mocha';
import { ethers } from 'hardhat';
import { prepareFundswapTestEnv } from '../../utils/testHelpers/fixtures/prepareFundswapTestEnv';
import { expect } from 'chai';
import { hashOrder } from '../../utils/testHelpers/hashOrder';

describe('TokenWhitelist', () => {
  it('owner should be allowed to whitelist a token', async () => {
    const { fundSwap } = await loadFixture(prepareFundswapTestEnv);

    await fundSwap.addTokenToWhitelist(ethers.constants.AddressZero);
    const whitelistedTokens = await fundSwap.getWhitelistedTokens();
    expect(whitelistedTokens).to.include(ethers.constants.AddressZero);
    expect(whitelistedTokens.length).to.be.equal(4);
  });

  it('owner should be allowed to remove a token from whitelist', async () => {
    const { fundSwap, erc20Token } = await loadFixture(prepareFundswapTestEnv);

    await fundSwap.removeTokenFromWhitelist(erc20Token.address);
    const whitelistedTokens = await fundSwap.getWhitelistedTokens();
    expect(whitelistedTokens).to.not.include(erc20Token.address);
    expect(whitelistedTokens.length).to.be.equal(2);
  });

  it('should allow to get the list of whitelisted tokens', async () => {
    const { fundSwap, erc20Token, wmaticToken, usdcToken } = await loadFixture(
      prepareFundswapTestEnv,
    );

    const whitelistedTokens = await fundSwap.getWhitelistedTokens();
    expect(whitelistedTokens).to.have.members([
      erc20Token.address,
      wmaticToken.address,
      usdcToken.address,
    ]);
  });

  it('should not allow to create a public order for a token that is not whitelisted', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);

    await fundSwap.removeTokenFromWhitelist(erc20Token.address);

    await expect(
      fundSwap.createPublicOrder({
        offeredToken: erc20Token.address,
        amountOffered: ethers.utils.parseEther('1'),
        wantedToken: wmaticToken.address,
        amountWanted: ethers.utils.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'TokenWhitelist__TokenNotWhitelisted');

    await expect(
      fundSwap.createPublicOrder({
        offeredToken: wmaticToken.address,
        amountOffered: ethers.utils.parseEther('1'),
        wantedToken: erc20Token.address,
        amountWanted: ethers.utils.parseEther('1'),
        deadline: 0,
      }),
    ).to.be.revertedWithCustomError(fundSwap, 'TokenWhitelist__TokenNotWhitelisted');
  });

  it('should not allow to fill a public order with tokens that are not whitelisted', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [, user2] = await ethers.getSigners();

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      amountOffered: ethers.utils.parseEther('1'),
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
      offeredToken: erc20Token.address,
      wantedToken: wmaticToken.address,
    });

    await fundSwap.removeTokenFromWhitelist(erc20Token.address);

    await expect(
      fundSwap.connect(user2).fillPublicOrder(0),
    ).to.be.revertedWithCustomError(fundSwap, 'TokenWhitelist__TokenNotWhitelisted');
  });

  it('should not allow to fill a private order with tokens that are not on whitelist', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);
    const [user1, user2] = await ethers.getSigners();

    await fundSwap.removeTokenFromWhitelist(erc20Token.address);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    const order = {
      amountOffered: ethers.utils.parseEther('1'),
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
      offeredToken: erc20Token.address,
      wantedToken: wmaticToken.address,
      creator: user1.address,
      recipient: user2.address,
      creationTimestamp: Math.floor(Date.now() / 1000),
    };
    const orderHash = hashOrder(order);
    const signature = await user1.signMessage(ethers.utils.arrayify(orderHash));

    await expect(
      fundSwap.connect(user2).fillPrivateOrder(order, orderHash, signature),
    ).to.be.revertedWithCustomError(fundSwap, 'TokenWhitelist__TokenNotWhitelisted');
  });

  it('should allow to cancel a public order even when tokens are no longer on the whitelist', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('1'));
    await fundSwap.createPublicOrder({
      amountOffered: ethers.utils.parseEther('1'),
      amountWanted: ethers.utils.parseEther('1'),
      deadline: 0,
      offeredToken: erc20Token.address,
      wantedToken: wmaticToken.address,
    });

    await fundSwap.removeTokenFromWhitelist(erc20Token.address);

    await fundSwap.cancelOrder(0);
  });
});
