import { ethers } from 'hardhat';
import { getNetworkConfig } from './networkConfigs';

export const createDexPair = async ({
  token0,
  token1,
  pairFactoryCreator,
  chainId = '31337',
}: {
  token0: string;
  token1: string;
  pairFactoryCreator?: string;
  chainId?: string;
}) => {
  const dexPairFactory =
    pairFactoryCreator ?? getNetworkConfig(chainId).existingContracts?.pairFactoryCreator;

  if (!dexPairFactory) {
    throw new Error('No pair factory creator found');
  }

  const dexPairFactoryContract = await ethers.getContractAt(
    'IUniswapV2Factory',
    dexPairFactory,
  );

  let address = await dexPairFactoryContract.callStatic.getPair(token0, token1);
  if(address === ethers.constants.AddressZero){
    address = await dexPairFactoryContract.callStatic.createPair(token0, token1);
  }

  return address;
};
