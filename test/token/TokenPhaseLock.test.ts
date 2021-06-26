import { expect } from 'chai';
import { ethers, waffle, deployments } from 'hardhat';
import { Contract, BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';

const now = async () => {
  return (await ethers.provider.getBlock('latest')).timestamp;
};

// const setupTest = deployments.createFixture(async ({deployments, getNamedAccounts, ethers}, options) => {
//   await deployments.fixture(); // ensure you start from a fresh deployments
//   const { tokenOwner } = await getNamedAccounts();
//   const TokenContract = await ethers.getContract("Token", tokenOwner);
//   await TokenContract.mint(10).then(tx => tx.wait()); //this mint is executed once and then `createFixture` will ensure it is snapshotted
//   return {
//     tokenOwner: {
//       address: tokenOwner,
//       TokenContract
//     }
//   };
// };

describe('TokenPhaseLock', function () {
  let coinContract: Contract;
  let lockContract: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function () {
    await deployments.fixture(['TokenPhaseLock']);
    [owner, addr1] = await ethers.getSigners();
    coinContract = await ethers.getContract('CoinBHO');
    lockContract = await ethers.getContract('TokenPhaseLock');
  });

  describe('register new lock', function () {
    it('new lock should be stored successfully', async function () {
      await lockContract.registerNewLock(
        owner.address,
        '1',
        10,
        [1, 2, 3, 4, 5],
        [20, 20, 20, 20, 20],
        await now()
      );
      const [
        lockId,
        amount,
        widthdrawnAmount,
        unlockDates,
        unlockPercents,
        startTimestamp,
        nextUnlockIdx,
        alreadyExists,
      ] = await lockContract.getLock(owner.address, '1');

      expect(lockId).to.equal('1');
      expect(amount).to.equal(10);
      expect(unlockDates).to.deep.equal([1, 2, 3, 4, 5]);
      expect(unlockPercents).to.deep.equal([20, 20, 20, 20, 20]);
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
        [20, 20, 20, 20, 20],
        await now()
      );
      await expect(
        lockContract.registerNewLock(
          owner.address,
          '1',
          5,
          [1, 2, 3, 4, 5],
          [20, 20, 20, 20, 20],
          await now()
        )
      ).to.be.revertedWith('TokenPhaseLock: dup lock id');
    });

    it('should revert when unlock percents and unlock dates length not match', async function () {
      await expect(
        lockContract.registerNewLock(
          owner.address,
          '1',
          10,
          [2, 3, 4, 5],
          [20, 20, 20, 20, 20],
          await now()
        )
      ).to.revertedWith('TokenPhaseLock: unlock length not match');
    });

    it('should revert when total unlock percents not 100', async function () {
      await expect(
        lockContract.registerNewLock(
          owner.address,
          '1',
          10,
          [1, 2, 3, 4, 5],
          [20, 20, 20, 20, 50],
          await now()
        )
      ).to.revertedWith('TokenPhaseLock: unlock percent not match 100');
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
            [20, 20, 20, 20, 20],
            await now()
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
        [20, 20, 10, 25, 25],
        await now()
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
        'TokenPhaseLock: lock not exists'
      );
    });

    it(`should revert when does not meet next unlock phase requirements`, async function () {
      await lockContract.registerNewLock(
        addr1.address,
        '1',
        100,
        [1, 2, 3, 4, 5],
        [20, 20, 10, 25, 25],
        await now()
      );
      await coinContract.transfer(lockContract.address, 100);

      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: next phase unavailable'
      );

      // Release 1st phase
      ethers.provider.send('evm_increaseTime', [3600 * 24]);
      await lockContract.connect(addr1).release('1');

      // Should revert if users try to release 2nd phase
      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: next phase unavailable'
      );

      // Release 2nd, 3rd, 4th phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 3]);
      await lockContract.connect(addr1).release('1');

      // Should revert if users try to release 5th phase
      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: next phase unavailable'
      );
    });

    it('should revert when all lock phases are released', async function () {
      await lockContract.registerNewLock(
        addr1.address,
        '1',
        100,
        [1, 2, 3, 4, 5],
        [20, 20, 20, 20, 20],
        await now()
      );
      await coinContract.transfer(lockContract.address, 100);

      // Release all phases
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 5]);
      await lockContract.connect(addr1).release('1');

      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: all phases are released'
      );
    });

    it('should revert when contract has insufficient balance to withdraw', async function () {
      await lockContract.registerNewLock(
        addr1.address,
        '1',
        100,
        [1, 2, 3, 4, 5],
        [20, 20, 20, 20, 20],
        await now()
      );
      await coinContract.transfer(lockContract.address, 50);
      // Release all phases
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 5]);
      await expect(lockContract.connect(addr1).release('1')).to.be.revertedWith(
        'TokenPhaseLock: insufficient balance'
      );
    });
  });
});
