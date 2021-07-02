import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import type { Contract, ContractFactory } from 'ethers';
import { ethers, deployments } from 'hardhat';

const { BigNumber } = ethers;

describe('CoinBHO', () => {
  let coinContract: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async () => {
    await deployments.fixture(['coin-bho']);
    [owner, addr1, addr2] = await ethers.getSigners();
    [owner, addr1] = await ethers.getSigners();
    coinContract = await ethers.getContract('CoinBHO');
    await coinContract.deployed();
  });

  describe('Deployment', function () {
    it('Should have 18 decimals', async () => {
      expect(await coinContract.decimals()).to.equal(18);
    });

    it('Should have 10B total supply', async () => {
      expect(await coinContract.totalSupply()).to.equal(
        BigNumber.from(10_000_000_000).mul(BigNumber.from(10).pow(18))
      );
    });

    it('Should set the right owner', async function () {
      expect(await coinContract.owner()).to.equal(owner.address);
    });

    it('Should assign the total supply of tokens to the owner', async function () {
      const ownerBalance = await coinContract.balanceOf(owner.address);
      expect(await coinContract.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe('Transactions', function () {
    it('Should transfer tokens between accounts', async function () {
      // Transfer 50 tokens from owner to addr1
      await coinContract.transfer(addr1.address, 50);
      const addr1Balance = await coinContract.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);

      // Transfer 50 tokens from addr1 to addr2
      // We use .connect(signer) to send a transaction from another account
      await coinContract.connect(addr1).transfer(addr2.address, 50);
      const addr2Balance = await coinContract.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(50);
    });

    it('Should fail if sender doesn’t have enough tokens', async function () {
      const initialOwnerBalance = await coinContract.balanceOf(owner.address);

      // Try to send 1 token from addr1 (0 tokens) to owner (1000 tokens).
      // `require` will evaluate false and revert the transaction.
      await expect(coinContract.connect(addr1).transfer(owner.address, 1)).to.be
        .reverted;

      // Owner balance shouldn't have changed.
      expect(await coinContract.balanceOf(owner.address)).to.equal(
        initialOwnerBalance
      );
    });

    it('Should update balances after transfers', async function () {
      const initialOwnerBalance = await coinContract.balanceOf(owner.address);

      // Transfer 100 tokens from owner to addr1.
      await coinContract.transfer(addr1.address, 100);

      // Transfer another 50 tokens from owner to addr2.
      await coinContract.transfer(addr2.address, 50);

      // Check balances.
      const finalOwnerBalance = await coinContract.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(
        BigNumber.from(initialOwnerBalance).sub(150)
      );

      const addr1Balance = await coinContract.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(100);

      const addr2Balance = await coinContract.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(50);
    });

    it('should reduce total supply when burn', async function () {
      const initialOwnerBalance = await coinContract.balanceOf(owner.address);
      const burnAmount = 1_000_000_000;
      await coinContract.burn(burnAmount);
      const totalSupply = await coinContract.totalSupply();
      expect(totalSupply).to.equal(
        BigNumber.from(initialOwnerBalance).sub(burnAmount)
      );
    });

    it('should revert when burn amount exceeds balance', async function () {
      const initialOwnerBalance = await coinContract.balanceOf(owner.address);
      const burnAmount = BigNumber.from(initialOwnerBalance).add(1_000_000);
      await expect(coinContract.burn(burnAmount)).to.revertedWith(
        'BEP20: burn amount exceeds balance'
      );
    });

    it('should revert when burnFrom amount exceeds allowance', async function () {
      await coinContract.approve(addr1.address, 100);
      await expect(coinContract.connect(addr1).burnFrom(owner.address, 200)).to
        .reverted;
    });

    it('should burnFrom really burn tokens, reduce allowance, reduce total supply', async function () {
      const burnAmount = 100;
      await coinContract.approve(addr1.address, burnAmount);
      const ownerBalance = await coinContract.balanceOf(owner.address);

      await coinContract.connect(addr1).burnFrom(owner.address, burnAmount);
      expect(
        await coinContract.allowance(owner.address, addr1.address)
      ).to.equal(0);
      expect(await coinContract.balanceOf(owner.address)).to.equal(
        BigNumber.from(ownerBalance).sub(burnAmount)
      );
      expect(await coinContract.totalSupply()).to.equal(
        BigNumber.from(ownerBalance).sub(burnAmount)
      );
    });

    it('should increase total supply when mint', async function () {
      const initialOwnerBalance = await coinContract.balanceOf(owner.address);
      const mintAmount = 1_000_000_000;
      await coinContract.mint(mintAmount);
      const totalSupply = await coinContract.totalSupply();
      expect(totalSupply).to.equal(
        BigNumber.from(initialOwnerBalance).add(mintAmount)
      );
    });

    it('should revert when minting from stranger', async function () {
      const mintAmount = 1_000_000_000;
      await expect(
        coinContract.connect(addr1).mint(mintAmount)
      ).to.revertedWith('Ownable: caller is not the owner');
    });
  });
});
