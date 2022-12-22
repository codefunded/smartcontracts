// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;


/**
 * @dev Struct to hold the lockable asset information.
 * @param token The address of the token that can be locked.
 * @param baseRewardModifier The base reward modifier for the lockable asset, in basis points
 * e.g. 10000 = 100% = 10000, 105% = 10500, 110% = 11000, etc. 10000 is the default value.
 * @param isEntitledToVote Whether the lockable asset is entitled to vote.
 * @param isLPToken Whether the lockable asset is an LP token.
 */
struct LockableAsset {
  address token;
  uint256 baseRewardModifier;
  bool isEntitledToVote;
  bool isLPToken;
}