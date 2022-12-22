import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { addLiquidityToPair } from '../utils/addLiquidityToPair';
import { createDexPair } from '../utils/createDexPair';
import { prepareSimpleTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

describe('LiquidityValueCalculator contract', async () => {
  test('should calculate the amounts of tokens that make up the liquidity pool', async () => {
    const { micToken, usdcToken } = await loadFixture(prepareSimpleTestEnv);
    const [user] = await ethers.getSigners();

    const dexPairAddress = await createDexPair({
      token0: micToken.address,
      token1: usdcToken.address,
    });
    const dexPair = await ethers.getContractAt('IUniswapV2Pair', dexPairAddress);

    const amountA = ethers.utils.parseEther('100');
    const amountB = ethers.utils.parseUnits('125', 6);

    await addLiquidityToPair({
      token0: micToken,
      token1: usdcToken,
      amount0: amountA,
      amount1: amountB,
      userAddress: user.address,
    });

    const LiquidityValueCalculatorFactory = await ethers.getContractFactory(
      'LiquidityValueCalculatorMock',
    );
    const liquidityValueCalculator = await LiquidityValueCalculatorFactory.deploy();

    const { tokenAAmount, tokenBAmount } =
      await liquidityValueCalculator.computeLiquidityShareValue(
        dexPairAddress,
        dexPair.balanceOf(user.address),
        micToken.address,
      );

    expect(tokenAAmount).to.be.approximately(amountA, ethers.utils.parseEther('0.1'));
    expect(tokenBAmount).to.be.approximately(amountB, ethers.utils.parseUnits('0.1', 6));
  });
});
