// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import './LiquidityValueCalculator.sol';

contract LiquidityValueCalculatorMock {
  /// @dev Computes the value of a liquidity share in terms of the underlying tokens on a Uniswap V2 pair.
  function computeLiquidityShareValue(
    address _dexPair,
    uint _amountOfLPTokens,
    address _tokenA
  ) public view returns (uint tokenAAmount, uint tokenBAmount) {
    return
      LiquidityValueCalculator.computeLiquidityShareValue(
        _dexPair,
        _amountOfLPTokens,
        _tokenA
      );
  }
}
