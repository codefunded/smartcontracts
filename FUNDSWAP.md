# FundSwap

FundSwap is a decentralized spot OTC (over-the-counter) exchange for ERC-20 tokens compatible with EVM chains.
This solution is targeted for projects that don't have the money required to create a reasonable liquidity pool for classic DEX like Uniswap, but they still want to give their users a way to exchange tokens peer-to-peer in a permissionless way, without a need of intermediaries.

FundSwap consists of a set of smart contracts that allow for settlements on-chain and a webpage interface.


## How it works

The logic behind exchange is divided into two contracts: `FundSwap.sol` and `FundSwapOrderManager.sol`. FundSwap is an actual exchange where all the mutations happen i.e., creating an order, filling an existing order or cancelling an order. FundSwapOrderManager is an ERC-721 contract and each NFT represents a single order containing all the data specific for a particular order.
