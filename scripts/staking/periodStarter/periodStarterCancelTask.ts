import { ethers } from 'hardhat';
import { TaskCancelledEvent } from '../../../typechain-types/contracts/staking/StaleDepositLiquidator';

const PERIOD_STARTER_ADDRESS = process.env.PERIOD_STARTER_ADDRESS;

const isPeriodStarterTaskCancelledEvent = (event: any): event is TaskCancelledEvent =>
  event.event === 'TaskCancelled';

async function main() {
  if (PERIOD_STARTER_ADDRESS === undefined) {
    throw new Error('PERIOD_STARTER_ADDRESS must be set');
  }

  const periodStarter = await ethers.getContractAt(
    'PeriodStarter',
    PERIOD_STARTER_ADDRESS,
  );

  console.log('Cancelling period starter task...');

  const tx = await periodStarter.cancelTask();

  const receipt = await tx.wait();
  receipt.events?.forEach((event) => {
    if (isPeriodStarterTaskCancelledEvent(event)) {
      console.log(`Period starter task with ID: ${event.args.taskId} cancelled.`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
