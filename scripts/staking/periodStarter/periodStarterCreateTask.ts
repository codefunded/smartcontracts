import { ethers } from 'hardhat';
import { PeriodStarterTaskScheduledEvent } from '../../../typechain-types/contracts/staking/PeriodStarter';

const PERIOD_STARTER_ADDRESS = process.env.PERIOD_STARTER_ADDRESS;

const isPeriodStarterTaskScheduledEvent = (
  event: any,
): event is PeriodStarterTaskScheduledEvent =>
  event.event === 'PeriodStarterTaskScheduled';

async function main() {
  if (PERIOD_STARTER_ADDRESS === undefined) {
    throw new Error('PERIOD_STARTER_ADDRESS must be set');
  }

  const periodStarter = await ethers.getContractAt(
    'PeriodStarter',
    PERIOD_STARTER_ADDRESS,
  );

  console.log('Starting period starter task...');

  const tx = await periodStarter.createTask();

  const receipt = await tx.wait();
  receipt.events?.forEach((event) => {
    if (isPeriodStarterTaskScheduledEvent(event)) {
      console.log(`Period starter task created with ID: ${event.args.taskId}`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
