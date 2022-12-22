import { expect } from 'chai';
import { ethers } from 'hardhat';
import { test } from 'mocha';

describe('NonTransferableToken contract', async () => {
  test('should not allow to transfer tokens', async () => {
    const [user1, user2] = await ethers.getSigners();

    const nonTransferableTokenFactory = await ethers.getContractFactory(
      'GovernanceDividendTokenWrapper',
    );
    const nonTransferableToken = await nonTransferableTokenFactory.deploy('test', 'test');

    await nonTransferableToken.mint(user2.address, ethers.utils.parseEther('100'));

    await expect(
      nonTransferableToken
        .connect(user2)
        .transfer(user1.address, ethers.utils.parseEther('100')),
    ).to.be.revertedWithCustomError(
      nonTransferableToken,
      'NonTransferableToken__TransferIsNotAllowed',
    );
  });
  
  test('should not allow to call transferFrom', async () => {
    const [user1, user2] = await ethers.getSigners();

    const nonTransferableTokenFactory = await ethers.getContractFactory(
      'GovernanceDividendTokenWrapper',
    );
    const nonTransferableToken = await nonTransferableTokenFactory.deploy('test', 'test');

    await nonTransferableToken.mint(user2.address, ethers.utils.parseEther('100'));

    await nonTransferableToken
      .connect(user2)
      .approve(user1.address, ethers.utils.parseEther('100'));

    await expect(
      nonTransferableToken.transferFrom(
        user2.address,
        user1.address,
        ethers.utils.parseEther('100'),
      ),
    ).to.be.revertedWithCustomError(
      nonTransferableToken,
      'NonTransferableToken__TransferIsNotAllowed',
    );
  });

  test('should allow to burn', async () => {
    const [user1] = await ethers.getSigners();

    const nonTransferableTokenFactory = await ethers.getContractFactory(
      'GovernanceDividendTokenWrapper',
    );
    const nonTransferableToken = await nonTransferableTokenFactory.deploy('test', 'test');

    await nonTransferableToken.mint(user1.address, ethers.utils.parseEther('100'));

    await nonTransferableToken.burn(user1.address, ethers.utils.parseEther('99'));

    await expect(await nonTransferableToken.balanceOf(user1.address)).to.eq(ethers.utils.parseEther('1'));
  });
});
