import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { prepareFundswapTestEnv } from '../../utils/testHelpers/fixtures/prepareFundswapTestEnv';
import { test } from 'mocha';
import { createTradeRoute, sortOrdersByPrice } from '../../utils/router';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

describe('Router', () => {
  describe('sortByPrice helper', () => {
    it('Should sort orders by price from the lowest to highest', () => {
      const orders = [
        {
          orderId: BigNumber.from(0),
          offeredToken: '1',
          wantedToken: '2',
          amountOffered: ethers.utils.parseEther('3'),
          amountWanted: ethers.utils.parseEther('15'),
          deadline: BigNumber.from(0),
        },
        {
          orderId: BigNumber.from(1),
          offeredToken: '1',
          wantedToken: '2',
          amountOffered: ethers.utils.parseEther('2'),
          amountWanted: ethers.utils.parseEther('2'),
          deadline: BigNumber.from(0),
        },
      ];
      const sortedByPrice = [...orders].sort(sortOrdersByPrice);
      expect(sortedByPrice[0]).to.be.equal(orders[1]);
      expect(sortedByPrice[1]).to.be.equal(orders[0]);
    });
  });

  it('router should return an empty path when there are no orders for given pair', async () => {
    const { erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);

    const path = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: erc20Token.address,
        sourceToken: wmaticToken.address,
        sourceAmount: ethers.utils.parseEther('2'),
      },
      [],
    );

    expect(path).to.be.deep.equal([]);
  });

  it('router should route through the best path when exact input is specified', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('3'));
    await fundSwap.createPublicOrder({
      // ID 0
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('4'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      // ID 1
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('5'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      // ID 2
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('2'),
      deadline: 0,
    });

    const orders = await fundSwap.getOrdersForPair(
      erc20Token.address,
      wmaticToken.address,
    );

    const pathSingle = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: erc20Token.address,
        sourceToken: wmaticToken.address,
        sourceAmount: ethers.utils.parseEther('2'),
      },
      orders,
    );
    expect(pathSingle).to.be.deep.equal([2]);

    const pathTwo = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: erc20Token.address,
        sourceToken: wmaticToken.address,
        sourceAmount: ethers.utils.parseEther('6'),
      },
      orders,
    );
    expect(pathTwo).to.be.deep.equal([2, 0]);

    const pathTriple = createTradeRoute(
      {
        type: 'EXACT_INPUT',
        destinationToken: erc20Token.address,
        sourceToken: wmaticToken.address,
        sourceAmount: ethers.utils.parseEther('7'),
      },
      orders,
    );

    expect(pathTriple).to.be.deep.equal([2, 0, 1]);
  });

  it('getBestTradePathForExactOutput router function should route through the best path', async () => {
    const { fundSwap, erc20Token, wmaticToken } = await loadFixture(prepareFundswapTestEnv);

    await erc20Token.approve(fundSwap.address, ethers.utils.parseEther('3'));
    await fundSwap.createPublicOrder({
      // ID 0
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('4'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      // ID 1
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('5'),
      deadline: 0,
    });
    await fundSwap.createPublicOrder({
      // ID 2
      offeredToken: erc20Token.address,
      amountOffered: ethers.utils.parseEther('1'),
      wantedToken: wmaticToken.address,
      amountWanted: ethers.utils.parseEther('2'),
      deadline: 0,
    });

    const orders = await fundSwap.getOrdersForPair(
      erc20Token.address,
      wmaticToken.address,
    );

    const pathSingle = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: erc20Token.address,
        sourceToken: wmaticToken.address,
        destinationAmount: ethers.utils.parseEther('1'),
      },
      orders,
    );
    expect(pathSingle).to.be.deep.equal([2]);

    const pathTwo = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: erc20Token.address,
        sourceToken: wmaticToken.address,
        destinationAmount: ethers.utils.parseEther('2'),
      },
      orders,
    );
    expect(pathTwo).to.be.deep.equal([2, 0]);

    const pathTriple = createTradeRoute(
      {
        type: 'EXACT_OUTPUT',
        destinationToken: erc20Token.address,
        sourceToken: wmaticToken.address,
        destinationAmount: ethers.utils.parseEther('3'),
      },
      orders,
    );
    expect(pathTriple).to.be.deep.equal([2, 0, 1]);
  });
});
