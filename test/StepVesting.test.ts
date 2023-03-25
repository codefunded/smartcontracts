import { ethers } from 'hardhat';
import { expect } from 'chai';
import { DividendToken, StepVestingWallet } from '../typechain-types';
import { prepareFullTestEnv } from '../utils/testHelpers/fixtures/prepareTestEnv';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('StepVestingWallet', () => {
  let micToken: DividendToken;
  let vestingWallet: StepVestingWallet;
  let owner: SignerWithAddress;
  let beneficiary1: SignerWithAddress;
  let beneficiary2: SignerWithAddress;

  beforeEach(async () => {
    ({ micToken, vestingWallet } = await loadFixture(prepareFullTestEnv));

    [owner] = await ethers.getSigners();
    [beneficiary1, beneficiary2] = await Promise.all([
      ethers.getImpersonatedSigner(ethers.Wallet.createRandom().address),
      ethers.getImpersonatedSigner(ethers.Wallet.createRandom().address),
    ]);
    await Promise.all([
      owner.sendTransaction({
        to: beneficiary1.address,
        value: ethers.utils.parseEther('1'),
      }),
      owner.sendTransaction({
        to: beneficiary2.address,
        value: ethers.utils.parseEther('1'),
      }),
    ]);

    await micToken
      .connect(owner)
      .approve(vestingWallet.address, ethers.utils.parseEther('1000000'));
  });

  describe('constructor', () => {
    it('should set the correct initial values', async () => {
      expect(await vestingWallet.token()).to.equal(micToken.address);
      expect(await vestingWallet.cliff()).to.equal(time.duration.days(18 * 30)); // 18 months
    });
  });

  describe('setBeneficiary', () => {
    it('should set the amount of tokens eligible to be claimed for a given beneficiary', async () => {
      await micToken.transfer(vestingWallet.address, ethers.utils.parseEther('1000'));
      await expect(
        vestingWallet
          .connect(owner)
          .setBeneficiary(beneficiary1.address, ethers.utils.parseEther('1000')),
      )
        .to.emit(vestingWallet, 'BeneficiaryAdded')
        .withArgs(beneficiary1.address, ethers.utils.parseEther('1000'));

      expect(
        await vestingWallet.getBeneficiaryAllVestedAmount(beneficiary1.address),
      ).to.equal(ethers.utils.parseEther('1000'));
      expect(await micToken.balanceOf(vestingWallet.address)).to.equal(
        ethers.utils.parseEther('1000'),
      );
    });

    it('should revert if the sender is not the owner', async () => {
      await expect(
        vestingWallet
          .connect(beneficiary1)
          .setBeneficiary(beneficiary2.address, ethers.utils.parseEther('500')),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should revert when beneficiary reward is overwritten', async () => {
      await micToken.transfer(vestingWallet.address, ethers.utils.parseEther('1000'));
      await vestingWallet
        .connect(owner)
        .setBeneficiary(beneficiary1.address, ethers.utils.parseEther('1000'));

      await expect(
        vestingWallet
          .connect(owner)
          .setBeneficiary(beneficiary1.address, ethers.utils.parseEther('500')),
      ).to.be.revertedWith('Beneficiary already exists');
    });
  });

  describe('setBeneficiaries', () => {
    it('should allow owner to set multiple beneficiaries', async () => {
      await micToken.transfer(
        vestingWallet.address,
        ethers.utils.parseEther('100').mul(2),
      );
      await micToken
        .connect(owner)
        .approve(vestingWallet.address, ethers.utils.parseEther('100').mul(2));

      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const amounts = [ethers.utils.parseEther('100'), ethers.utils.parseEther('100')];

      await vestingWallet.connect(owner).setBeneficiaries(beneficiaries, amounts);

      const balance = await micToken.balanceOf(vestingWallet.address);
      expect(balance.toString()).to.be.equal(
        ethers.utils.parseEther('100').mul(2).toString(),
      );

      const beneficiary1Balance = await vestingWallet.getBeneficiaryAllVestedAmount(
        beneficiary1.address,
      );
      expect(beneficiary1Balance.toString()).to.be.equal(
        ethers.utils.parseEther('100').toString(),
      );

      const beneficiary2Balance = await vestingWallet.getBeneficiaryAllVestedAmount(
        beneficiary2.address,
      );
      expect(beneficiary2Balance.toString()).to.be.equal(
        ethers.utils.parseEther('100').toString(),
      );
    });

    it('should not allow non-owners to set multiple beneficiaries', async () => {
      await micToken
        .connect(beneficiary1)
        .approve(vestingWallet.address, ethers.utils.parseEther('100').mul(2));

      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const amounts = [ethers.utils.parseEther('100'), ethers.utils.parseEther('100')];

      await expect(
        vestingWallet.connect(beneficiary1).setBeneficiaries(beneficiaries, amounts),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should revert if arrays have different lengths', async () => {
      const beneficiaries = [beneficiary1.address, beneficiary2.address];
      const amounts = [ethers.utils.parseEther('100')];

      expect(
        vestingWallet.connect(owner).setBeneficiaries(beneficiaries, amounts),
      ).to.be.revertedWith('Arrays must have the same length');
    });
  });

  describe('claim', () => {
    it('should revert if not a beneficiary', async () => {
      await expect(vestingWallet.connect(owner).claim()).to.be.revertedWith(
        'Not a beneficiary',
      );
    });

    it('should revert if vesting period not started (before cliff)', async () => {
      const beneficiaryAddress = await beneficiary1.getAddress();

      await vestingWallet.connect(owner).setBeneficiary(beneficiaryAddress, 100);

      await expect(vestingWallet.connect(beneficiary1).claim()).to.be.revertedWith(
        'Vesting period not started',
      );
    });

    it('should be able to claim 1/10 tokens reward right after the cliff', async () => {
      const beneficiaryAddress = await beneficiary1.getAddress();

      await micToken.transfer(vestingWallet.address, 100);
      await vestingWallet.connect(owner).setBeneficiary(beneficiaryAddress, 100);

      // Move time forward to cliff
      time.increase(time.duration.days(18 * 30));

      // Verify expected token balance before claiming
      const expectedBalance = await micToken.balanceOf(beneficiaryAddress);
      expect(expectedBalance).to.equal(0);

      // Claim tokens
      await expect(vestingWallet.connect(beneficiary1).claim())
        .to.emit(vestingWallet, 'TokensClaimed')
        .withArgs(beneficiaryAddress, 10);

      // Verify expected token balance after claiming
      const actualBalance = await micToken.balanceOf(beneficiaryAddress);
      expect(actualBalance).to.equal(10);
    });

    it('should be able to claim 2/10 tokens reward year after the cliff', async () => {
      const beneficiaryAddress = await beneficiary1.getAddress();

      await micToken.transfer(vestingWallet.address, 100);
      await vestingWallet.connect(owner).setBeneficiary(beneficiaryAddress, 100);

      // Move time forward to cliff
      time.increase(time.duration.days(18 * 30 + 365));

      // Verify expected token balance before claiming
      const expectedBalance = await micToken.balanceOf(beneficiaryAddress);
      expect(expectedBalance).to.equal(0);

      // Claim tokens
      await expect(vestingWallet.connect(beneficiary1).claim())
        .to.emit(vestingWallet, 'TokensClaimed')
        .withArgs(beneficiaryAddress, 20);

      // Verify expected token balance after claiming
      const actualBalance = await micToken.balanceOf(beneficiaryAddress);
      expect(actualBalance).to.equal(20);
    });

    it('should claim remaining tokens after vesting period ends', async () => {
      const beneficiaryAddress = await beneficiary1.getAddress();

      await micToken.transfer(vestingWallet.address, 100);
      await vestingWallet.connect(owner).setBeneficiary(beneficiaryAddress, 100);

      // Move time forward to vesting end
      time.increase(time.duration.days(18 * 31 + 365 * 9));

      // Verify expected token balance before claiming
      const expectedBalance = await micToken.balanceOf(beneficiaryAddress);
      expect(expectedBalance).to.equal(0);

      // Claim tokens
      await expect(vestingWallet.connect(beneficiary1).claim())
        .to.emit(vestingWallet, 'TokensClaimed')
        .withArgs(beneficiaryAddress, 100);

      // Verify expected token balance after claiming
      const actualBalance = await micToken.balanceOf(beneficiaryAddress);
      expect(actualBalance).to.equal(100);
    });

    it('should not be able to claim tokens twice in the same year', async () => {
      const beneficiaryAddress = await beneficiary1.getAddress();

      await micToken.transfer(vestingWallet.address, 100);
      await vestingWallet.connect(owner).setBeneficiary(beneficiaryAddress, 100);

      // Move time forward to cliff + 1 year
      time.increase(time.duration.days(18 * 30 + 365));

      // Verify expected token balance before claiming
      const expectedBalance = await micToken.balanceOf(beneficiaryAddress);
      expect(expectedBalance).to.equal(0);

      // Claim tokens
      await expect(vestingWallet.connect(beneficiary1).claim())
        .to.emit(vestingWallet, 'TokensClaimed')
        .withArgs(beneficiaryAddress, 20);

      // Verify expected token balance after claiming
      const actualBalance = await micToken.balanceOf(beneficiaryAddress);
      expect(actualBalance).to.equal(20);

      // Try to claim tokens again in the same year
      await expect(vestingWallet.connect(beneficiary1).claim()).to.be.revertedWith(
        'All pending tokens claimed',
      );

      time.increase(time.duration.days(365));

      // Try to claim tokens again in the next year
      await vestingWallet.connect(beneficiary1).claim();
      const balanceAfterSecondYear = await micToken.balanceOf(beneficiaryAddress);
      expect(balanceAfterSecondYear).to.equal(30);
    });
  });

  describe('rescue', () => {
    it('should allow owner to rescue tokens', async () => {
      await micToken.transfer(vestingWallet.address, 100);

      const expectedBalance = await micToken.balanceOf(vestingWallet.address);
      expect(expectedBalance).to.equal(100);

      await expect(vestingWallet.connect(owner).rescueTokens(100))
        .to.emit(vestingWallet, 'TokensRescued')
        .withArgs(100);

      const actualBalance = await micToken.balanceOf(vestingWallet.address);
      expect(actualBalance).to.equal(0);
    });

    it('should revert if not owner', async () => {
      await expect(
        vestingWallet.connect(beneficiary1).rescueTokens(micToken.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
