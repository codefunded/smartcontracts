import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { ethers } from 'hardhat';
import { createDexPair } from '../utils/createDexPair';
import fs from 'fs';
import path from 'path';
import { addLiquidityToPair } from '../utils/addLiquidityToPair';

const getAbiForPair = () => {
  const pairABIPath = path.resolve(
    __dirname,
    '..',
    './artifacts/@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json',
  );
  const pairABIFile = fs.readFileSync(pairABIPath, 'utf8');
  const pairABI = JSON.parse(pairABIFile).abi;
  return pairABI;
};

const deployDexPair: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { get, log, save } = deployments;
  const chainId = await getChainId();
  const { deployer } = await getNamedAccounts();
  const networkConfig = getNetworkConfig(chainId);

  const dividendTokenDeployment = await get('DividendToken');
  const usdcAddress =
    networkConfig.existingContracts?.usdcToken || (await get('MockUSDC')).address;

  log(
    `deploying pair to DEX for DividendToken: ${dividendTokenDeployment.address} and USDC: ${usdcAddress}...`,
  );
  const pairAddress = await createDexPair({
    token0: dividendTokenDeployment.address,
    token1: usdcAddress,
    chainId,
    pairFactoryCreator: networkConfig.existingContracts.pairFactoryCreator,
  });
  log(`Pair deployed to DEX at address: ${pairAddress}`);

  try {
    await get('DexPair');
  } catch (e) {
    await save('DexPair', {
      abi: getAbiForPair(),
      address: pairAddress,
    });
  }

  const dividendToken = await ethers.getContractAt(
    'IERC20',
    dividendTokenDeployment.address,
  );
  const usdcToken = await ethers.getContractAt('IERC20', usdcAddress);
  const pair = await ethers.getContractAt('IUniswapV2Pair', pairAddress);
  const [reserve0, reserve1] = await pair.getReserves();

  if (reserve0.isZero() && reserve1.isZero()) {
    log('Adding liquidity to DEX pair...');
    await addLiquidityToPair({
      amount0: ethers.utils.parseEther('80000'),
      amount1: ethers.utils.parseUnits('100000', 6),
      token0: dividendToken,
      token1: usdcToken,
      userAddress: deployer,
      chainId,
    });
    log('Liquidity added!');
  }

  log('-----DEX pair deployed-----');
};

export default deployDexPair;

deployDexPair.tags = ['dexPair'];
