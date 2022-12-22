import MerkleTree from 'merkletreejs';
import { keccak256, solidityKeccak256 } from 'ethers/lib/utils';

export function generateLeaf(address: string, value: string): Buffer {
  return Buffer.from(
    solidityKeccak256(['address', 'uint256'], [address, value]).slice(2),
    'hex',
  );
}

export async function generateMerkleTree(
  recipients: {
    address: string;
    value: string;
  }[],
): Promise<{
  merkleRoot: string;
  merkleTree: MerkleTree;
}> {
  const merkleTree = new MerkleTree(
    recipients.map(({ address, value }) => generateLeaf(address, value)),
    keccak256,
    { sortPairs: true },
  );

  const merkleRoot: string = merkleTree.getHexRoot();

  return {
    merkleRoot,
    merkleTree,
  };
}
