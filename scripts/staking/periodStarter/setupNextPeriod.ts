import { ethers } from 'hardhat';
import { getNetworkConfig } from '../../../utils/networkConfigs';

const PERIOD_STARTER_ADDRESS = process.env.PERIOD_STARTER_ADDRESS;
const FINISH_AT = process.env.FINISH_AT;
const REWARDS_AMOUNT = process.env.REWARDS_AMOUNT;

async function main() {
  if (PERIOD_STARTER_ADDRESS === undefined) {
    throw new Error('PERIOD_STARTER_ADDRESS must be set');
  }
  if (FINISH_AT === undefined) {
    throw new Error('FINISH_AT must be set');
  }
  if (REWARDS_AMOUNT === undefined) {
    throw new Error('REWARDS_AMOUNT must be set');
  }
  const { chainId } = await ethers.provider.getNetwork();
  const networkConfig = getNetworkConfig(`${chainId}`);

  const periodStarter = await ethers.getContractAt(
    'PeriodStarter',
    PERIOD_STARTER_ADDRESS,
  );
  const [user] = await ethers.getSigners();
  if (!(await periodStarter.hasRole(periodStarter.SCHEDULER_ROLE(), user.address))) {
    if (await periodStarter.hasRole(periodStarter.DEFAULT_ADMIN_ROLE(), user.address)) {
      console.log('Granting scheduler role to user...');
      await (
        await periodStarter.grantRole(periodStarter.SCHEDULER_ROLE(), user.address)
      ).wait(networkConfig.confirmations);
    } else {
      throw new Error('User is not a scheduler nor an admin');
    }
  }

  console.log('Setting next period finish at...');

  await periodStarter.scheduleNextRewardsPeriod(FINISH_AT, REWARDS_AMOUNT);

  console.log(`Next period finish at set to ${FINISH_AT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
