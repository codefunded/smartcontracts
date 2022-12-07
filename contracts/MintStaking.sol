// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import './ERC20/MintableToken.sol';

error Staking__StakeAmountCannotBe0();

/// @title Staking contract that is minting a fixed amount of rewards indefinately in ERC20 token owned by the project creator
/// @notice This contract allows users to stake ERC20 tokens and receive rewards in other ERC20 token
contract MintStaking is Ownable, ReentrancyGuard {
  event StakeDeposited(address indexed staker, uint256 amount, uint256 timestamp);
  event StakeWithdrawn(address indexed staker, uint256 amount, uint256 timestamp);
  event RewardsCollected(address indexed staker, uint256 amount, uint256 timestamp);

  IERC20 public immutable stakingToken;
  MintableToken public immutable rewardsToken;

  /// @notice Minimum of last updated time and rewards period finish time
  uint256 public updatedAt;
  /// @notice Reward to be paid out per second
  uint256 public rewardRate;
  /// @dev Sum of (reward rate * delta * 1e18 / total supply)
  uint256 public rewardPerTokenStored;
  /// @dev User address => rewardPerTokenPaid
  mapping(address => uint256) public userRewardPerTokenPaid;
  /// @dev User address => rewards to be claimed
  mapping(address => uint256) public rewards;
  /// @notice Total amount staked
  uint256 public totalSupply;
  /// @dev User address => staked amount
  mapping(address => uint256) public balanceOf;

  constructor(address _stakingToken, address _rewardsToken, uint256 _rewardRate) {
    stakingToken = IERC20(_stakingToken);
    rewardsToken = MintableToken(_rewardsToken);
    rewardRate = _rewardRate;
  }

  modifier updateReward(address _account) {
    rewardPerTokenStored = rewardPerToken();
    updatedAt = lastTimeRewardApplicable();

    if (_account != address(0)) {
      rewards[_account] = earnedReward(_account);
      userRewardPerTokenPaid[_account] = rewardPerTokenStored;
    }

    _;
  }

  function lastTimeRewardApplicable() public view returns (uint256) {
    return block.timestamp;
  }

  function rewardPerToken() public view returns (uint256) {
    if (totalSupply == 0) {
      return rewardPerTokenStored;
    }

    return rewardPerTokenStored + rewardRate * (lastTimeRewardApplicable() - updatedAt);
  }

  function stakeWithPermit(
    uint256 _amount,
    uint256 _deadline,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) external {
    IERC20Permit(address(stakingToken)).permit(
      msg.sender,
      address(this),
      _amount,
      _deadline,
      _v,
      _r,
      _s
    );
    stake(_amount);
  }

  function stake(uint256 _amount) public updateReward(msg.sender) nonReentrant {
    if (_amount == 0) {
      revert Staking__StakeAmountCannotBe0();
    }

    balanceOf[msg.sender] += _amount;
    totalSupply += _amount;
    stakingToken.transferFrom(msg.sender, address(this), _amount);

    emit StakeDeposited(msg.sender, _amount, block.timestamp);
  }

  function withdraw(uint256 _amount) external updateReward(msg.sender) nonReentrant {
    if (_amount == 0) {
      revert Staking__StakeAmountCannotBe0();
    }

    balanceOf[msg.sender] -= _amount;
    totalSupply -= _amount;
    stakingToken.transfer(msg.sender, _amount);

    emit StakeWithdrawn(msg.sender, _amount, block.timestamp);
  }

  function earnedReward(address _account) public view returns (uint256) {
    return
      ((balanceOf[_account] * (rewardPerToken() - userRewardPerTokenPaid[_account])) /
        1e18) + rewards[_account];
  }

  function collectReward() external updateReward(msg.sender) nonReentrant {
    uint256 reward = rewards[msg.sender];
    if (reward > 0) {
      rewards[msg.sender] = 0;
      rewardsToken.mint(msg.sender, reward);
    }

    emit RewardsCollected(msg.sender, reward, block.timestamp);
  }
}
