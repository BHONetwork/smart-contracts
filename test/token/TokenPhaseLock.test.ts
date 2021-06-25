import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';
import { Contract, BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';

describe('TokenPhaseLock', function () {
  let coinContract: Contract;
  let lockContract: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const coinFactory = await ethers.getContractFactory('CoinBHO');
    const lockFactory = await ethers.getContractFactory('TokenPhaseLock');
    coinContract = await coinFactory.deploy();
    await coinContract.deployed();
    lockContract = await lockFactory.deploy(coinContract.address);
    await lockContract.deployed();
  });

  describe('register new lock', function () {
    it('new lock should be stored successfully', async function () {
      await lockContract.registerNewLock(
        owner.address,
        '1',
        10,
        [1, 2, 3, 4, 5],
        [20, 20, 20, 20, 20]
      );
      const [
        lockId,
        amount,
        startTimestamp,
        unlockDates,
        unlockPercents,
        nextUnlockIdx,
        widthdrawnAmount,
        alreadyExists,
      ] = await lockContract.getLock('1');

      expect(lockId).to.equal('1');
      expect(amount).to.equal(10);
      expect(unlockDates).to.deep.equal([
        BigNumber.from(1),
        BigNumber.from(2),
        BigNumber.from(3),
        BigNumber.from(4),
        BigNumber.from(5),
      ]);
      expect(unlockPercents).to.deep.equal([
        BigNumber.from(20),
        BigNumber.from(20),
        BigNumber.from(20),
        BigNumber.from(20),
        BigNumber.from(20),
      ]);
      expect(nextUnlockIdx).to.equal(0);
      expect(widthdrawnAmount).to.equal(0);
      expect(alreadyExists).to.equal(true);
    });

    it('should revert when lock id duplicates', async function () {
      await lockContract.registerNewLock(
        owner.address,
        '1',
        10,
        [1, 2, 3, 4, 5],
        [20, 20, 20, 20, 20]
      );
      await expect(
        lockContract.registerNewLock(
          owner.address,
          '1',
          5,
          [1, 2, 3, 4, 5],
          [20, 20, 20, 20, 20]
        )
      ).to.be.revertedWith('TokenPhaseLock: Duplicated Lock Id');
    });

    it('should revert when unlock percents and unlock dates length not match', async function () {
      await expect(
        lockContract.registerNewLock(
          owner.address,
          '1',
          10,
          [2, 3, 4, 5],
          [20, 20, 20, 20, 20]
        )
      ).to.revertedWith(
        'TokenPhaseLock: Unlock Dates and Unlock Percents length not match'
      );
    });

    it('should revert when total unlock percents not 100', async function () {
      await expect(
        lockContract.registerNewLock(
          owner.address,
          '1',
          10,
          [1, 2, 3, 4, 5],
          [20, 20, 20, 20, 50]
        )
      ).to.revertedWith('TokenPhaseLock: Total Unlock Percents is not 100');
    });

    it('should revert if called from not owner', async function () {
      await expect(
        lockContract
          .connect(addr1)
          .registerNewLock(
            owner.address,
            '1',
            10,
            [1, 2, 3, 4, 5],
            [20, 20, 20, 20, 20]
          )
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('release locked tokens', function () {
    it('should release locked tokens to user when unlock conditions are met', async function () {
      await lockContract.registerNewLock(
        addr1.address,
        '1',
        100,
        [1, 2, 3, 4, 5],
        [20, 20, 10, 25, 25]
      );
      await coinContract.transfer(lockContract.address, 100);

      // Release 1st phase
      ethers.provider.send('evm_increaseTime', [3600 * 24]);
      await lockContract.connect(addr1).release('1');
      expect(await coinContract.balanceOf(addr1.address)).to.equal(20);

      // Release 2nd 3rd phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 2]);
      await lockContract.connect(addr1).release('1');
      expect(await coinContract.balanceOf(addr1.address)).to.equal(50);

      // Release remaining phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 2]);
      await lockContract.connect(addr1).release('1');
      expect(await coinContract.balanceOf(addr1.address)).to.equal(100);
    });

    it('should revert when attempt to release not existed lock', async function () {
      await expect(lockContract.release('1')).to.be.revertedWith(
        "TokenPhaseLock: Can't withdraw tokens from a lock that doesn't exists"
      );
    });

    it(`should revert when does not meet next unlock phase requirements`, async function () {
      await lockContract.registerNewLock(
        addr1.address,
        '1',
        100,
        [1, 2, 3, 4, 5],
        [20, 20, 10, 25, 25]
      );
      await coinContract.transfer(lockContract.address, 100);

      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: Not meet next unlock requirements'
      );

      // Release 1st phase
      ethers.provider.send('evm_increaseTime', [3600 * 24]);
      await lockContract.connect(addr1).release('1');

      // Should revert if users try to release 2nd phase
      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: Not meet next unlock requirements'
      );

      // Release 2nd, 3rd, 4th phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 3]);
      await lockContract.connect(addr1).release('1');

      // Should revert if users try to release 5th phase
      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: Not meet next unlock requirements'
      );
    });

    it('should revert when all lock phases are released', async function () {
      await lockContract.registerNewLock(
        addr1.address,
        '1',
        100,
        [1, 2, 3, 4, 5],
        [20, 20, 20, 20, 20]
      );
      await coinContract.transfer(lockContract.address, 100);

      // Release all phases
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 5]);
      await lockContract.connect(addr1).release('1');

      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: All lock phases are released'
      );
    });

    it('should revert when contract has insufficient balance to withdraw', async function () {
      await lockContract.registerNewLock(
        addr1.address,
        '1',
        100,
        [1, 2, 3, 4, 5],
        [20, 20, 20, 20, 20]
      );
      await coinContract.transfer(lockContract.address, 50);
      // Release all phases
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 5]);
      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: Insufficient balance to withdraw'
      );
    });
  });
});
