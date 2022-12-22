// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/escrow/Escrow.sol';
import {Staking} from './Staking.sol';
import '../gelatoAutomate/OpsReady.sol';
import '../tokens/MultiERC20WeightedLocker.sol';

error PeriodStarter__TimestampIsInPast();
error PeriodStarter__TaskAlreadyCreated();

contract StaleDepositLiquidator is Ownable, OpsReady, Escrow {
  event PeriodStarterTaskScheduled(uint256 timestamp, bytes32 taskId);
  event PeriodStarterTaskCancelled(uint256 timestamp, bytes32 taskId);

  MultiERC20WeightedLocker public immutable locker;

  bytes32 public periodSchedulerTaskId;

  constructor(
    address _ops,
    MultiERC20WeightedLocker _lockerContract
  ) OpsReady(_ops, msg.sender) {
    locker = _lockerContract;
  }

  function createTask() external onlyOwner {
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
      abi.encodeCall(this.getListOfStaleDepositsToLiquidate, ())
    );

    periodSchedulerTaskId = ops.createTask(
      msg.sender,
      bytes(''),
      moduleData,
      NATIVE_TOKEN
    );

    emit PeriodStarterTaskScheduled(block.timestamp, periodSchedulerTaskId);
  }

  function cancelTask() external onlyOwner {
    ops.cancelTask(periodSchedulerTaskId);
    periodSchedulerTaskId = bytes32('');
    emit PeriodStarterTaskCancelled(block.timestamp, periodSchedulerTaskId);
  }

  function withdrawFunds() external onlyOwner {
    _withdrawNativeToken(payable(owner()));
  }

  function getRangeFromArray(
    uint256[] memory _array,
    uint256 _start,
    uint256 _end
  ) internal pure returns (uint256[] memory) {
    uint256[] memory result = new uint256[](_end - _start);
    for (uint256 i = _start; i < _end; i++) {
      result[i - _start] = _array[i];
    }
    return result;
  }

  function getListOfStaleDepositsToLiquidate()
    external
    view
    returns (bool canExec, bytes memory execPayload)
  {
    DepositToLiquidate[] memory allDeposits = new DepositToLiquidate[](
      locker.currentDepositId()
    );
    uint256 amountOfDepositsToLiquidate = 0;

    uint256 depositorsAmount = locker.depositorsAmount();
    for (uint i = 0; i < depositorsAmount; i++) {
      address depositor = locker.depositors(i);
      uint256 depositsAmount = locker.userDepositsAmount(depositor);
      for (uint j = 0; j < depositsAmount; j++) {
        uint256 depositId = locker.userDepositIds(depositor, j);
        Deposit memory deposit = locker.getDeposit(depositor, depositId);
        if (
          deposit.isOngoing &&
          deposit.lockPeriod != LockPeriod.NoLock &&
          deposit.unlockAvailibleTimestamp < block.timestamp
        ) {
          allDeposits[amountOfDepositsToLiquidate] = DepositToLiquidate(
            depositor,
            depositId
          );
          amountOfDepositsToLiquidate++;
        }
      }
    }
    if (amountOfDepositsToLiquidate == 0) {
      return (false, bytes('No deposits to liquidate'));
    }

    return (
      true,
      abi.encodeWithSelector(
        this.liquidateStaleDeposits.selector,
        _sliceDepositsArray(allDeposits, amountOfDepositsToLiquidate)
      )
    );
  }

  function _sliceDepositsArray(
    DepositToLiquidate[] memory _array,
    uint256 amount
  ) internal pure returns (DepositToLiquidate[] memory) {
    DepositToLiquidate[] memory result = new DepositToLiquidate[](amount);
    for (uint256 i = 0; i < amount; i++) {
      result[i] = _array[i];
    }
    return result;
  }

  struct DepositToLiquidate {
    address depositor;
    uint256 depositId;
  }

  function liquidateStaleDeposits(
    DepositToLiquidate[] calldata depositsToLiquidate
  ) external automatedTask {
    for (uint256 i = 0; i < depositsToLiquidate.length; i++) {
      DepositToLiquidate memory depositToLiquidate = depositsToLiquidate[i];
      locker.liquidateStaleDeposit(
        depositToLiquidate.depositor,
        depositToLiquidate.depositId
      );
    }
  }
}
