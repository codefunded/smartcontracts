import { deployFundSwap } from './deployFundSwap';
import { distributeFundswapTokens } from './distributeFundswapTokens';

export const prepareFundswapTestEnv = async () => {
  const { fundSwap, fundSwapOrderManager } = await deployFundSwap();
  const { erc20Token, usdcToken, wmaticToken } = await distributeFundswapTokens();

  await Promise.all([
    fundSwap.addTokenToWhitelist(erc20Token.address),
    fundSwap.addTokenToWhitelist(usdcToken.address),
    fundSwap.addTokenToWhitelist(wmaticToken.address),
  ]);

  return {
    fundSwap,
    fundSwapOrderManager,
    erc20Token,
    usdcToken,
    wmaticToken,
  };
};
