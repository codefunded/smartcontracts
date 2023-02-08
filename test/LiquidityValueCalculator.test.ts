import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';
import { addLiquidityToPair } from '../utils/addLiquidityToPair';
import { createDexPair } from '../utils/createDexPair';
import { prepareSimpleTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  ERC20,
  IERC20,
  IUniswapV2Pair,
  LiquidityValueCalculatorMock,
} from '../typechain-types';
import { getNetworkConfig } from '../utils/networkConfigs';

const dexRouterAddress = getNetworkConfig('31337').existingContracts?.dexRouter;

const amountA = ethers.utils.parseEther('100');
const amountB = ethers.utils.parseUnits('125', 6);
const amountB18Decimals = ethers.utils.parseEther('125');

async function prepareLPEnvDifferentDecimals() {
  const { micToken, usdcToken } = await prepareSimpleTestEnv();
  const [user1, user2] = await ethers.getSigners();
  const LiquidityValueCalculatorFactory = await ethers.getContractFactory(
    'LiquidityValueCalculatorMock',
  );
  const liquidityValueCalculator = await LiquidityValueCalculatorFactory.deploy();
  const dexPairAddress = await createDexPair({
    token0: micToken.address,
    token1: usdcToken.address,
  });
  const dexPair = await ethers.getContractAt('IUniswapV2Pair', dexPairAddress);

  await addLiquidityToPair({
    token0: micToken,
    token1: usdcToken,
    amount0: amountA,
    amount1: amountB,
    userAddress: user1.address,
  });

  return {
    micToken,
    usdcToken,
    liquidityValueCalculator,
    user1,
    user2,
    dexPairAddress,
    dexPair,
  };
}

async function prepareLPEnv18Decimals() {
  const { micToken, iceToken } = await prepareSimpleTestEnv();
  const [user1, user2] = await ethers.getSigners();
  const LiquidityValueCalculatorFactory = await ethers.getContractFactory(
    'LiquidityValueCalculatorMock',
  );
  const liquidityValueCalculator = await LiquidityValueCalculatorFactory.deploy();
  const dexPairAddress = await createDexPair({
    token0: micToken.address,
    token1: iceToken.address,
  });
  const dexPair = await ethers.getContractAt('IUniswapV2Pair', dexPairAddress);

  await addLiquidityToPair({
    token0: micToken,
    token1: iceToken,
    amount0: amountA,
    amount1: amountB18Decimals,
    userAddress: user1.address,
  });

  return {
    micToken,
    iceToken,
    liquidityValueCalculator,
    user1,
    user2,
    dexPairAddress,
    dexPair,
  };
}

describe('TWAP Oracle & LiquidityValueCalculator library', async () => {
  describe('different token decimals', () => {
    let micToken: ERC20;
    let usdcToken: IERC20;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let liquidityValueCalculator: LiquidityValueCalculatorMock;
    let dexPairAddress: string;
    let dexPair: IUniswapV2Pair;

    beforeEach(async () => {
      ({
        dexPair,
        dexPairAddress,
        liquidityValueCalculator,
        micToken,
        usdcToken,
        user1,
        user2,
      } = await loadFixture(prepareLPEnvDifferentDecimals));
    });

    test('should calculate the amounts of tokens that make up the liquidity pool', async () => {
      const oracleFactory = await ethers.getContractFactory('UniswapV2TwapOracle');
      const oracle = await oracleFactory.deploy(
        getNetworkConfig('31337').existingContracts.gelatoAutomate!,
        dexPairAddress,
        time.duration.hours(6),
      );

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const amountOfLPTokens = await dexPair.balanceOf(user1.address);

      const { tokenAAmount, tokenBAmount } =
        await liquidityValueCalculator.calculateLiquidityValue(
          oracle.address,
          micToken.address,
          amountOfLPTokens,
        );

      expect(tokenAAmount).to.be.approximately(amountA, ethers.utils.parseEther('0.1'));
      expect(tokenBAmount).to.be.approximately(
        amountB,
        ethers.utils.parseUnits('0.1', 6),
      );

      const { tokenAAmount: halfTokenAAmount, tokenBAmount: halfTokenBAmount } =
        await liquidityValueCalculator.calculateLiquidityValue(
          oracle.address,
          micToken.address,
          amountOfLPTokens.div(2),
        );

      expect(halfTokenAAmount).to.be.approximately(
        amountA.div(2),
        ethers.utils.parseEther('0.1'),
      );
      expect(halfTokenBAmount).to.be.approximately(
        amountB.div(2),
        ethers.utils.parseUnits('0.1', 6),
      );
    });

    test('Oracle should return correct prices after price change of assets', async () => {
      const oracleFactory = await ethers.getContractFactory('UniswapV2TwapOracle');
      const oracle = await oracleFactory.deploy(
        getNetworkConfig('31337').existingContracts.gelatoAutomate!,
        dexPairAddress,
        time.duration.hours(6),
      );

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const micPriceBeforeTrade = await oracle.consult(
        micToken.address,
        ethers.utils.parseEther('1'),
      );

      const dexRouter = await ethers.getContractAt(
        'IUniswapV2Router01',
        dexRouterAddress!,
      );

      await micToken.approve(dexRouter.address, ethers.constants.MaxUint256);
      await dexRouter.swapExactTokensForTokens(
        ethers.utils.parseEther('10'),
        ethers.utils.parseUnits('1', 6),
        [micToken.address, usdcToken.address],
        user2.address,
        ethers.constants.MaxUint256,
      );

      const micPriceAfterTradeBeforeUpdate = await oracle.consult(
        micToken.address,
        ethers.utils.parseEther('1'),
      );
      expect(micPriceBeforeTrade).to.be.eq(micPriceAfterTradeBeforeUpdate);

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const micPriceAfterTradeAfterUpdate = await oracle.consult(
        micToken.address,
        ethers.utils.parseEther('1'),
      );

      expect(micPriceBeforeTrade).to.be.greaterThan(micPriceAfterTradeAfterUpdate);
      // invariant: 100 MIC * 125 USDC => 12500
      // after trade: 110 MIC * x USDC => 12500
      // x = 12500 / 110 = 113.(63)
      // MIC price after trade: 12500 / 113.(63) ~~ 1,0330578512 USDC
      expect(micPriceAfterTradeAfterUpdate).to.be.approximately(
        ethers.utils.parseUnits('1.03305', 6),
        ethers.utils.parseUnits('0.001', 6),
      );
    });

    test('should calculate liquidity correctly after price change', async () => {
      const oracleFactory = await ethers.getContractFactory('UniswapV2TwapOracle');
      const oracle = await oracleFactory.deploy(
        getNetworkConfig('31337').existingContracts.gelatoAutomate!,
        dexPairAddress,
        time.duration.hours(6),
      );

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const amountOfLPTokens = await dexPair.balanceOf(user1.address);

      const { tokenAAmount, tokenBAmount } =
        await liquidityValueCalculator.calculateLiquidityValue(
          oracle.address,
          micToken.address,
          amountOfLPTokens,
        );

      expect(tokenAAmount).to.be.approximately(amountA, ethers.utils.parseEther('0.1'));
      expect(tokenBAmount).to.be.approximately(amountB, ethers.utils.parseUnits('1', 6));

      const dexRouter = await ethers.getContractAt(
        'IUniswapV2Router01',
        dexRouterAddress!,
      );

      await micToken.approve(dexRouter.address, ethers.constants.MaxUint256);
      await dexRouter.swapExactTokensForTokens(
        ethers.utils.parseEther('10'),
        ethers.utils.parseUnits('1', 6),
        [micToken.address, usdcToken.address],
        user2.address,
        ethers.constants.MaxUint256,
      );

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const {
        tokenAAmount: tokenAAmountAfterTrade,
        tokenBAmount: tokenBAmountAfterTrade,
      } = await liquidityValueCalculator.calculateLiquidityValue(
        oracle.address,
        micToken.address,
        amountOfLPTokens,
      );

      const [reserve0, reserve1] = await dexPair.getReserves();
      const token0 = await dexPair.token0();
      if (token0 === micToken.address) {
        expect(reserve0).to.be.approximately(
          tokenAAmountAfterTrade,
          ethers.utils.parseEther('0.1'),
        );
        expect(reserve1).to.be.approximately(
          tokenBAmountAfterTrade,
          ethers.utils.parseUnits('0.1', 6),
        );
      } else {
        expect(reserve0).to.be.approximately(
          tokenBAmountAfterTrade,
          ethers.utils.parseUnits('0.1', 6),
        );
        expect(reserve1).to.be.approximately(
          tokenAAmountAfterTrade,
          ethers.utils.parseEther('0.1'),
        );
      }
    });
  });

  describe('Same token decimals', () => {
    let micToken: ERC20;
    let iceToken: IERC20;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let liquidityValueCalculator: LiquidityValueCalculatorMock;
    let dexPairAddress: string;
    let dexPair: IUniswapV2Pair;

    beforeEach(async () => {
      ({
        dexPair,
        dexPairAddress,
        liquidityValueCalculator,
        micToken,
        iceToken,
        user1,
        user2,
      } = await loadFixture(prepareLPEnv18Decimals));
    });

    test('should calculate the amounts of tokens that make up the liquidity pool', async () => {
      const oracleFactory = await ethers.getContractFactory('UniswapV2TwapOracle');
      const oracle = await oracleFactory.deploy(
        getNetworkConfig('31337').existingContracts.gelatoAutomate!,
        dexPairAddress,
        time.duration.hours(6),
      );

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const amountOfLPTokens = await dexPair.balanceOf(user1.address);

      const { tokenAAmount, tokenBAmount } =
        await liquidityValueCalculator.calculateLiquidityValue(
          oracle.address,
          micToken.address,
          amountOfLPTokens,
        );

      expect(tokenAAmount).to.be.approximately(amountA, ethers.utils.parseEther('0.1'));
      expect(tokenBAmount).to.be.approximately(
        amountB18Decimals,
        ethers.utils.parseEther('0.1'),
      );

      const { tokenAAmount: halfTokenAAmount, tokenBAmount: halfTokenBAmount } =
        await liquidityValueCalculator.calculateLiquidityValue(
          oracle.address,
          micToken.address,
          amountOfLPTokens.div(2),
        );

      expect(halfTokenAAmount).to.be.approximately(
        amountA.div(2),
        ethers.utils.parseEther('0.1'),
      );
      expect(halfTokenBAmount).to.be.approximately(
        amountB18Decimals.div(2),
        ethers.utils.parseEther('0.1'),
      );
    });

    test('Oracle should return correct prices after price change of assets', async () => {
      const oracleFactory = await ethers.getContractFactory('UniswapV2TwapOracle');
      const oracle = await oracleFactory.deploy(
        getNetworkConfig('31337').existingContracts.gelatoAutomate!,
        dexPairAddress,
        time.duration.hours(6),
      );

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const micPriceBeforeTrade = await oracle.consult(
        micToken.address,
        ethers.utils.parseEther('1'),
      );

      const dexRouter = await ethers.getContractAt(
        'IUniswapV2Router01',
        dexRouterAddress!,
      );

      await micToken.approve(dexRouter.address, ethers.constants.MaxUint256);
      await dexRouter.swapExactTokensForTokens(
        ethers.utils.parseEther('10'),
        ethers.utils.parseEther('0.1'),
        [micToken.address, iceToken.address],
        user2.address,
        ethers.constants.MaxUint256,
      );

      const micPriceAfterTradeBeforeUpdate = await oracle.consult(
        micToken.address,
        ethers.utils.parseEther('1'),
      );

      expect(micPriceBeforeTrade).to.be.eq(micPriceAfterTradeBeforeUpdate);

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const micPriceAfterTradeAfterUpdate = await oracle.consult(
        micToken.address,
        ethers.utils.parseEther('1'),
      );

      expect(micPriceBeforeTrade).to.be.greaterThan(micPriceAfterTradeAfterUpdate);
      // invariant: 100 MIC * 125 USDC => 12500
      // after trade: 110 MIC * x USDC => 12500
      // x = 12500 / 110 = 113.(63)
      // MIC price after trade: 12500 / 113.(63) ~~ 1,0330578512 USDC
      expect(micPriceAfterTradeAfterUpdate).to.be.approximately(
        ethers.utils.parseEther('1.03305'),
        ethers.utils.parseEther('0.001'),
      );
    });

    test('should calculate liquidity correctly after price change', async () => {
      const oracleFactory = await ethers.getContractFactory('UniswapV2TwapOracle');
      const oracle = await oracleFactory.deploy(
        getNetworkConfig('31337').existingContracts.gelatoAutomate!,
        dexPairAddress,
        time.duration.hours(6),
      );

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const amountOfLPTokens = await dexPair.balanceOf(user1.address);

      const { tokenAAmount, tokenBAmount } =
        await liquidityValueCalculator.calculateLiquidityValue(
          oracle.address,
          micToken.address,
          amountOfLPTokens,
        );

      expect(tokenAAmount).to.be.approximately(amountA, ethers.utils.parseEther('0.1'));
      expect(tokenBAmount).to.be.approximately(
        amountB18Decimals,
        ethers.utils.parseEther('0.1'),
      );

      const dexRouter = await ethers.getContractAt(
        'IUniswapV2Router01',
        dexRouterAddress!,
      );

      await micToken.approve(dexRouter.address, ethers.constants.MaxUint256);
      await dexRouter.swapExactTokensForTokens(
        ethers.utils.parseEther('10'),
        ethers.utils.parseEther('1'),
        [micToken.address, iceToken.address],
        user2.address,
        ethers.constants.MaxUint256,
      );

      await time.increase(time.duration.hours(6));
      await oracle.update();

      const {
        tokenAAmount: tokenAAmountAfterTrade,
        tokenBAmount: tokenBAmountAfterTrade,
      } = await liquidityValueCalculator.calculateLiquidityValue(
        oracle.address,
        micToken.address,
        amountOfLPTokens,
      );

      const [reserve0, reserve1] = await dexPair.getReserves();
      const token0 = await dexPair.token0();
      if (token0 === micToken.address) {
        expect(reserve0).to.be.approximately(
          tokenAAmountAfterTrade,
          ethers.utils.parseEther('0.1'),
        );
        expect(reserve1).to.be.approximately(
          tokenBAmountAfterTrade,
          ethers.utils.parseEther('0.1'),
        );
      } else {
        expect(reserve0).to.be.approximately(
          tokenBAmountAfterTrade,
          ethers.utils.parseEther('0.1'),
        );
        expect(reserve1).to.be.approximately(
          tokenAAmountAfterTrade,
          ethers.utils.parseEther('0.1'),
        );
      }
    });
  });
});
