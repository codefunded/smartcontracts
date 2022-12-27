import { ethers } from 'hardhat';

const PERIOD_STARTER_ADDRESS = process.env.PERIOD_STARTER_ADDRESS;
const FINISH_AT = process.env.FINISH_AT;

async function main() {
  if (PERIOD_STARTER_ADDRESS === undefined) {
    throw new Error('PERIOD_STARTER_ADDRESS must be set');
  }
  if (FINISH_AT === undefined) {
    throw new Error('FINISH_AT must be set');
  }

  const periodStarter = await ethers.getContractAt(
    'PeriodStarter',
    PERIOD_STARTER_ADDRESS,
  );

  console.log('Setting next period finish at...');

  await periodStarter.scheduleNextRewardsPeriod(FINISH_AT);

  console.log(`Next period finish at set to ${FINISH_AT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
