// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

error Staking__StakeAmountCannotBe0();
error Staking__RewardsDurationNotFinished();
error Staking__RewardRateIs0();
error Staking__RewardAmountIsGreaterThanBalance();
error Staking__WithdrawAmountBiggerThanStakedAmount();

/// @title Staking contract that is giving rewards in another ERC20 token that is not owned by the project creator
/// in defined time periods
/// @notice This contract allows users to stake ERC20 tokens and receive rewards in other ERC20 token
contract Staking is Ownable, ReentrancyGuard {
  event StakeDeposited(address indexed staker, uint256 amount, uint256 timestamp);
  event StakeWithdrawn(address indexed staker, uint256 amount, uint256 timestamp);
  event RewardsCollected(address indexed staker, uint256 amount, uint256 timestamp);
  event RewardAdded(uint256 amount, uint256 timestamp);
  event RewardsDurationSet(uint256 duration, uint256 startTimestamp);

  IERC20 public immutable stakingToken;
  IERC20 public immutable rewardsToken;

  /// @notice Duration of rewards to be paid out (in seconds)
  uint256 public duration;
  /// @notice Timestamp of when the rewards period finishes
  uint256 public finishAt;
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

  constructor(address _stakingToken, address _rewardToken) {
    stakingToken = IERC20(_stakingToken);
    rewardsToken = IERC20(_rewardToken);
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
    return Math.min(finishAt, block.timestamp);
  }

  function rewardPerToken() public view returns (uint256) {
    if (totalSupply == 0) {
      return rewardPerTokenStored;
    }

    return
      rewardPerTokenStored +
      (rewardRate * (lastTimeRewardApplicable() - updatedAt) * 1e18) /
      totalSupply;
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
    if (balanceOf[msg.sender] < _amount) {
      revert Staking__WithdrawAmountBiggerThanStakedAmount();
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
      rewardsToken.transfer(msg.sender, reward);
    }

    emit RewardsCollected(msg.sender, reward, block.timestamp);
  }

  function setRewardsDuration(uint256 _duration) external onlyOwner {
    if (finishAt >= block.timestamp) {
      revert Staking__RewardsDurationNotFinished();
    }

    duration = _duration;

    emit RewardsDurationSet(duration, block.timestamp);
  }

  function notifyRewardAmount(
    uint256 _amount
  ) external onlyOwner updateReward(address(0)) {
    if (block.timestamp >= finishAt) {
      rewardRate = _amount / duration;
    } else {
      uint256 remainingRewards = (finishAt - block.timestamp) * rewardRate;
      rewardRate = (_amount + remainingRewards) / duration;
    }

    if (rewardRate == 0) {
      revert Staking__RewardRateIs0();
    }
    if (rewardRate * duration > rewardsToken.balanceOf(address(this))) {
      revert Staking__RewardAmountIsGreaterThanBalance();
    }

    finishAt = block.timestamp + duration;
    updatedAt = block.timestamp;

    emit RewardAdded(_amount, block.timestamp);
  }
}
