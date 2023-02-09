import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

async function main() {
  const {
    TOKEN0,
    TOKEN0_INPUT_AMOUNT,
    TOKEN1,
    TOKEN1_OUTPUT_AMOUNT,
    DEX_ROUTER_ADDRESS,
  } = process.env;

  if (
    !TOKEN0 ||
    !TOKEN0_INPUT_AMOUNT ||
    !TOKEN1 ||
    !TOKEN1_OUTPUT_AMOUNT ||
    !DEX_ROUTER_ADDRESS
  ) {
    throw new Error('Missing required environment variables');
  }

  const [user] = await ethers.getSigners();

  const dexRouter = await ethers.getContractAt('IUniswapV2Router01', DEX_ROUTER_ADDRESS);

  const token0 = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    TOKEN0,
  );
  const token1 = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    TOKEN1,
  );
  const token0Symbol = await token0.symbol();
  const token1Symbol = await token1.symbol();

  if (
    (await token0.allowance(user.address, DEX_ROUTER_ADDRESS)) <
    BigNumber.from(TOKEN0_INPUT_AMOUNT)
  ) {
    console.log(`Approving ${token0Symbol} for swap`);
    await (await token0.approve(dexRouter.address, ethers.constants.MaxUint256)).wait(6);
  }

  const [takenAmount, outputAmount] = await dexRouter.callStatic.swapExactTokensForTokens(
    TOKEN0_INPUT_AMOUNT,
    TOKEN1_OUTPUT_AMOUNT,
    [TOKEN0, TOKEN1],
    user.address,
    ethers.constants.MaxUint256,
  );

  await dexRouter.swapExactTokensForTokens(
    TOKEN0_INPUT_AMOUNT,
    TOKEN1_OUTPUT_AMOUNT,
    [TOKEN0, TOKEN1],
    user.address,
    ethers.constants.MaxUint256,
  );
  console.log(
    `Traded ${takenAmount} ${token0Symbol} for ${outputAmount} ${token1Symbol}`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
