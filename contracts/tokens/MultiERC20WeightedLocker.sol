// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '../staking/interfaces/IStaking.sol';
import './interfaces/IMintableBurnableToken.sol';
import '../dex/LiquidityValueCalculator.sol';
import '../utils/BasisPointNumberMath.sol';
import './NonTransferableToken.sol';
import '../utils/Array.sol';
import '../utils/LockableAsset.sol';

/**
 * @dev lock period duration with the corresponding reward modifier
 * NoLock: no lock and x1 reward modifier
 * NinetyDays: 90 days lock and x1.02 reward modifier
 * OneHundredAndEightyDays, 180 days lock and 1.05 reward modifier
 * ThreeHundredAndSixtyDays, 360 days lock and 1.12 reward modifier
 */
enum LockPeriod {
  NoLock,
  NinetyDays,
  OneHundredAndEightyDays,
  ThreeHundredAndSixtyDays
}

/**
 * @dev Struct to hold user's stake.
 * @param lockableAssetIndex The index of the lockable asset in the lockableAssets array.
 * @param stakingContractIndex The index of the staking contract in the stakingContracts array.
 * @param amountLocked The amount of the lockable asset that is locked.
 * @param amountMinted The amount of the token that is minted, taking multipliers into account.
 * @param lockPeriod The lock period of the stake (enum LockPeriod).
 * @param depositTimestamp The timestamp of the deposit.
 * @param unlockAvailibleTimestamp The timestamp when the stake can be unlocked.
 * @param isOngoing Whether the stake is ongoing or not. If false, it means that the stake has been withdrawn.
 */
struct Deposit {
  uint256 lockableAssetIndex;
  uint256 stakingContractIndex;
  uint256 amountLocked;
  uint256 amountMinted;
  LockPeriod lockPeriod;
  uint256 depositTimestamp;
  uint256 unlockAvailibleTimestamp;
  bool isOngoing;
}

error MultiERC20WeightedLocker__InvalidLockableAssetIndex();
error MultiERC20WeightedLocker__InvalidStakingContractIndex();
error MultiERC20WeightedLocker__TransferFailed();
error MultiERC20WeightedLocker__DepositIsNotOngoing();
error MultiERC20WeightedLocker__DepositIsStillLocked();
error MultiERC20WeightedLocker__DepositIsNotLocked();
error MultiERC20WeightedLocker__DepositsInThisAssetHaveBeenDisabled();
error MultiERC20WeightedLocker__AddressAlreadyExists();

/**
 * @notice This contract is responsible for locking tokens, managing the deposits to staking contracts
 * and minting governance tokens. It is also responsible for calculating the reward modifiers. Owner of this contract
 * can add new lockable assets.
 * @dev This contract is implementing ERC20 interface, but it is not transferable. If users want to transfer the token,
 * they have to withdraw the stake first.
 */
contract MultiERC20WeightedLocker is
  ERC20,
  ERC20Burnable,
  ERC20Permit,
  NonTransferableToken,
  Ownable
{
  using Counters for Counters.Counter;
  using BasisPointNumberMath for uint256;
  using Array for IStaking[];
  using Array for LockableAsset[];

  event DepositCreated(
    address indexed user,
    uint256 indexed depositId,
    address lockedAssetAddress,
    address stakingContractAddress,
    uint256 amountLocked,
    uint256 amountMinted,
    LockPeriod lockPeriod,
    uint256 depositTimestamp,
    uint256 unlockAvailibleTimestamp
  );
  event RewardsCollected(
    address indexed user,
    address stakingContractAddress,
    address rewardAssetAddress,
    uint256 amount
  );
  event DepositWithrdawn(
    address indexed user,
    uint256 indexed depositId,
    address lockedAssetAddress,
    address stakingContractAddress,
    uint256 unlockTimestamp
  );
  event DepositLiquidated(
    address indexed user,
    uint256 indexed depositId,
    address lockedAssetAddress,
    address stakingContractAddress,
    address liquidator,
    uint256 timestamp
  );

  uint256 public constant ONE_DAY_IN_SECONDS = 86400;

  /// @dev the deposit ID counter, each deposit has a unique ID
  Counters.Counter public currentDepositId;
  /// @dev user address => deposit ID => Deposit
  mapping(address => mapping(uint256 => Deposit)) public userDeposits;
  /// @dev user address => deposit ID
  mapping(address => uint256[]) public userDepositIds;
  /// @dev user address => amount of deposits made by the user
  mapping(address => uint256) public userDepositsAmount;
  /// @dev list of all addresses that have deposited
  address[] public depositors;
  // @dev total amount of depositors
  uint256 public depositorsAmount;

  LockableAsset[] public lockableAssets;
  /// @dev lockable asset index => are deposits disabled for this asset
  mapping(uint256 => bool) public isDepositingDisabledForAsset;
  /// @dev lockable asset index => amount locked
  mapping(uint256 => uint256) public lockedAssetAmount;

  IStaking[] public stakingContracts;
  IMintableBurnableToken public immutable governanceToken;

  constructor(
    string memory _name,
    string memory _symbol,
    LockableAsset[] memory _lockableAssets,
    IMintableBurnableToken _governanceToken
  ) ERC20(_name, _symbol) ERC20Permit(_name) {
    for (uint256 i = 0; i < _lockableAssets.length; i++) {
      lockableAssets.push(_lockableAssets[i]);
    }
    governanceToken = _governanceToken;
    currentDepositId.increment(); // so that the first deposit ID is 1
  }

  // ======== OWNER FUNCTIONS ========

  /**
   * @dev Adds a new staking contract to the list of staking contracts.
   * This function reverts if the staking contract passed as argument is already added.
   * @param _stakingContract The staking contract to be added.
   */
  function addStakingContract(IStaking _stakingContract) external onlyOwner {
    int256 existingElementIndex = stakingContracts.findElementInArray(_stakingContract);
    if (existingElementIndex >= 0)
      revert MultiERC20WeightedLocker__AddressAlreadyExists();
    stakingContracts.push(_stakingContract);
  }

  /**
   * @dev Adds a new lockable asset to the list of lockable assets.
   * This function reverts if the lockable asset passed as argument is already added.
   * @param _lockableAsset The lockable asset to be added.
   */
  function addLockableAsset(LockableAsset memory _lockableAsset) external onlyOwner {
    int256 existingElementIndex = lockableAssets.findElementInArray(_lockableAsset);
    if (existingElementIndex >= 0)
      revert MultiERC20WeightedLocker__AddressAlreadyExists();
    lockableAssets.push(_lockableAsset);
  }

  /**
   * @dev Disables deposits for a lockable asset.
   * @param _lockableAssetIndex The index of the lockable asset.
   */
  function disableDepositsForAsset(uint256 _lockableAssetIndex) external onlyOwner {
    if (_lockableAssetIndex >= lockableAssets.length)
      revert MultiERC20WeightedLocker__InvalidLockableAssetIndex();
    isDepositingDisabledForAsset[_lockableAssetIndex] = true;
  }

  /**
   * @dev Enables deposits for a lockable asset.
   * @param _lockableAssetIndex The index of the lockable asset.
   */
  function enableDepositsForAsset(uint256 _lockableAssetIndex) external onlyOwner {
    if (_lockableAssetIndex >= lockableAssets.length)
      revert MultiERC20WeightedLocker__InvalidLockableAssetIndex();
    isDepositingDisabledForAsset[_lockableAssetIndex] = false;
  }

  // ======== VIEW FUNCTIONS ========

  function getDeposit(
    address depositor,
    uint256 depositId
  ) external view returns (Deposit memory) {
    return userDeposits[depositor][depositId];
  }

  // ======== PUBLIC FUNCTIONS ========

  /**
   *  @notice Stake lockable asset to a selected staking contract and mint the governance token
   * taking the lock period into account. User can stake regular tokens or LP tokens of predefined pairs by
   * the contract owner.
   */
  function stake(
    uint256 _lockableAssetIndex,
    uint256 _stakingContractIndex,
    uint256 _amount,
    LockPeriod lockPeriod
  ) public returns (uint256 depositId, uint256 mintedAmount) {
    if (_lockableAssetIndex >= lockableAssets.length)
      revert MultiERC20WeightedLocker__InvalidLockableAssetIndex();
    if (_stakingContractIndex >= stakingContracts.length) {
      revert MultiERC20WeightedLocker__InvalidStakingContractIndex();
    }
    if (isDepositingDisabledForAsset[_lockableAssetIndex]) {
      revert MultiERC20WeightedLocker__DepositsInThisAssetHaveBeenDisabled();
    }

    LockableAsset memory lockableAsset = lockableAssets[_lockableAssetIndex];

    IStaking stakingContract = stakingContracts[_stakingContractIndex];

    uint256 initialDeposit = _amount;

    if (lockableAsset.isLPToken) {
      (uint256 lockedTokenAmount, ) = LiquidityValueCalculator.computeLiquidityShareValue(
        lockableAsset.token,
        _amount,
        lockableAsset.token
      );
      // This amount is doubled to make up to user that they had to deposit double the worth because of how AMM exchanges work.
      // User had to deposit the same amount of value in both tokens in order to deposit to LP Pool.
      // So if user 1 deposited 1000 tokens X directly and the second user deposited LP tokens representing a share of
      // 1000 tokens X and any amount of tokens Y, the second user should get twice as much rewards as the first user because
      // they effectively deposited twice as much of value.
      _amount = lockedTokenAmount * 2;
    }

    if (
      !IERC20(lockableAsset.token).transferFrom(
        _msgSender(),
        address(this),
        initialDeposit
      )
    ) {
      revert MultiERC20WeightedLocker__TransferFailed();
    }

    mintedAmount = _amount.applyModifierInBasisPoint(
      _calculateRewardModifier(lockableAsset.baseRewardModifier, lockPeriod)
    );
    _mint(_msgSender(), mintedAmount);
    if (lockableAsset.isEntitledToVote) {
      governanceToken.mint(_msgSender(), mintedAmount);
    }
    stakingContract.stakeFor(_msgSender(), mintedAmount);

    depositId = _addDeposit(
      _lockableAssetIndex,
      _stakingContractIndex,
      initialDeposit,
      mintedAmount,
      lockPeriod
    );

    emit DepositCreated(
      _msgSender(),
      depositId,
      lockableAsset.token,
      address(stakingContract),
      initialDeposit,
      mintedAmount,
      lockPeriod,
      block.timestamp,
      userDeposits[_msgSender()][depositId].unlockAvailibleTimestamp
    );
  }

  /// @dev Wrapper for stake function for tokens supporting EIP-2612 permit functionality
  function stakeWithPermit(
    uint256 _lockableAssetIndex,
    uint256 _stakingContractIndex,
    uint256 _amount,
    LockPeriod lockPeriod,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 depositId, uint256 mintedAmount) {
    if (_lockableAssetIndex >= lockableAssets.length)
      revert MultiERC20WeightedLocker__InvalidLockableAssetIndex();
    LockableAsset memory lockableAsset = lockableAssets[_lockableAssetIndex];
    IERC20Permit(lockableAsset.token).permit(
      _msgSender(),
      address(this),
      _amount,
      deadline,
      v,
      r,
      s
    );
    return stake(_lockableAssetIndex, _stakingContractIndex, _amount, lockPeriod);
  }

  /// @notice Withdraw the locked asset, collect rewards and burn the governance token.
  function withdraw(uint256 _depositId) public {
    Deposit memory deposit = userDeposits[_msgSender()][_depositId];
    if (!deposit.isOngoing) {
      revert MultiERC20WeightedLocker__DepositIsNotOngoing();
    }
    if (deposit.unlockAvailibleTimestamp > block.timestamp) {
      revert MultiERC20WeightedLocker__DepositIsStillLocked();
    }

    LockableAsset memory lockableAsset = lockableAssets[deposit.lockableAssetIndex];
    lockedAssetAmount[deposit.lockableAssetIndex] -= deposit.amountLocked;

    IStaking stakingContract = stakingContracts[deposit.stakingContractIndex];

    _removeDeposit(lockableAsset, stakingContract, deposit, _depositId, _msgSender());

    collectRewards(deposit.stakingContractIndex);

    bool isWithdrawalSuccess = IERC20(lockableAsset.token).transfer(
      _msgSender(),
      deposit.amountLocked
    );
    if (!isWithdrawalSuccess) {
      revert MultiERC20WeightedLocker__TransferFailed();
    }

    emit DepositWithrdawn(
      _msgSender(),
      _depositId,
      lockableAsset.token,
      address(stakingContract),
      block.timestamp
    );
  }

  /// @notice Collect rewards from all deposits for a particular staking contract
  function collectRewards(uint256 _stakingContractIndex) public returns (uint256 reward) {
    if (_stakingContractIndex >= stakingContracts.length) {
      revert MultiERC20WeightedLocker__InvalidStakingContractIndex();
    }
    IStaking stakingContract = stakingContracts[_stakingContractIndex];

    reward = stakingContract.collectRewardsFor(_msgSender());

    emit RewardsCollected(
      _msgSender(),
      address(stakingContract),
      stakingContract.getRewardToken(),
      reward
    );
  }

  function earnedReward(
    address _user,
    uint256 _stakingContractIndex
  ) public view returns (uint256 reward) {
    if (_stakingContractIndex >= stakingContracts.length) {
      revert MultiERC20WeightedLocker__InvalidStakingContractIndex();
    }
    IStaking stakingContract = stakingContracts[_stakingContractIndex];

    return stakingContract.earnedReward(_user);
  }

  /**
   * @dev Liquidate any user deposit which lock period is over. This is inspired by the Curve DAO
   * governance token boosting solution: https://curve.readthedocs.io/dao-gauges.html#boosting
   * Technically, if no one liquidates a stale deposit, the deposit owner will still receive more
   * rewards as if his tokens were still locked. However, it is in the interest of the community
   * to liquidate stale deposits to maximise their share of rewards to be distributed.
   */
  function liquidateStaleDeposit(address _user, uint256 _depositId) public {
    Deposit memory deposit = userDeposits[_user][_depositId];
    if (!deposit.isOngoing) {
      revert MultiERC20WeightedLocker__DepositIsNotOngoing();
    }
    if (deposit.unlockAvailibleTimestamp > block.timestamp) {
      revert MultiERC20WeightedLocker__DepositIsStillLocked();
    }
    if (deposit.lockPeriod == LockPeriod.NoLock) {
      revert MultiERC20WeightedLocker__DepositIsNotLocked();
    }

    LockableAsset memory lockableAsset = lockableAssets[deposit.lockableAssetIndex];
    IStaking stakingContract = stakingContracts[deposit.stakingContractIndex];

    _removeDeposit(lockableAsset, stakingContract, deposit, _depositId, _user);

    bool isTransferSuccess = IERC20(lockableAsset.token).transfer(
      _user,
      deposit.amountLocked
    );
    if (!isTransferSuccess) {
      revert MultiERC20WeightedLocker__TransferFailed();
    }

    emit DepositLiquidated(
      _user,
      _depositId,
      lockableAsset.token,
      address(stakingContract),
      _msgSender(),
      block.timestamp
    );
  }

  // ======== PRIVATE FUNCTIONS ========

  function _removeDeposit(
    LockableAsset memory _lockableAsset,
    IStaking _stakingContract,
    Deposit memory _deposit,
    uint256 _depositId,
    address _user
  ) private {
    _stakingContract.withdrawFor(_user, _deposit.amountLocked);

    _burn(_user, _deposit.amountMinted);
    if (_lockableAsset.isEntitledToVote) {
      governanceToken.burn(_user, _deposit.amountMinted);
    }

    userDeposits[_user][_depositId].isOngoing = false;
  }

  function _calculateRewardModifier(
    uint256 lockRewardModifier,
    LockPeriod lockPeriod
  ) internal pure returns (uint256 rewardModifier) {
    rewardModifier = lockRewardModifier;
    if (lockPeriod == LockPeriod.NinetyDays) {
      rewardModifier = rewardModifier.applyModifierInBasisPoint(10200); // x1.02
    } else if (lockPeriod == LockPeriod.OneHundredAndEightyDays) {
      rewardModifier = rewardModifier.applyModifierInBasisPoint(10500); // x1.05
    } else if (lockPeriod == LockPeriod.ThreeHundredAndSixtyDays) {
      rewardModifier = rewardModifier.applyModifierInBasisPoint(11200); // x1.12
    }
  }

  function _addDeposit(
    uint256 _lockableAssetIndex,
    uint256 _stakingContractIndex,
    uint256 _amount,
    uint256 _mintedAmount,
    LockPeriod lockPeriod
  ) internal returns (uint256 depositId) {
    uint256 depositTimestamp = block.timestamp;
    uint256 unlockAvailibleTimestamp = depositTimestamp;
    if (lockPeriod == LockPeriod.NinetyDays) {
      unlockAvailibleTimestamp += 90 * ONE_DAY_IN_SECONDS;
    } else if (lockPeriod == LockPeriod.OneHundredAndEightyDays) {
      unlockAvailibleTimestamp += 180 * ONE_DAY_IN_SECONDS;
    } else if (lockPeriod == LockPeriod.ThreeHundredAndSixtyDays) {
      unlockAvailibleTimestamp += 360 * ONE_DAY_IN_SECONDS;
    }

    lockedAssetAmount[_lockableAssetIndex] += _amount;

    depositId = _getDepositId();
    userDeposits[_msgSender()][depositId] = Deposit(
      _lockableAssetIndex,
      _stakingContractIndex,
      _amount,
      _mintedAmount,
      lockPeriod,
      depositTimestamp,
      unlockAvailibleTimestamp,
      true
    );

    userDepositIds[_msgSender()].push(depositId);
    userDepositsAmount[_msgSender()]++;
    depositors.push(_msgSender());
    depositorsAmount++;
  }

  function _getDepositId() internal returns (uint256 depositId) {
    depositId = currentDepositId.current();
    currentDepositId.increment();
  }

  // The following functions are overrides required by Solidity.

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override(ERC20, NonTransferableToken) {
    super._beforeTokenTransfer(from, to, amount);
  }
}
