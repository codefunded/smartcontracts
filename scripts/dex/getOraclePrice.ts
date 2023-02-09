import { ethers } from 'hardhat';

async function main() {
  const { TOKEN0, ORACLE_ADDRESS } = process.env;

  if (!TOKEN0 || !ORACLE_ADDRESS) {
    throw new Error('Missing required environment variables');
  }

  const oracle = await ethers.getContractAt('IUniswapV2TwapOracle', ORACLE_ADDRESS);
  const pairAddr = await oracle.pair();

  const pair = await ethers.getContractAt('IUniswapV2Pair', pairAddr);

  const spotReserves = await pair.getReserves();
  const observedPrices = await oracle.functions.getObservedPrices(TOKEN0);
  const priceRatos = await oracle.functions.getPriceRatios(TOKEN0);

  console.log({
    spotReserves,
    observedPrices,
    priceRatos,
  });
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
