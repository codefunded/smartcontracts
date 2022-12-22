// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

contract NativeTokenReceiver {
  receive() external payable {}

  function _withdrawNativeToken(
    address payable _receiver
  ) internal returns (bool success, bytes memory data) {
    return _receiver.call{value: address(this).balance}('');
  }
}
