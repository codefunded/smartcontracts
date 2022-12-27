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

  const stakedDividendTokenAddress = await get('MultiERC20WeightedLocker');

  const timelockDeployment = await deploy('TimeLock', {
    from: deployer,
    args: [1, [], []],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(timelockDeployment.address, timelockDeployment.args!);
  }

  const VOTING_DELAY_IN_BLOCKS = 1;
  const VOTING_PERIOD_IN_BLOCKS = 201600;
  const PROPOSAL_THRESHOLD_IN_TOKENS = ethers.utils.parseEther('1000');
  const QUORUM_IN_TOKENS = ethers.utils.parseEther('100000');

  const governorDeployment = await deploy('GovernorContract', {
    from: deployer,
    args: [
      stakedDividendTokenAddress.address,
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
  const adminRole = await timelockContract.TIMELOCK_ADMIN_ROLE();

  (await timelockContract.grantRole(proposerRole, governorDeployment.address)).wait(
    networkConfig.confirmations,
  );
  (await timelockContract.grantRole(executorRole, ethers.constants.AddressZero)).wait(
    networkConfig.confirmations,
  );
  (await timelockContract.revokeRole(adminRole, deployer)).wait(
    networkConfig.confirmations,
  );

  log('-----DAO deployed-----');
};

export default deployDAO;
