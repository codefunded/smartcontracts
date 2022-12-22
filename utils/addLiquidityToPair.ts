import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { IERC20 } from '../typechain-types';
import { getNetworkConfig } from './networkConfigs';

export const addLiquidityToPair = async ({
  token0,
  token1,
  amount0,
  amount1,
  userAddress,
  dexRouter,
  chainId = '31337',
}: {
  token0: IERC20;
  token1: IERC20;
  amount0: BigNumberish;
  amount1: BigNumberish;
  userAddress: string;
  dexRouter?: string;
  chainId?: string;
}) => {
  const dexRouterAddress =
    dexRouter ?? getNetworkConfig(chainId).existingContracts?.dexRouter;

  if (!dexRouterAddress) {
    throw new Error('No DEX router contract found');
  }

  const router = await ethers.getContractAt('IUniswapV2Router01', dexRouterAddress);

  await token0.approve(router.address, amount0);
  await token1.approve(router.address, amount1);

  await router.addLiquidity(
    token0.address,
    token1.address,
    amount0,
    amount1,
    amount0,
    amount1,
    userAddress,
    ethers.constants.MaxUint256,
  );
};
