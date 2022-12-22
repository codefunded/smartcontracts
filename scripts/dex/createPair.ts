import { createDexPair } from '../../utils/createDexPair';

async function main() {
  const { TOKEN0, TOKEN1, PAIR_FACTORY_CREATOR } = process.env;

  if (!TOKEN0 || !TOKEN1 || !PAIR_FACTORY_CREATOR) {
    throw new Error('Missing required environment variables');
  }

  const address = await createDexPair({
    token0: TOKEN0,
    token1: TOKEN1,
    pairFactoryCreator: PAIR_FACTORY_CREATOR,
  });

  console.log(`Created pair for ${TOKEN0} and ${TOKEN1} at ${address}`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
