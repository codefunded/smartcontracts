import { ethers, network } from 'hardhat';
import { DEFAULT_FEE } from '../../utils/constants';

async function main() {
  const FundSwapFactory = await ethers.getContractFactory('FundSwap');

  console.log(`Deploying FundSwap to ${network.name} network...`);

  const fundSwap = await FundSwapFactory.deploy(DEFAULT_FEE);
  await fundSwap.deployed();

  console.log(
    `FundSwap deployed to ${
      fundSwap.address
    } and FundSwapOrderManager deployed to ${await fundSwap.fundSwapOrderManager()}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
