// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;
import '../staking/interfaces/IStaking.sol';
import './LockableAsset.sol';


/// @notice Library to use with arrays
library Array {

  function findElementInArray(IStaking[] storage arr, IStaking _element) internal view returns (int256)
  {
    for (uint256 i = 0; i < arr.length; i++) {
      if (_element == arr[i]) {
        return int256(i);
      }
    }
    return -1;
  }

  function findElementInArray(LockableAsset[] storage arr, LockableAsset memory _element) internal view returns (int256)
  {
    for (uint256 i = 0; i < arr.length; i++) {
      if (_element.token == arr[i].token) {
        return int256(i);
      }
    }
    return -1;
  }
}
