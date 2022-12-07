import { deployMintStakingContract } from './deployMintStakingContract';
import { deployStakingContract } from './deployStakingContract';
import { distributeTokens } from './distributeTokens';

export const prepareTestEnv = async () => {
  const { micToken, micTokenPermit, usdcToken, wethToken } = await distributeTokens();
  const { stakingContract } = await deployStakingContract(micToken, usdcToken);
  const { mintStakingContract, iceToken } = await deployMintStakingContract(micToken);
  return {
    stakingContract,
    micToken,
    micTokenPermit,
    usdcToken,
    wethToken,
    mintStakingContract,
    iceToken,
  };
};
