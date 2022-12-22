// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import './interfaces/IUniswapV2Router01.sol';
import './libraries/UniswapV2Library.sol';
import './interfaces/ILiquidityValueCalculator.sol';

library LiquidityValueCalculator {
  /// @dev Computes the value of a liquidity share in terms of the underlying tokens on a Uniswap V2 pair.
  function computeLiquidityShareValue(
    address _dexPair,
    uint _amountOfLPTokens,
    address _tokenA
  ) internal view returns (uint tokenAAmount, uint tokenBAmount) {
    (uint reserveA, uint reserveB, uint totalSupply) = pairInfo(_dexPair, _tokenA);
    tokenAAmount = (_amountOfLPTokens * reserveA) / totalSupply;
    tokenBAmount = (_amountOfLPTokens * reserveB) / totalSupply;
  }

  /// @dev Returns the reserves and total supply of a Uniswap V2 pair.
  function pairInfo(
    address _dexPair,
    address _tokenA
  ) internal view returns (uint reserveA, uint reserveB, uint totalSupply) {
    IUniswapV2Pair pair = IUniswapV2Pair(_dexPair);
    totalSupply = pair.totalSupply();
    (uint reserves0, uint reserves1, ) = pair.getReserves();
    (reserveA, reserveB) = _tokenA == pair.token0()
      ? (reserves0, reserves1)
      : (reserves1, reserves0);
  }
}
