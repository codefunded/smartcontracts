// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { EnumerableSet } from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import { EnumerableMap } from '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';

/**
 * @notice Vesting contract for the team. It is a step vesting contract with 10 steps. Each step is 1 year but the first
 * cliff is 18 months. After that beneficiaries can claim 1/10 of their tokens every year.
 * @dev The contract is Ownable and the owner can set beneficiaries and rescue tokens.
 */
contract StepVestingWallet is Ownable {
  using SafeERC20 for IERC20;
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  event BeneficiaryAdded(address beneficiary, uint256 amount);
  event TokensRescued(uint256 amount);
  event TokensClaimed(address beneficiary, uint256 amount);

  IERC20 public token;
  uint256 public cliff;
  uint256 public startTime;
  EnumerableMap.AddressToUintMap private beneficiaries;
  mapping(address => uint256) public claimed;

  constructor(IERC20 _token) {
    token = _token;
    cliff = 18 * 30 days; // default cliff of 18 months
    startTime = block.timestamp;
  }

  /**
   * @notice Returns beneficiaries' addresses and amounts of tokens to be vested per beneficiary
   * @return addresses beneficiaries' addresses
   * @return amounts beneficiaries' amounts of tokens to be vested
   */
  function getBeneficiaries()
    public
    view
    returns (address[] memory addresses, uint256[] memory amounts)
  {
    address[] memory _beneficiaries = new address[](beneficiaries.length());
    uint256[] memory _amounts = new uint256[](beneficiaries.length());
    for (uint256 i = 0; i < beneficiaries.length(); i++) {
      (_beneficiaries[i], _amounts[i]) = beneficiaries.at(i);
    }
    return (_beneficiaries, _amounts);
  }

  /**
   * @notice Returns the amount of tokens vested for a beneficiary
   * @param beneficiary beneficiary's address
   * @return amount of tokens vested for a beneficiary
   */
  function getBeneficiaryAllVestedAmount(
    address beneficiary
  ) public view returns (uint256) {
    if (!beneficiaries.contains(beneficiary)) {
      return 0;
    }
    return beneficiaries.get(beneficiary);
  }

  /**
   * @notice Sets the beneficiary's address and amount of tokens to be vested. Can be called only by the owner.
   * @param beneficiary beneficiary's address
   * @param amount of tokens claimed for a beneficiary
   */
  function setBeneficiary(address beneficiary, uint256 amount) public onlyOwner {
    require(!beneficiaries.contains(beneficiary), 'Beneficiary already exists');
    beneficiaries.set(beneficiary, amount);
    emit BeneficiaryAdded(beneficiary, amount);
  }

  /**
   * @notice Sets a batch of beneficiaries' addresses and amounts of tokens to be vested. Can be called only by the owner.
   * @param _beneficiaries beneficiaries' addresses
   * @param _amounts amounts of tokens claimed for beneficiaries
   */
  function setBeneficiaries(
    address[] calldata _beneficiaries,
    uint256[] calldata _amounts
  ) external onlyOwner {
    require(_beneficiaries.length == _amounts.length, 'Invalid input');
    for (uint256 i = 0; i < _beneficiaries.length; i++) {
      setBeneficiary(_beneficiaries[i], _amounts[i]);
    }
  }

  /**
   * @notice Returns the amount of tokens pending to be claimed for a beneficiary at the current time
   * @return amount of tokens pending to be claimed for a beneficiary
   */
  function getPendingTokensToClaim() public view returns (uint256) {
    require(beneficiaries.contains(_msgSender()), 'Not a beneficiary');
    require(block.timestamp >= startTime + cliff, 'Vesting period not started');

    uint256 elapsedYears = (block.timestamp - startTime - cliff) / (365 days) + 1;
    uint256 stepAmount = beneficiaries.get(_msgSender()) / 10;

    if (stepAmount * elapsedYears < claimed[_msgSender()]) {
      return 0;
    }

    uint256 rewardToClaim = stepAmount * elapsedYears - claimed[_msgSender()];
    return rewardToClaim;
  }

  /**
   * @notice Claims the pending tokens for a beneficiary. Can be called only by the beneficiary.
   */
  function claim() external {
    uint256 tokensToClaim = getPendingTokensToClaim();

    require(tokensToClaim > 0, 'All pending tokens claimed');

    claimed[_msgSender()] += tokensToClaim;
    token.safeTransfer(_msgSender(), tokensToClaim);

    emit TokensClaimed(_msgSender(), tokensToClaim);
  }

  /**
   * @notice Rescues tokens from the contract. Can be called only by the owner.
   */
  function rescueTokens(uint256 amount) external onlyOwner {
    token.safeTransfer(_msgSender(), amount);
    emit TokensRescued(amount);
  }
}
