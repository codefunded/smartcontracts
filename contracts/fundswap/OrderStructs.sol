// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 * @notice Holds the data for a private order. Private order means that it is not stored on chain. The creator can pass the
 * order off-chain to the recipient or publish it publicly. The recipient can then fill the order by passing the order
 * to the smart contract.
 * @param creator the address of the creator of the order
 * @param offeredToken the address of the token offered
 * @param wantedToken the address of the token wanted
 * @param amountOffered the amount of the offered token
 * @param amountWanted the amount of the wanted token
 * @param recipient the address of the recipient of the order. Can be address 0 if order can be filled by anyone
 * @param deadline the deadline of the order. Can be 0 if order should not expire
 * @param creationTimestamp the timestamp when the order was created. It is used to differentiate orders with the same
 * parameters (functions as a nonce)
 */
struct PrivateOrder {
  address creator;
  address offeredToken;
  address wantedToken;
  uint256 amountOffered;
  uint256 amountWanted;
  address recipient;
  uint256 deadline;
  uint256 creationTimestamp;
}

/**
 * @notice Holds the data for a public order that is stored on chain.
 * @param offeredToken the address of the token offered
 * @param wantedToken the address of the token wanted
 * @param amountOffered the amount of the offered token
 * @param amountWanted the amount of the wanted token
 * @param deadline the deadline of the order. Can be 0 if order should not expire
 */
struct PublicOrder {
  address offeredToken;
  address wantedToken;
  uint256 amountOffered;
  uint256 amountWanted;
  uint256 deadline;
}

struct PublicOrderWithId {
  uint256 orderId;
  address offeredToken;
  address wantedToken;
  uint256 amountOffered;
  uint256 amountWanted;
  uint256 deadline;
}

/**
 * @notice Desccribes the type of an order. Either the user wants to spend a certain amount of offered tokens (ExactInput)
 * or buy a certain amount of wanted tokens (ExactOutput).
 */
enum OrderType {
  ExactInput,
  ExactOutput
}

/**
 * @notice Helper struct that is used to represent a market order request. It describes a request of a user to
 * either spend a certain amount of offered tokens or buy a certain amount of wanted token.
 * @param orderId the id of the order to fill
 * @param orderType the type of the order (exact input or exact output)
 * @param amountIn the amount of offered tokens to spend (is equal to 0 if orderType is ExactOutput)
 * @param maxAmountIn the maximum amount of offered tokens to spend. Can be equal to 0 if the user doesn't want
 * to set any limits or the order type is ExactInput (when exact amountIn is specified, the maxAmountIn is ignored)
 * @param amountOut the amount of wanted tokens to buy (is equal to 0 if orderType is ExactInput)
 * @param minAmountOut the minimum amount of wanted tokens to buy. Can be equal to 0 if the user doesn't want to
 * set any limits or the order type is ExactOutput (when exact amountOut is specified, the minAmountOut is ignored)
 */
struct OrderFillRequest {
  uint256 orderId;
  OrderType orderType;
  uint256 amountIn;
  uint256 maxAmountIn;
  uint256 amountOut;
  uint256 minAmountOut;
}
