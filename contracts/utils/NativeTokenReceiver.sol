// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

contract NativeTokenReceiver {
  event ReceivedNativeToken(address indexed sender, uint256 value);
  event WithdrawnNativeToken(address indexed receiver, uint256 value);

  receive() external payable {
    emit ReceivedNativeToken(msg.sender, msg.value);
  }

  function _withdrawNativeToken(
    address payable _receiver
  ) internal returns (bool success, bytes memory data) {
    emit WithdrawnNativeToken(_receiver, address(this).balance);
    return _receiver.call{value: address(this).balance}('');
  }
}
