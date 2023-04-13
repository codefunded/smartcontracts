import { ethers } from 'hardhat';
import { DEFAULT_FEE } from '../../constants';

export async function deployFundSwap() {
  const FundSwapFactory = await ethers.getContractFactory('FundSwap');
  const fundSwap = await FundSwapFactory.deploy(DEFAULT_FEE);
  await fundSwap.deployed();

  const fundSwapOrderManagerAddress = await fundSwap.fundSwapOrderManager();
  const fundSwapOrderManager = await ethers.getContractAt(
    'FundSwapOrderManager',
    fundSwapOrderManagerAddress,
  );

  return { fundSwap, fundSwapOrderManager };
}
