// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import '@openzeppelin/contracts/access/AccessControl.sol';
import {Staking} from './Staking.sol';
import '../gelatoAutomate/OpsReady.sol';

error PeriodStarter__TimestampIsInPast();
error PeriodStarter__NewTimestampIsOlderThanExistingOne();
error PeriodStarter__TaskAlreadyCreated();

contract PeriodStarter is AccessControl, OpsReady {
  event PeriodStarterTaskScheduled(uint256 timestamp, bytes32 taskId);
  event PeriodStarterTaskCancelled(uint256 timestamp, bytes32 taskId);

  Staking public immutable stakingContract;

  uint256 public nextStakingPeriodFinishAt;

  bytes32 public constant SCHEDULER_ROLE = keccak256('SCHEDULER_ROLE');

  bytes32 public periodSchedulerTaskId;

  constructor(address _ops, Staking _stakingContract) OpsReady(_ops, msg.sender) {
    stakingContract = _stakingContract;
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  function createTask() external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (periodSchedulerTaskId != bytes32('')) {
      revert PeriodStarter__TaskAlreadyCreated();
    }
    ModuleData memory moduleData = ModuleData({
      modules: new Module[](1),
      args: new bytes[](1)
    });
    moduleData.modules[0] = Module.RESOLVER;
    moduleData.args[0] = _resolverModuleArg(
      address(this),
      abi.encodeCall(this.canStartNewRewardsPeriod, ())
    );

    periodSchedulerTaskId = ops.createTask(
      msg.sender,
      abi.encode(this.startNewRewardsPeriod.selector),
      moduleData,
      NATIVE_TOKEN
    );

    emit PeriodStarterTaskScheduled(block.timestamp, periodSchedulerTaskId);
  }

  function cancelTask() external onlyRole(DEFAULT_ADMIN_ROLE) {
    ops.cancelTask(periodSchedulerTaskId);
    emit PeriodStarterTaskCancelled(block.timestamp, periodSchedulerTaskId);
    periodSchedulerTaskId = bytes32('');
  }

  function withdrawFunds(address owner) external onlyRole(DEFAULT_ADMIN_ROLE) {
    _withdrawNativeToken(payable(owner));
  }

  function scheduleNextRewardsPeriod(
    uint256 _nextPeriodFinishTimestamp
  ) external onlyRole(SCHEDULER_ROLE) {
    if (block.timestamp >= _nextPeriodFinishTimestamp) {
      revert PeriodStarter__TimestampIsInPast();
    }
    uint256 currentPeriodFinishAt = stakingContract.finishAt();
    if (currentPeriodFinishAt > _nextPeriodFinishTimestamp) {
      revert PeriodStarter__NewTimestampIsOlderThanExistingOne();
    }
    nextStakingPeriodFinishAt = _nextPeriodFinishTimestamp;
  }

  function canStartNewRewardsPeriod()
    external
    view
    returns (bool canExec, bytes memory execPayload)
  {
    uint256 currentPeriodFinishAt = stakingContract.finishAt();
    if (currentPeriodFinishAt > block.timestamp) {
      return (false, 'Current period is not finished yet');
    }
    uint256 nextPeriodDuration = nextStakingPeriodFinishAt - currentPeriodFinishAt;
    return (true, abi.encodeCall(this.startNewRewardsPeriod, (nextPeriodDuration)));
  }

  function startNewRewardsPeriod(uint256 nextPeriodDuration) external automatedTask {
    // all checks are done in staking contract
    stakingContract.startNewRewardsPeriod(nextPeriodDuration);
  }
}
