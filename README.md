# Staking Ecosystem Contracts

These contracts allow the dividend token holders to lock and stake the dividend
tokens in the ecosystem and receive multiple rewards paid out in periods of
variable length. Rewards can be paid out in any ERC-20 token.
Additionally, stakers receive voting power for the respective amount of staked
tokens.

# Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`POLYGON_MAINNET_RPC`

`POLYGON_MUMBAI_RPC`

`PRIVATE_KEY` - deployer account private key

`PRIVATE_KEY_2`

`POLYGONSCAN_API_KEY` - used for verifying the contracts' source code

# Running Tests

To run tests, run the following command

```bash
  yarn test
```

# Run Locally

Install dependencies

```bash
  yarn
```

Run local fork of polygon mainnet

```bash
  yarn hh:node
```

# Deployment

To deploy this project run

```bash
  npx hardhat deploy --network [network_name]
```

# Contracts Architecture Overview

Main contracts are:

- DividendToken
- MultiERC20WeightedLocker
- GovernanceToken
- Staking

## Main contracts

### DividendToken

A standard ERC-20 token which will be locked inside MultiERC20WeightedLocker
and staked in staking contract.

### MultiERC20WeightedLocker

This contract is responsible for locking tokens and managing staking positions
in staking contract on behalf of users. It also holds all the locked tokens and
mints the respective amount of governance token.

### GovernanceToken

A non-transferable ERC-20 Token that is distributed proportionally to the amount of
locked dividend tokens and the length of lock period.

### Staking

The Staking contract is responsible for calculating the rewards for each user
and it also holds all the reward tokens.

## Periphery contracts

### PeriodStarter

An automation contract that is using Gelato Automate in order to monitor
the staking contract and trigger a new rewards period whenever the previous one ends.

### StaleDepositLiquidator

An automation contract that is using Gelato Automate in order to monitor
the MultiERC20WeightedLocker contract and liquidate the stale deposits, i.e., deposits
which lock period has ended. This is done in order to preserve the fair rewards
distribution. If someone locks their tokens for a year, the system will give such user
a boost to the rewards amount in order to make up for the illiquidity of user's funds.
If the lock period is finished, user can withdraw their funds at any given moment so
this deposited tokens should no longer be eligible to the rewards boost.

### VestingWallet

This contract handles the vesting of any ERC20 tokens for the team.
Tokens will be released to the beneficiary following a linear vesting schedule.

### MerkleClaimableAirdrop

This contract is responsible for distributing the ERC-20 token to the community based
on the Merkle tree root containing information about users that are eligible
to receiving the airdrop. It works with any ERC-20 token and does not have a deadline
specified for when the airdrop finishes.
