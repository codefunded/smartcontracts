import { loadFixture, mine, time } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { describe, test } from 'mocha';
import {
  GovernanceDividendTokenWrapper,
  GovernorContract,
  IERC20,
  MultiERC20WeightedLocker,
  TimelockController,
} from '../typechain-types';
import { prepareFullTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';

const VOTING_DELAY_IN_BLOCKS = 1;
const VOTING_PERIOD_IN_BLOCKS = 201600;
const PROPOSAL_THRESHOLD_IN_TOKENS = ethers.utils.parseEther('4');
const QUORUM_IN_TOKENS = ethers.utils.parseEther('750');

describe('DAO', () => {
  let micToken: IERC20;
  let timelock: TimelockController;
  let governor: GovernorContract;
  let locker: MultiERC20WeightedLocker;
  let governanceToken: GovernanceDividendTokenWrapper;

  before(async () => {
    const [user] = await ethers.getSigners();
    ({ governanceToken, locker, micToken } = await loadFixture(prepareFullTestEnv));
    const timelockFactory = await ethers.getContractFactory('TimelockController');
    timelock = await timelockFactory.deploy(
      100,
      [user.address],
      [user.address],
      user.address,
    );
    const governorFactory = await ethers.getContractFactory('GovernorContract');
    governor = await governorFactory.deploy(
      governanceToken.address,
      timelock.address,
      'TestDAO',
      VOTING_DELAY_IN_BLOCKS,
      VOTING_PERIOD_IN_BLOCKS,
      PROPOSAL_THRESHOLD_IN_TOKENS,
      QUORUM_IN_TOKENS,
    );

    await locker.transferOwnership(timelock.address);
  });

  test('should allow to propose, vote, queue and execute a proposal', async () => {
    const [, randomUser] = await ethers.getSigners();
    // get voting power
    await micToken.approve(locker.address, ethers.utils.parseEther('1000'));
    await locker.stake(0, 0, ethers.utils.parseEther('1000'), 0);

    // create proposal
    const addLockableAssetCalldata = locker.interface.encodeFunctionData(
      'addLockableAsset',
      [
        {
          token: governanceToken.address,
          dividendTokenFromPair: governanceToken.address,
          isEntitledToVote: true,
          isLPToken: false,
          lockPeriods: [
            {
              durationInSeconds: 0,
              rewardModifier: 10000,
            },
          ],
          priceOracle: ethers.constants.AddressZero,
        },
      ],
    );
    const proposalDescription = 'Proposal #1: add staking asset';
    const tx = await governor.propose(
      [locker.address],
      [0],
      [addLockableAssetCalldata],
      proposalDescription,
    );
    const receipt = await tx.wait();
    const propsalId: BigNumber = (receipt.events?.[0] as any).args.proposalId;

    // wait for voting delay to end
    await mine(2);

    // vote
    await governor.castVote(propsalId, 1);

    // wait for voting period to end
    await mine(201601);

    await timelock.grantRole(await timelock.PROPOSER_ROLE(), governor.address);
    await timelock.grantRole(await timelock.EXECUTOR_ROLE(), governor.address);

    // queue execution in timelock
    const descriptionHash = ethers.utils.id(proposalDescription);
    await governor
      .connect(randomUser) // anyone can enqueue successfully voted proposal
      .queue([locker.address], [0], [addLockableAssetCalldata], descriptionHash);

    // wait for timelock
    await time.increase(105);

    // execute a proposal
    await governor
      .connect(randomUser) // anyone can execute successfully voted proposal
      .execute([locker.address], [0], [addLockableAssetCalldata], descriptionHash);

    const addedLockableAsset = await locker.getLockableAsset(2);

    expect({
      token: addedLockableAsset.token,
      dividendTokenFromPair: addedLockableAsset.dividendTokenFromPair,
      isEntitledToVote: addedLockableAsset.isEntitledToVote,
      lockPeriods: addedLockableAsset.lockPeriods.map((lockPeriod) => ({
        durationInSeconds: lockPeriod.durationInSeconds,
        rewardModifier: lockPeriod.rewardModifier,
      })),
      isLPToken: addedLockableAsset.isLPToken,
      priceOracle: ethers.constants.AddressZero,
    }).to.be.deep.equal({
      token: governanceToken.address,
      dividendTokenFromPair: governanceToken.address,
      isEntitledToVote: true,
      isLPToken: false,
      lockPeriods: [
        {
          durationInSeconds: 0,
          rewardModifier: 10000,
        },
      ],
      priceOracle: ethers.constants.AddressZero,
    });
  });

  test('should not allow to enqueue a proposal that was voted against', async () => {
    const [, randomUser] = await ethers.getSigners();
    // get voting power
    await micToken.approve(locker.address, ethers.utils.parseEther('1000'));
    await locker.stake(0, 0, ethers.utils.parseEther('1000'), 0);

    // create proposal
    const addLockableAssetCalldata = locker.interface.encodeFunctionData(
      'addLockableAsset',
      [
        {
          token: governanceToken.address,
          dividendTokenFromPair: governanceToken.address,
          isEntitledToVote: true,
          isLPToken: false,
          lockPeriods: [
            {
              durationInSeconds: 0,
              rewardModifier: 10000,
            },
          ],
          priceOracle: ethers.constants.AddressZero,
        },
      ],
    );
    const proposalDescription = 'Proposal #2: add staking asset FAIL';
    const tx = await governor.propose(
      [locker.address],
      [0],
      [addLockableAssetCalldata],
      proposalDescription,
    );
    const receipt = await tx.wait();
    const propsalId: BigNumber = (receipt.events?.[0] as any).args.proposalId;

    // wait for voting delay to end
    await mine(2);

    // vote
    await governor.castVote(propsalId, 0);

    // wait for voting period to end
    await mine(201601);

    await timelock.grantRole(await timelock.PROPOSER_ROLE(), governor.address);
    await timelock.grantRole(await timelock.EXECUTOR_ROLE(), governor.address);

    // queue execution in timelock
    const descriptionHash = ethers.utils.id(proposalDescription);
    await expect(
      governor.queue([locker.address], [0], [addLockableAssetCalldata], descriptionHash),
    ).to.be.revertedWith('Governor: proposal not successful');
  });
});
