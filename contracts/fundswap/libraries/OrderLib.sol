// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import '@prb/math/contracts/PRBMathUD60x18.sol';
import '../OrderStructs.sol';

library OrderLib {
  using PRBMathUD60x18 for uint256;

  function getAmountToApprove(
    OrderFillRequest memory request
  ) internal pure returns (uint256 amountToApprove) {
    amountToApprove = type(uint256).max;
    if (request.orderType == OrderType.ExactInput) {
      amountToApprove = request.amountIn;
    }
    if (request.orderType == OrderType.ExactOutput && request.maxAmountIn != 0) {
      amountToApprove = request.maxAmountIn;
    }
  }

  function isFillRequestPartial(
    OrderFillRequest memory request,
    PublicOrder memory order
  ) internal pure returns (bool isPartial) {
    if (request.orderType == OrderType.ExactInput) {
      return request.amountIn < order.amountWanted;
    }
    if (request.orderType == OrderType.ExactOutput) {
      return request.amountOut < order.amountOffered;
    }

    revert('Invalid order type');
  }

  function calculateOrderAmountsAfterFill(
    OrderFillRequest memory request,
    PublicOrder memory order
  )
    internal
    pure
    returns (uint256 orderAmountWanted, uint256 orderAmountOffered, uint256 outputAmount)
  {
    if (request.orderType == OrderType.ExactInput) {
      uint256 amountWantedBeforeSwap = order.amountWanted;
      orderAmountWanted = order.amountWanted - request.amountIn;
      uint256 amountOfferedBeforeSwap = order.amountOffered;
      orderAmountOffered = order.amountOffered.mul(orderAmountWanted).div(
        amountWantedBeforeSwap
      );

      outputAmount = amountOfferedBeforeSwap - orderAmountOffered;
      return (orderAmountWanted, orderAmountOffered, outputAmount);
    }
    if (request.orderType == OrderType.ExactOutput) {
      uint256 amountOfferedBeforeSwap = order.amountOffered;
      orderAmountOffered = order.amountOffered - request.amountOut;
      uint256 amountWantedBeforeSwap = order.amountWanted;
      orderAmountWanted = order.amountWanted.mul(orderAmountOffered).div(
        amountOfferedBeforeSwap
      );
      outputAmount = amountWantedBeforeSwap - orderAmountWanted;
      return (orderAmountWanted, orderAmountOffered, outputAmount);
    }

    revert('Invalid order type');
  }
}
