import { ethers } from 'hardhat';
import dayjs from 'dayjs';
import { BigNumber } from 'ethers';

const STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS;
const REWARDS_AMOUNT = process.env.REWARDS_AMOUNT;

const calculatePeriodLengthInSeconds = (
  currentRewardPeriodFinishTimestamp: BigNumber,
) => {
  const finishDateOfCurrentPeriod = dayjs(
    currentRewardPeriodFinishTimestamp.mul(1000).toNumber(),
  );
  // by default 3 months are added, in case of beeing more specific we can pass a particular dayjs date here
  const finishDateOfNextPeriod = finishDateOfCurrentPeriod.add(3, 'months'); // this takes the leap years and different month lengths into account
  return finishDateOfNextPeriod.diff(finishDateOfCurrentPeriod, 'seconds');
};

/**
 * This script starts a new rewards period for the staking contract.
 * In order to work it has to have REWARDS_AMOUNT specified specifically for the next staking period.
 */
async function main() {
  if (STAKING_CONTRACT_ADDRESS === undefined) {
    throw new Error('STAKING_CONTRACT_ADDRESS must be set');
  }
  if (REWARDS_AMOUNT === undefined) {
    throw new Error('REWARDS_AMOUNT must be set');
  }

  const staking = await ethers.getContractAt('Staking', STAKING_CONTRACT_ADDRESS);
  const currentRewardPeriodFinishTimestamp = await staking.finishAt();

  console.log('Starting to listen for current reward period to finish...');

  while (true) {
    try {
      // sender has to have the PERIOD_STARTER role
      await staking.startNewRewardsPeriod(
        calculatePeriodLengthInSeconds(currentRewardPeriodFinishTimestamp),
        REWARDS_AMOUNT,
      );
      break;
    } catch (err) {
      if (
        !(err as { reason: string }).reason.includes(
          'Staking__RewardsDurationNotFinished',
        )
      ) {
        console.log(err);
      }

      console.log(`[${new Date().toISOString()}] - Period is still not over...`);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // every 5 seconds
    }
  }

  console.log(`Staking rewards period started! 🚀 🚀 🚀 `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
