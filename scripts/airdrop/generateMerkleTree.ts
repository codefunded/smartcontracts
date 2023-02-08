import fs from 'fs/promises';
import path from 'path';
import { AirdropRecipient, generateMerkleTree } from '../../utils/generateMerkleTree';

const inputPath = path.join(__dirname, './airdropRecipients.json');
const outputPath = path.join(__dirname, './airdropMerkleTree.json');

async function getAirdropRecipients(): Promise<AirdropRecipient[]> {
  return fs.readFile(inputPath, 'utf8').then((data) => JSON.parse(data));
}

async function main() {
  const recipients = await getAirdropRecipients();

  const { merkleRoot, merkleTree } = await generateMerkleTree(recipients);

  await fs.writeFile(
    outputPath,
    JSON.stringify({
      root: merkleRoot,
      tree: merkleTree,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
