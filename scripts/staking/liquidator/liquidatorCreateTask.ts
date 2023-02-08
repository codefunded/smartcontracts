import { ethers } from 'hardhat';
import { TaskScheduledEvent } from '../../../typechain-types/contracts/staking/StaleDepositLiquidator';

const LIQUIDATOR_ADDRESS = process.env.LIQUIDATOR_ADDRESS;

const isLiquidatorTaskScheduledEvent = (event: any): event is TaskScheduledEvent =>
  event.event === 'TaskScheduled';

async function main() {
  if (LIQUIDATOR_ADDRESS === undefined) {
    throw new Error('LIQUIDATOR_ADDRESS must be set');
  }

  const liquidator = await ethers.getContractAt(
    'StaleDepositLiquidator',
    LIQUIDATOR_ADDRESS,
  );

  console.log('Starting stale deposit liquidator task...');

  const tx = await liquidator.createTask();

  const receipt = await tx.wait();
  receipt.events?.forEach((event) => {
    if (isLiquidatorTaskScheduledEvent(event)) {
      console.log(`Liquidator task created with ID: ${event.args.taskId}`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
