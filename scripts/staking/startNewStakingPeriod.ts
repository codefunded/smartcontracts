import { ethers } from 'hardhat';
import { getNetworkConfig } from '../../utils/networkConfigs';

const STAKING_ADDRESS = process.env.STAKING_ADDRESS;
const DURATION = process.env.DURATION;
const REWARDS_AMOUNT = process.env.REWARDS_AMOUNT;

async function main() {
  if (STAKING_ADDRESS === undefined) {
    throw new Error('STAKING_ADDRESS must be set');
  }
  if (DURATION === undefined) {
    throw new Error('DURATION must be set');
  }
  if (REWARDS_AMOUNT === undefined) {
    throw new Error('REWARDS_AMOUNT must be set');
  }
  const { chainId } = await ethers.provider.getNetwork();
  const networkConfig = getNetworkConfig(`${chainId}`);

  const staking = await ethers.getContractAt('Staking', STAKING_ADDRESS);
  const [user] = await ethers.getSigners();

  if (!(await staking.hasRole(staking.PERIOD_STARTER(), user.address))) {
    if (await staking.hasRole(staking.DEFAULT_ADMIN_ROLE(), user.address)) {
      console.log('Granting scheduler role to user...');
      await (
        await staking.grantRole(staking.PERIOD_STARTER(), user.address)
      ).wait(networkConfig.confirmations);
    } else {
      throw new Error('User is not a scheduler nor an admin');
    }
  }

  console.log('Starting new rewards period...');

  await staking.startNewRewardsPeriod(DURATION, REWARDS_AMOUNT);

  console.log(`New rewards period started`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
