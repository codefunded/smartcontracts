import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getNetworkConfig } from '../utils/networkConfigs';
import { verifyContract } from '../utils/verifyContract';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';

const deployOracle: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, get, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  const networkConfig = getNetworkConfig(chainId);

  const dexPairAddress = (await get('DexPair')).address;

  const twapOracleDeployment = await deploy('UniswapV2TwapOracle', {
    from: deployer,
    args: [
      networkConfig.existingContracts.gelatoAutomate!,
      dexPairAddress,
      time.duration.hours(6),
    ],
    waitConfirmations: networkConfig.confirmations,
    log: true,
  });
  if (networkConfig.shouldVerifyContracts) {
    await verifyContract(twapOracleDeployment.address, twapOracleDeployment.args!);
  }

  const oracle = await ethers.getContractAt(
    'UniswapV2TwapOracle',
    twapOracleDeployment.address,
  );

  const oracleBalance = await oracle.provider.getBalance(oracle.address);
  if (oracleBalance.isZero()) {
    log('Oracle has no balance. Funding it with 0.5 ether...');
    const deployerWallet = await ethers.getSigner(deployer);
    await (
      await deployerWallet.sendTransaction({
        to: twapOracleDeployment.address,
        value: ethers.utils.parseEther('0.5'),
      })
    ).wait(networkConfig.confirmations);
  }

  const oracleTaskId = await oracle.automationTaskId();
  if (oracleTaskId === ethers.constants.HashZero) {
    log('Starting automation...');
    const tx = await oracle.createTask();
    const receipt = await tx.wait(networkConfig.confirmations);
    log(
      `Started automation with task ID: ${
        receipt.events?.find((x) => x.args?.taskId)?.args?.taskId
      }`,
    );
  } else {
    log(`Automation already started with task ID: ${oracleTaskId}`);
  }

  log('-----TWAP Oracle deployed-----');
};

export default deployOracle;

deployOracle.tags = ['oracle'];
