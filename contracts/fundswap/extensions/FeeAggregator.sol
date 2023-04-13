// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';

error FeeAggregator__FeeCannotExceed100Percent();
error FeeAggregator__FeeAmountIsBiggerThanAmount();

/**
 * @notice FeeAggregator is a contract that aggregates fees for different assets.
 * It allows to set a default fee and a fee for a specific asset.
 * @dev When there's no fee for a given asset, the default fee is used. Fee percentage
 * is denominated in basis points (1/100th of a percent).
 */
abstract contract FeeAggregator is Ownable {
  using SafeERC20 for IERC20;
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  event DefaultFeeUpdated(uint16 newfee, uint16 previousFee);
  event FeeForAssetUpdated(address indexed asset, uint16 newfee, uint16 previousFee);
  event FeesWithdrawn(address token, uint256 amount);

  /// @dev MAX_FEE is 100% in basis points
  uint16 public constant MAX_FEE = 10000;
  /// @notice Default fee for each asset. It is used when no fee is specified for a given asset
  uint16 public defaultFee;
  /// @notice Fee that is specific to a given asset. It overrides the default fee.
  EnumerableMap.AddressToUintMap private feeForAsset;

  /// @notice Amount of fees collected for each token
  mapping(address => uint256) public collectedFeesInToken;

  constructor(uint16 _fee) {
    defaultFee = _fee;
  }

  /**
   * @notice Sets the default fee for all assets.
   * @param _fee fee in basis points (1/100th of a percent)
   */
  function setDefaultFee(uint16 _fee) external onlyOwner {
    if (_fee > MAX_FEE) {
      revert FeeAggregator__FeeCannotExceed100Percent();
    }
    emit DefaultFeeUpdated(_fee, defaultFee);
    defaultFee = _fee;
  }

  /**
   * @notice Sets the fee for a given asset.
   * @param _asset asset address
   * @param _fee fee in basis points (1/100th of a percent)
   */
  function setFeeForAsset(address _asset, uint16 _fee) external onlyOwner {
    if (_fee > MAX_FEE) {
      revert FeeAggregator__FeeCannotExceed100Percent();
    }
    emit FeeForAssetUpdated(_asset, _fee, defaultFee);
    feeForAsset.set(_asset, _fee);
  }

  /**
   * @notice Withdraws fees for a given token to the owner. If _amount is greater than collected fees,
   * all collected fees are withdrawn.
   * @param _token token address
   * @param _amount amount of fees to withdraw
   */
  function withdrawFees(address _token, uint256 _amount) external onlyOwner {
    uint256 collectedFees = collectedFeesInToken[_token];

    // if amount is greater than collected fees, withdraw all collected fees
    uint256 amountToWithdraw = _amount;
    if (amountToWithdraw > collectedFees) {
      amountToWithdraw = collectedFees;
    }

    collectedFeesInToken[_token] -= amountToWithdraw;
    IERC20(_token).safeTransfer(_msgSender(), amountToWithdraw);

    emit FeesWithdrawn(_token, amountToWithdraw);
  }

  /**
   * @notice Returns the fee for a given asset. If there's no fee for a given asset, the default fee is returned.
   * @param _asset asset address
   * @return fee for a given asset
   */
  function getFeeForAsset(address _asset) public view returns (uint16) {
    if (feeForAsset.contains(_asset)) {
      return uint16(feeForAsset.get(_asset));
    }
    return defaultFee;
  }

  /**
   * @notice Returns all assets that have a specific fee assigned to them. Default fee is not included.
   * @return assets that have a specific fee assigned to them
   * @return fees fee amount for each asset
   */
  function getFeesForAllAssets()
    external
    view
    returns (address[] memory assets, uint256[] memory fees)
  {
    uint256 length = feeForAsset.length();
    assets = new address[](length);
    fees = new uint256[](length);
    for (uint256 i = 0; i < length; i++) {
      (assets[i], fees[i]) = feeForAsset.at(i);
    }
  }

  /**
   * @notice Calculates the amount with deducted fee. This fuction takes into account the fee for a specific asset
   * and falls back to the default fee if no fee is specified for a given asset.
   * @param _asset asset address
   * @param _amount amount of asset
   * @return amountWithDeductedFee amount of asset with deducted fee
   */
  function _calculateAmountWithDeductedFee(
    address _asset,
    uint256 _amount
  ) internal view returns (uint256 amountWithDeductedFee) {
    uint256 feeAmount = _calculateFeeAmount(_asset, _amount);
    amountWithDeductedFee = _amount - feeAmount;
  }

  /**
   * @notice Marks given amount of fees as collected for a given token.
   * @param _token token address
   * @param _feeAmount amount of fees to accrue
   */
  function _accrueFeeForToken(address _token, uint256 _feeAmount) internal {
    if (_feeAmount > 0) {
      collectedFeesInToken[_token] += _feeAmount;
    }
  }

  /**
   * @notice Calculates the fee amount for a given asset and input amount.
   * @param _asset token address
   * @param _amount amount of fee
   */
  function _calculateFeeAmount(
    address _asset,
    uint256 _amount
  ) internal view returns (uint256 feeAmount) {
    uint16 fee = getFeeForAsset(_asset);
    if (fee == 0) {
      return 0;
    }

    feeAmount = (_amount * fee) / MAX_FEE;
    if (feeAmount > _amount) {
      revert FeeAggregator__FeeAmountIsBiggerThanAmount();
    }
  }
}
