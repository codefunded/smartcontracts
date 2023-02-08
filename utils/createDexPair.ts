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
  const networkConfig = getNetworkConfig(chainId);
  const dexPairFactory =
    pairFactoryCreator ?? networkConfig.existingContracts?.pairFactoryCreator;

  if (!dexPairFactory) {
    throw new Error('No pair factory creator found');
  }

  const dexPairFactoryContract = await ethers.getContractAt(
    'IUniswapV2Factory',
    dexPairFactory,
  );

  let address = await dexPairFactoryContract.callStatic.getPair(token0, token1);
  if (address === ethers.constants.AddressZero) {
    const createPairTx = await dexPairFactoryContract.createPair(token0, token1);
    const receipt = await createPairTx.wait(networkConfig.confirmations);
    address = receipt.events?.[0].args?.pair;
  }

  return address;
};
