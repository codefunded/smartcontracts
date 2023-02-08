import MerkleTree from 'merkletreejs';
import { keccak256, solidityKeccak256 } from 'ethers/lib/utils';

export function generateLeaf({
  address,
  amount,
  rewardAmount,
}: AirdropRecipient): Buffer {
  return Buffer.from(
    solidityKeccak256(
      ['address', 'uint256', 'uint256'],
      [address, amount, rewardAmount],
    ).slice(2),
    'hex',
  );
}

export type AirdropRecipient = { address: string; amount: string; rewardAmount: string };

export async function generateMerkleTree(recipients: AirdropRecipient[]): Promise<{
  merkleRoot: string;
  merkleTree: MerkleTree;
}> {
  const merkleTree = new MerkleTree(recipients.map(generateLeaf), keccak256, {
    sortPairs: true,
  });

  const merkleRoot: string = merkleTree.getHexRoot();

  return {
    merkleRoot,
    merkleTree,
  };
}
