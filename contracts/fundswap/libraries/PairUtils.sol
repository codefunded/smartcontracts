// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

library PairUtils {
  function getPairInOrder(
    address token1,
    address token2
  ) internal pure returns (address, address) {
    return token1 > token2 ? (token2, token1) : (token1, token2);
  }
}
