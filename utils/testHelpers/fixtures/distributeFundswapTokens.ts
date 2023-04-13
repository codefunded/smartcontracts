import { ethers } from 'hardhat';

const ONE_THOUSAND = ethers.utils.parseUnits('1000', 'ether');

export async function distributeFundswapTokens() {
  const [user1, user2] = await ethers.getSigners();
  const tokenFactory = await ethers.getContractFactory('MockERC20');
  const erc20Token = await tokenFactory.deploy(
    'Mock ERC20 Token',
    'MET',
    ethers.utils.parseEther('10000000'),
  );
  await erc20Token.transfer(user2.address, ONE_THOUSAND);

  const usdcFactory = await ethers.getContractFactory('MockUSDC');
  const usdcToken = await usdcFactory.deploy();
  await usdcToken.mint(user1.address, ethers.utils.parseUnits('2000', 6));
  await usdcToken.transfer(user2.address, ethers.utils.parseUnits('1000', 6));

  const wmaticToken = await tokenFactory.deploy(
    'Wrapped Matic',
    'WMATIC',
    ethers.utils.parseEther('10000000'),
  );
  await wmaticToken.transfer(user2.address, ONE_THOUSAND);

  return {
    erc20Token,
    usdcToken,
    wmaticToken,
  };
}
