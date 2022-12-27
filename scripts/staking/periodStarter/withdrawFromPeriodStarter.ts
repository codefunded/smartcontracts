import { ethers } from 'hardhat';
import { WithdrawnNativeTokenEvent } from '../../../typechain-types/contracts/gelatoAutomate/OpsReady';

const PERIOD_STARTER_ADDRESS = process.env.PERIOD_STARTER_ADDRESS;

const isPeriodStarterFundsWithdrawnEvent = (
  event: any,
): event is WithdrawnNativeTokenEvent => event.event === 'WithdrawnNativeToken';

async function main() {
  if (PERIOD_STARTER_ADDRESS === undefined) {
    throw new Error('PERIOD_STARTER_ADDRESS must be set');
  }

  const periodStarter = await ethers.getContractAt(
    'PeriodStarter',
    PERIOD_STARTER_ADDRESS,
  );

  console.log('Withdrawing funds from period starter...');
  const [user] = await ethers.getSigners();
  const tx = await periodStarter.withdrawFunds(user.address);

  const receipt = await tx.wait();
  receipt.events?.forEach((event) => {
    if (isPeriodStarterFundsWithdrawnEvent(event)) {
      console.log(`Withdrawn amount: ${ethers.utils.formatEther(event.args.value)}`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
