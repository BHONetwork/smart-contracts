import { expect } from 'chai';
import type { Contract } from 'ethers';
import { ethers } from 'hardhat';

const { BigNumber } = ethers;

describe('CoinBHO', () => {
  let coinContract: Contract;

  before(async () => {
    const CoinBHO = await ethers.getContractFactory('CoinBHO');
    coinContract = await CoinBHO.deploy();
    await coinContract.deployed();
  });

  it('Should have 18 decimals', async () => {
    expect(await coinContract.decimals()).to.equal(18);
  });

  it('Should have 10B total supply', async () => {
    expect(await coinContract.totalSupply()).to.equal(
      BigNumber.from(10_000_000_000).mul(BigNumber.from(10).pow(18))
    );
  });

  it('Should have total supply in owner address', async () => {
    const [owner] = await ethers.getSigners();

    expect(await coinContract.totalSupply()).to.equal(
      await coinContract.balanceOf(owner.address)
    );
  });
});
