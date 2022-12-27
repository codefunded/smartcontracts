import { ethers } from 'hardhat';
import { WithdrawnNativeTokenEvent } from '../../../typechain-types/contracts/gelatoAutomate/OpsReady';

const LIQUIDATOR_ADDRESS = process.env.LIQUIDATOR_ADDRESS;

const isLiquidatorFundsWithdrawnEvent = (
  event: any,
): event is WithdrawnNativeTokenEvent => event.event === 'WithdrawnNativeToken';

async function main() {
  if (LIQUIDATOR_ADDRESS === undefined) {
    throw new Error('LIQUIDATOR_ADDRESS must be set');
  }

  const liquidator = await ethers.getContractAt(
    'StaleDepositLiquidator',
    LIQUIDATOR_ADDRESS,
  );

  console.log('Withdrawing funds from liquidator...');

  const tx = await liquidator.withdrawFunds();

  const receipt = await tx.wait();
  receipt.events?.forEach((event) => {
    if (isLiquidatorFundsWithdrawnEvent(event)) {
      console.log(`Withdrawn amount: ${ethers.utils.formatEther(event.args.value)}`);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
