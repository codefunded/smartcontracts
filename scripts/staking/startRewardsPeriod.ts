import { time } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { USDC_ADDRESS } from '../../utils/networkConfigs';

async function main() {
  if (process.env.STAKING_CONTRACT_ADDRESS === undefined) {
    throw new Error('STAKING_CONTRACT_ADDRESS must be set');
  }

  const staking = await ethers.getContractAt(
    'Staking',
    process.env.STAKING_CONTRACT_ADDRESS,
  );
  const usdc = await ethers.getContractAt('IERC20', USDC_ADDRESS);

  await usdc.transfer(staking.address, ethers.utils.parseUnits('100', 6));
  await staking.setRewardsDuration(time.duration.weeks(12));
  await staking.notifyRewardAmount(ethers.utils.parseUnits('100', 6));

  console.log(`Staking rewards period started! 🚀 🚀 🚀 `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
