#!/usr/bin/env ts-node

import { spawnSync } from 'child_process';
import fs from 'fs/promises';

// due to the monroepo structure, we need to copy the openzeppelin contracts to the node_modules folder
// so that slither can find them

const copyOpenZeppelinContracts = async () =>
  fs.cp('../../node_modules/@openzeppelin/', './node_modules/@openzeppelin/', {
    recursive: true,
    force: true,
  });

async function main() {
  await copyOpenZeppelinContracts();

  spawnSync(
    'slither',
    [
      '.',
      '--solc-remaps',
      '"@openzeppelin=node_modules/@openzeppelin"',
      '--exclude-dependencies',
      // '--hardhat-ignore-compile',
    ],
    { stdio: 'inherit' },
  );
}
main();
