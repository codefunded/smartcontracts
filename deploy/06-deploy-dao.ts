import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { ethers } from 'hardhat';

const deployDAO: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, get, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const stakedDividendToken = await get('MultiERC20WeightedLocker');
  const timelockDeployment = await get('TimeLock');

  const VOTING_DELAY_IN_BLOCKS = 1;
  const VOTING_PERIOD_IN_BLOCKS = 201600;
  const PROPOSAL_THRESHOLD_IN_TOKENS = ethers.utils.parseEther('1000');
  const QUORUM_IN_TOKENS = ethers.utils.parseEther('100000');

  const governorDeployment = await deploy('GovernorContract', {
    from: deployer,
    args: [
      stakedDividendToken.address,
      timelockDeployment.address,
      'MilkyIce Governance',
      VOTING_DELAY_IN_BLOCKS,
      VOTING_PERIOD_IN_BLOCKS,
      PROPOSAL_THRESHOLD_IN_TOKENS,
      QUORUM_IN_TOKENS,
    ],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(governorDeployment.address, governorDeployment.args!);
  }

  const timelockContract = await ethers.getContractAt(
    'TimeLock',
    timelockDeployment.address,
  );

  const executorRole = await timelockContract.EXECUTOR_ROLE();
  const proposerRole = await timelockContract.PROPOSER_ROLE();

  const hasProposerRole = await timelockContract.hasRole(
    proposerRole,
    governorDeployment.address,
  );
  if (!hasProposerRole) {
    log('Granting proposerRole to governor');
    await (
      await timelockContract.grantRole(proposerRole, governorDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  const hasExecutorRole = await timelockContract.hasRole(
    executorRole,
    governorDeployment.address,
  );
  if (!hasExecutorRole) {
    log('Granting executorRole to governor');
    await (
      await timelockContract.grantRole(executorRole, governorDeployment.address)
    ).wait(networkConfig.confirmations);
  }

  log('-----DAO deployed-----');
};

export default deployDAO;

deployDAO.tags = ['dao'];
