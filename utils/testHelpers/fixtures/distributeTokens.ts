import { ethers } from 'hardhat';
import { USDC_ADDRESS, USDC_WHALE } from '../../networkConfigs';

const ONE_THOUSAND = ethers.utils.parseUnits('1000', 'ether');

export async function distributeTokens() {
  const [user1, user2] = await ethers.getSigners();
  const micTokenFactory = await ethers.getContractFactory('DividendToken');
  const micToken = await micTokenFactory.deploy(
    'MIC',
    'MIC',
    ethers.utils.parseEther('10000000'),
  );
  const micTokenPermit = await ethers.getContractAt('ERC20Permit', micToken.address);
  const usdcToken = await ethers.getContractAt('IERC20', USDC_ADDRESS);

  await micToken.transfer(user2.address, ONE_THOUSAND);
  const usdcWhale = await ethers.getImpersonatedSigner(USDC_WHALE);
  await usdcToken
    .connect(usdcWhale)
    .transfer(user1.address, ethers.utils.parseUnits('1000', 6));
  await usdcToken
    .connect(usdcWhale)
    .transfer(user2.address, ethers.utils.parseUnits('1000', 6));

  return {
    micToken,
    micTokenPermit,
    usdcToken,
  };
}
