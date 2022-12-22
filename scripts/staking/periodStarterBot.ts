import { ethers } from 'hardhat';
import dayjs from 'dayjs';
import { BigNumber } from 'ethers';

const STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS;

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

async function main() {
  if (STAKING_CONTRACT_ADDRESS === undefined) {
    throw new Error('STAKING_CONTRACT_ADDRESS must be set');
  }

  const staking = await ethers.getContractAt('Staking', STAKING_CONTRACT_ADDRESS);
  const currentRewardPeriodFinishTimestamp = await staking.finishAt();

  console.log('Starting to listen for current reward period to finish...');

  while (true) {
    try {
      await staking.startNewRewardsPeriod(
        calculatePeriodLengthInSeconds(currentRewardPeriodFinishTimestamp),
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
      await new Promise((resolve) => setTimeout(resolve, 3000)); // every second
    }
  }

  console.log(`Staking rewards period started! 🚀 🚀 🚀 `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
