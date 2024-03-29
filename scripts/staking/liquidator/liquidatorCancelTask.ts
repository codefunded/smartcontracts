import { ethers } from 'hardhat';
import { TaskCancelledEvent } from '../../../typechain-types/contracts/staking/StaleDepositLiquidator';

const LIQUIDATOR_ADDRESS = process.env.LIQUIDATOR_ADDRESS;

const isLiquidatorTaskCancelledEvent = (event: any): event is TaskCancelledEvent =>
  event.event === 'TaskCancelled';

async function main() {
  if (LIQUIDATOR_ADDRESS === undefined) {
    throw new Error('LIQUIDATOR_ADDRESS must be set');
  }

  const liquidator = await ethers.getContractAt(
    'StaleDepositLiquidator',
    LIQUIDATOR_ADDRESS,
  );

  console.log('Cancelling stale deposit liquidator task...');

  const tx = await liquidator.cancelTask();

  const receipt = await tx.wait();
  receipt.events?.forEach((event) => {
    if (isLiquidatorTaskCancelledEvent(event)) {
      console.log(`Liquidator task with ID: ${event.args.taskId} cancelled.`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
