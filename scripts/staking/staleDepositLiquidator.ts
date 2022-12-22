import { ethers } from 'hardhat';

const LOCKER_CONTRACT_ADDRESS = process.env.LOCKER_CONTRACT_ADDRESS;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ONE_MINUTE = 60_000;

const getAllStaleDepositEvents = async () => {
  if (LOCKER_CONTRACT_ADDRESS === undefined) {
    throw new Error('LOCKER_CONTRACT_ADDRESS must be set');
  }

  const locker = await ethers.getContractAt(
    'MultiERC20WeightedLocker',
    LOCKER_CONTRACT_ADDRESS,
  );
  const deposits = await locker.queryFilter(locker.filters.DepositCreated());
  return (
    await Promise.all(
      deposits
        .filter((deposit) =>
          deposit.args.unlockAvailibleTimestamp.mul(1000).lt(Date.now()),
        )
        .map(async (deposit) => ({
          event: deposit,
          depositObject: await locker.getDeposit(
            deposit.args.user,
            deposit.args.depositId,
          ),
        })),
    )
  ).filter(({ depositObject }) => depositObject.isOngoing);
};

async function main() {
  if (LOCKER_CONTRACT_ADDRESS === undefined) {
    throw new Error('LOCKER_CONTRACT_ADDRESS must be set');
  }

  const locker = await ethers.getContractAt(
    'MultiERC20WeightedLocker',
    LOCKER_CONTRACT_ADDRESS,
  );

  console.log('Starting to liquidate stale deposits...');

  while (true) {
    try {
      const staleDeposits = await getAllStaleDepositEvents();
      if (staleDeposits.length === 0) {
        console.log('No stale deposits found');
        await wait(ONE_MINUTE);
        continue;
      }
      await Promise.all(
        staleDeposits.map(({ event }) =>
          locker.liquidateStaleDeposit(event.args.user, event.args.depositId),
        ),
      );
    } catch (err) {}
    await wait(ONE_MINUTE);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
