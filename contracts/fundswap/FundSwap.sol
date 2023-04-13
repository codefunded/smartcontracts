// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@prb/math/contracts/PRBMathUD60x18.sol';
import './OrderStructs.sol';
import {FundSwapOrderManager} from './FundSwapOrderManager.sol';
import {FeeAggregator} from './extensions/FeeAggregator.sol';
import {PairUtils} from './libraries/PairUtils.sol';
import {OrderLib} from './libraries/OrderLib.sol';
import {OrderSignatureVerifier} from './extensions/OrderSignatureVerifier.sol';
import {TokenWhitelist, TokenWhitelist__TokenNotWhitelisted} from './extensions/TokenWhitelist.sol';

error FundSwap__InvalidOrderSignature();
error FundSwap__InsufficientCreatorBalance();
error FundSwap__YouAreNotARecipient();
error FundSwap__NotAnOwner();
error FundSwap__OrderExpired();
error FundSwap__OrderHaveAlreadyBeenExecuted();
error FundSwap__OfferedAmountIsZero();
error FundSwap__WantedAmountIsZero();
error FundSwap__InsufficientAmountOut();
error FundSwap__AmountInExceededLimit();
error FundSwap__InvalidPath();
error FundSwap__IncorrectOrderType();

/**
 * @notice FundSwap is a decentralized spot OTC exchange for ERC-20 tokens compatible with EVM chains.
 * It allows to create public and private orders for any ERC-20 token pair. Public orders are available
 * for anyone to fill, while private orders can have a specific recipient and a deadline. Private orders
 * are not saved onchain but can be passed from the creator to the filler offchain. Public orders
 * are represented as ERC-721 tokens. The exchange also supports routing through a chain of orders.
 */
contract FundSwap is
  OrderSignatureVerifier,
  TokenWhitelist,
  FeeAggregator,
  ReentrancyGuard
{
  using PRBMathUD60x18 for uint256;
  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.UintSet;

  // ======== EVENTS ========

  event PublicOrderCreated(
    uint256 indexed tokenId,
    address indexed offeredToken,
    address indexed wantedToken
  );
  event PublicOrderFilled(
    uint256 indexed tokenId,
    address indexed offeredToken,
    address indexed wantedToken,
    address creator,
    address taker
  );
  event PublicOrderPartiallyFilled(uint256 indexed tokenId, address indexed taker);
  event PublicOrderCancelled(
    uint256 indexed tokenId,
    address indexed offeredToken,
    address indexed wantedToken,
    address owner
  );
  event PrivateOrderInvalidated(
    address indexed offeredToken,
    uint256 amountOffered,
    address indexed wantedToken,
    uint256 amountWanted,
    address indexed creator,
    address recipient,
    uint256 deadline,
    uint256 creationTimestamp,
    bytes32 orderHash
  );
  event PrivateOrderFilled(
    address indexed offeredToken,
    address indexed wantedToken,
    address creator,
    address taker
  );
  /// @dev manager for public orders (ERC721)
  FundSwapOrderManager public immutable fundSwapOrderManager;
  /// @dev token1 => token2 => order IDs
  mapping(address => mapping(address => EnumerableSet.UintSet)) private orderIdsForPair;
  /// @dev token => order hash => is executed
  mapping(address => mapping(bytes32 => bool)) public executedPrivateOrderHashes;

  constructor(uint16 _fee) FeeAggregator(_fee) {
    fundSwapOrderManager = new FundSwapOrderManager();
  }

  // ======== VIEW FUNCTIONS ========

  /**
   * @notice Returns all public orders for a given token pair.
   * @param token1 address of the first token
   * @param token2 address of the second token
   * @return orders array of public orders
   */
  function getOrdersForPair(
    address token1,
    address token2
  ) external view returns (PublicOrderWithId[] memory) {
    (address tokenA, address tokenB) = PairUtils.getPairInOrder(token1, token2);
    EnumerableSet.UintSet storage orderIds = orderIdsForPair[tokenA][tokenB];
    if (orderIds.length() == 0) return new PublicOrderWithId[](0);

    PublicOrderWithId[] memory orders = new PublicOrderWithId[](orderIds.length());
    for (uint256 i = 0; i < orderIds.length(); i++) {
      PublicOrder memory order = fundSwapOrderManager.getOrder(orderIds.at(i));
      orders[i] = PublicOrderWithId({
        orderId: orderIds.at(i),
        offeredToken: order.offeredToken,
        wantedToken: order.wantedToken,
        amountOffered: order.amountOffered,
        amountWanted: order.amountWanted,
        deadline: order.deadline
      });
    }
    return orders;
  }

  // ======== PUBLIC ORDERS FUNCTIONS ========

  /**
   * @notice Creates a public order with a permit signature so that the public order can be created
   * in a single transaction.
   * @param order public order data
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return orderId ID of the created order
   */
  function createPublicOrderWithPermit(
    PublicOrder calldata order,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 orderId) {
    IERC20Permit(order.offeredToken).permit(
      _msgSender(),
      address(this),
      order.amountOffered,
      deadline,
      v,
      r,
      s
    );
    return createPublicOrder(order);
  }

  /**
   * @notice Creates a public order. The offered token must be approved for transfer to the exchange. Only
   * whitelisted tokens can be used.
   * @param order public order data
   * @return orderId ID of the created order
   */
  function createPublicOrder(
    PublicOrder calldata order
  )
    public
    nonReentrant
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
    returns (uint256 orderId)
  {
    if (order.amountOffered == 0) revert FundSwap__OfferedAmountIsZero();
    if (order.amountWanted == 0) revert FundSwap__WantedAmountIsZero();
    if (order.wantedToken == order.offeredToken) revert FundSwap__InvalidPath();

    orderId = fundSwapOrderManager.safeMint(_msgSender(), order);

    (address token1, address token2) = PairUtils.getPairInOrder(
      order.offeredToken,
      order.wantedToken
    );
    orderIdsForPair[token1][token2].add(orderId);
    emit PublicOrderCreated(orderId, order.offeredToken, order.wantedToken);

    IERC20(order.offeredToken).safeTransferFrom(
      _msgSender(),
      address(this),
      order.amountOffered
    );
  }

  /**
   * @notice Cancels a public order. Only the order owner can cancel it. The offered token is transferred
   * back to the order owner.
   * @param orderId ID of the order to fill
   */
  function cancelOrder(uint256 orderId) external {
    PublicOrder memory order = fundSwapOrderManager.getOrder(orderId);
    address orderOwner = fundSwapOrderManager.ownerOf(orderId);
    if (orderOwner != _msgSender()) revert FundSwap__NotAnOwner();

    _deleteOrder(orderId, order);

    IERC20(order.offeredToken).safeTransfer(_msgSender(), order.amountOffered);

    emit PublicOrderCancelled(orderId, order.offeredToken, order.wantedToken, orderOwner);
  }

  /**
   * @notice Fills a public order with permit signature so that the public order can be filled in a
   * single transaction. Only whitelisted tokens can be used.
   * @param orderId Order ID to fill
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return amountOut amount of wanted token received
   */
  function fillPublicOrderWithPermit(
    uint256 orderId,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 amountOut) {
    PublicOrder memory order = fundSwapOrderManager.getOrder(orderId);
    IERC20Permit(order.wantedToken).permit(
      _msgSender(),
      address(this),
      order.amountWanted,
      deadline,
      v,
      r,
      s
    );
    return _fillPublicOrder(orderId, order, _msgSender(), _msgSender());
  }

  /**
   * @notice Fills a public order. The wanted token of the order must be approved for transfer to the exchange.
   * Only whitelisted tokens can be used.
   * @param orderId Order ID to fill
   * @return amountOut amount of wanted token received
   */
  function fillPublicOrder(uint256 orderId) public returns (uint256 amountOut) {
    PublicOrder memory order = fundSwapOrderManager.getOrder(orderId);
    return _fillPublicOrder(orderId, order, _msgSender(), _msgSender());
  }

  function _fillPublicOrder(
    uint256 orderId,
    PublicOrder memory order,
    address tokenHolder,
    address tokenDestination
  )
    internal
    nonReentrant
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
    returns (uint256 amountOut)
  {
    if (order.deadline != 0 && block.timestamp > order.deadline)
      revert FundSwap__OrderExpired();

    address orderOwner = fundSwapOrderManager.ownerOf(orderId);

    _deleteOrder(orderId, order);

    // calculates fee amount and marks it as collected
    _accrueFeeForToken(
      order.offeredToken,
      _calculateFeeAmount(order.offeredToken, order.amountOffered)
    );

    // Amount out is needed for estimating the amount actually received by the taker
    amountOut = _calculateAmountWithDeductedFee(order.offeredToken, order.amountOffered);

    // transfer tokens on behalf of the order filler to the order owner
    if (tokenHolder != address(this)) {
      IERC20(order.wantedToken).safeTransferFrom(
        tokenHolder,
        orderOwner,
        order.amountWanted
      );
    } else {
      IERC20(order.wantedToken).safeTransfer(orderOwner, order.amountWanted);
    }

    // Transfer tokens to the taker on behalf of the order owner that were
    // deposited to this contract when the order was created.
    if (tokenDestination != address(this)) {
      IERC20(order.offeredToken).safeTransfer(tokenDestination, amountOut);
    }

    emit PublicOrderFilled(
      orderId,
      order.offeredToken,
      order.wantedToken,
      orderOwner,
      _msgSender()
    );
  }

  function _deleteOrder(uint256 orderId, PublicOrder memory order) internal {
    (address token1, address token2) = PairUtils.getPairInOrder(
      order.offeredToken,
      order.wantedToken
    );
    orderIdsForPair[token1][token2].remove(orderId);
    fundSwapOrderManager.burn(orderId);
  }

  /**
   * @notice Fills a public order partially with permit signature so that the public order can be filled in a
   * single transaction. Only whitelisted tokens can be used.
   * @param orderFillRequest Order fill request data
   * @param deadline deadline for the permit signature
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return output amount of used input token or received output token depending on the order type
   */
  function fillPublicOrderPartiallyWithPermit(
    OrderFillRequest memory orderFillRequest,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 output) {
    PublicOrder memory order = fundSwapOrderManager.getOrder(orderFillRequest.orderId);
    uint256 amountToApprove = OrderLib.getAmountToApprove(orderFillRequest);
    IERC20Permit(order.wantedToken).permit(
      _msgSender(),
      address(this),
      amountToApprove,
      deadline,
      v,
      r,
      s
    );
    return _fillPublicOrderPartially(orderFillRequest, order, _msgSender(), _msgSender());
  }

  /**
   * @notice Fills a public order partially. The wanted token of the order must be approved for transfer to the exchange.
   * Only whitelisted tokens can be used.
   * @param orderFillRequest Order fill request data
   * @return output amount of used input token or received output token depending on the order type
   */
  function fillPublicOrderPartially(
    OrderFillRequest memory orderFillRequest
  ) external returns (uint256 output) {
    PublicOrder memory order = fundSwapOrderManager.getOrder(orderFillRequest.orderId);
    return _fillPublicOrderPartially(orderFillRequest, order, _msgSender(), _msgSender());
  }

  function _fillPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    PublicOrder memory order,
    address tokenHolder,
    address tokenDestination
  )
    internal
    nonReentrant
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
    returns (uint256 outputAmount)
  {
    if (order.deadline != 0 && block.timestamp > order.deadline) {
      revert FundSwap__OrderExpired();
    }

    if (orderFillRequest.orderType == OrderType.ExactInput) {
      outputAmount = _fillExactInputPublicOrderPartially(
        orderFillRequest,
        order,
        tokenHolder,
        tokenDestination
      );
    }

    if (orderFillRequest.orderType == OrderType.ExactOutput) {
      outputAmount = _fillExactOutputPublicOrderPartially(
        orderFillRequest,
        order,
        tokenHolder,
        tokenDestination
      );
    }

    (order.amountWanted, order.amountOffered, ) = OrderLib.calculateOrderAmountsAfterFill(
      orderFillRequest,
      order
    );
    fundSwapOrderManager.updateOrder(orderFillRequest.orderId, order);

    emit PublicOrderPartiallyFilled(orderFillRequest.orderId, _msgSender());

    return outputAmount;
  }

  function _fillExactInputPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    PublicOrder memory order,
    address tokenHolder,
    address tokenDestination
  ) internal returns (uint256 fillAmountOut) {
    if (
      orderFillRequest.orderType == OrderType.ExactInput &&
      orderFillRequest.minAmountOut != 0 &&
      orderFillRequest.minAmountOut > fillAmountOut
    ) {
      revert FundSwap__InsufficientAmountOut();
    }

    (, , fillAmountOut) = OrderLib.calculateOrderAmountsAfterFill(
      orderFillRequest,
      order
    );
    _accrueFeeForToken(
      order.offeredToken,
      _calculateFeeAmount(order.offeredToken, fillAmountOut)
    );
    fillAmountOut = _calculateAmountWithDeductedFee(order.offeredToken, fillAmountOut);

    // pay the order owner
    if (tokenHolder != address(this)) {
      IERC20(order.wantedToken).safeTransferFrom(
        tokenHolder,
        fundSwapOrderManager.ownerOf(orderFillRequest.orderId),
        orderFillRequest.amountIn
      );
    } else {
      IERC20(order.wantedToken).safeTransfer(
        fundSwapOrderManager.ownerOf(orderFillRequest.orderId),
        orderFillRequest.amountIn
      );
    }

    if (tokenDestination != address(this)) {
      IERC20(order.offeredToken).safeTransfer(tokenDestination, fillAmountOut);
    }
  }

  function _fillExactOutputPublicOrderPartially(
    OrderFillRequest memory orderFillRequest,
    PublicOrder memory order,
    address tokenHolder,
    address tokenDestination
  ) internal returns (uint256 amountInToFill) {
    if (
      orderFillRequest.orderType == OrderType.ExactOutput &&
      orderFillRequest.maxAmountIn != 0 &&
      orderFillRequest.maxAmountIn < amountInToFill
    ) {
      revert FundSwap__AmountInExceededLimit();
    }

    (, , amountInToFill) = OrderLib.calculateOrderAmountsAfterFill(
      orderFillRequest,
      order
    );
    _accrueFeeForToken(
      order.offeredToken,
      _calculateFeeAmount(order.offeredToken, orderFillRequest.amountOut)
    );

    // pay the order owner
    if (tokenHolder != address(this)) {
      IERC20(order.wantedToken).safeTransferFrom(
        tokenHolder,
        fundSwapOrderManager.ownerOf(orderFillRequest.orderId),
        amountInToFill
      );
    } else {
      IERC20(order.wantedToken).safeTransfer(
        fundSwapOrderManager.ownerOf(orderFillRequest.orderId),
        amountInToFill
      );
    }

    if (tokenDestination != address(this)) {
      IERC20(order.offeredToken).safeTransfer(
        tokenDestination,
        _calculateAmountWithDeductedFee(order.offeredToken, orderFillRequest.amountOut)
      );
    }
  }

  /**
   * @notice Fills a public order partially with permit.
   * @param orderFillRequests Order fill requests
   * @param amountToApprove amount to approve for permit of the wanted token of the first order in the batch
   * @param deadline deadline for permit
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   * @return results array of output amounts
   */
  function batchFillPublicOrdersWithEntryPermit(
    OrderFillRequest[] memory orderFillRequests,
    uint256 amountToApprove,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public returns (uint256[] memory results) {
    PublicOrder memory order = fundSwapOrderManager.getOrder(
      orderFillRequests[0].orderId
    );
    IERC20Permit(order.wantedToken).permit(
      _msgSender(),
      address(this),
      amountToApprove,
      deadline,
      v,
      r,
      s
    );

    return batchFillPublicOrders(orderFillRequests);
  }

  /**
   * @notice Fills a batch of public orders in a single transaction. Only whitelisted tokens can be used.
   * @param orderFillRequests Order fill requests
   */
  function batchFillPublicOrders(
    OrderFillRequest[] memory orderFillRequests
  ) public returns (uint256[] memory results) {
    results = new uint256[](orderFillRequests.length);

    for (uint256 i = 0; i < orderFillRequests.length; i++) {
      PublicOrder memory order = fundSwapOrderManager.getOrder(
        orderFillRequests[i].orderId
      );

      results[i] = OrderLib.isFillRequestPartial(orderFillRequests[i], order)
        ? _fillPublicOrderPartially(
          orderFillRequests[i],
          order,
          _msgSender(),
          _msgSender()
        )
        : _fillPublicOrder(
          orderFillRequests[i].orderId,
          order,
          _msgSender(),
          _msgSender()
        );
    }
  }

  // ======== PRIVATE ORDERS FUNCTIONS ========

  /**
   * @notice Computes a hash of private order data. This hash can be used by the recipient to finalize the order.
   * Only whitelisted tokens can be used.
   * @param order Private order data
   * @return orderHash Hash of the order
   */
  function createPrivateOrder(
    PrivateOrder memory order
  )
    external
    view
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
    returns (bytes32 orderHash)
  {
    return super.hashOrder(order);
  }

  /**
   * @notice Invalidates a private order. Since private orders are not stored on-chain, there is no way to cancel them.
   * This function allows the creator to invalidate the order and prevent the recipient from finalizing it. It can be
   * useful if a user shares the order and a signature with the filler but then changes their mind.
   * @param order Private order data
   */
  function invalidatePrivateOrder(PrivateOrder memory order) external {
    if (_msgSender() != order.creator) revert FundSwap__NotAnOwner();

    executedPrivateOrderHashes[order.creator][hashOrder(order)] = true;

    emit PrivateOrderInvalidated(
      order.offeredToken,
      order.amountOffered,
      order.wantedToken,
      order.amountWanted,
      order.creator,
      order.recipient,
      order.deadline,
      order.creationTimestamp,
      hashOrder(order)
    );
  }

  /**
   * @notice Fills a private order with permit so the private order can be filled in a single transaction.
   * Only whitelisted tokens can be used.
   * @param order private order data
   * @param orderHash hash of the order
   * @param sig creator signature of the order
   * @param deadline deadline for permit
   * @param v signature parameter
   * @param r signature parameter
   * @param s signature parameter
   */
  function fillPrivateOrderWithPermit(
    PrivateOrder calldata order,
    bytes32 orderHash,
    bytes memory sig,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    IERC20Permit(order.wantedToken).permit(
      _msgSender(),
      address(this),
      order.amountWanted,
      deadline,
      v,
      r,
      s
    );
    fillPrivateOrder(order, orderHash, sig);
  }

  /**
   * @notice Fills a private order. Only whitelisted tokens can be used.
   * @param order private order data
   * @param orderHash hash of the order
   * @param sig creator signature of the order
   */
  function fillPrivateOrder(
    PrivateOrder memory order,
    bytes32 orderHash,
    bytes memory sig
  )
    public
    nonReentrant
    onlyWhitelistedTokens(order.offeredToken)
    onlyWhitelistedTokens(order.wantedToken)
  {
    if (!super.verifyOrder(order, orderHash, sig)) {
      revert FundSwap__InvalidOrderSignature();
    }
    if (order.amountOffered == 0) {
      revert FundSwap__OfferedAmountIsZero();
    }
    if (order.amountWanted == 0) {
      revert FundSwap__WantedAmountIsZero();
    }
    if (order.wantedToken == order.offeredToken) {
      revert FundSwap__InvalidPath();
    }
    if (IERC20(order.offeredToken).balanceOf(order.creator) < order.amountOffered) {
      revert FundSwap__InsufficientCreatorBalance();
    }
    if (order.deadline != 0 && block.timestamp > order.deadline) {
      revert FundSwap__OrderExpired();
    }
    if (order.recipient != address(0) && order.recipient != _msgSender()) {
      revert FundSwap__YouAreNotARecipient();
    }
    if (executedPrivateOrderHashes[order.creator][hashOrder(order)]) {
      revert FundSwap__OrderHaveAlreadyBeenExecuted();
    }

    executedPrivateOrderHashes[order.creator][hashOrder(order)] = true;
    emit PrivateOrderFilled(
      order.offeredToken,
      order.wantedToken,
      order.creator,
      _msgSender()
    );

    _accrueFeeForToken(
      order.offeredToken,
      _calculateFeeAmount(order.offeredToken, order.amountOffered)
    );
    uint256 amountOfferredWithDeductedFee = _calculateAmountWithDeductedFee(
      order.offeredToken,
      order.amountOffered
    );

    IERC20(order.offeredToken).safeTransferFrom(
      order.creator,
      _msgSender(),
      amountOfferredWithDeductedFee
    );
    IERC20(order.wantedToken).safeTransferFrom(
      _msgSender(),
      order.creator,
      order.amountWanted
    );
  }
}
