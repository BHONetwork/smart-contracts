import { expect } from 'chai';
import { ethers, waffle, deployments } from 'hardhat';
import { Contract, BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { latestBlockTimestamp, daysToSeconds } from '../../utils';

describe('TokenTimeLock', function () {
  let coinContract: Contract;
  let lockContract: Contract;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function () {
    await deployments.fixture(['token-time-lock', 'coin-bho']);
    [owner, addr1] = await ethers.getSigners();
    coinContract = await ethers.getContract('CoinBHO');
    lockContract = await ethers.getContract('TokenTimeLock');
    await coinContract.deployed();
    await lockContract.deployed();
  });

  describe('register new lock', function () {
    it('new lock should be stored successfully', async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        10,
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 20, 20, 20],
        await latestBlockTimestamp()
      );
      const [
        user,
        token,
        amount,
        releasedAmount,
        startDate,
        lockDurations,
        releasePercents,
        releaseDates,
        nextReleaseIdx,
      ] = await lockContract.lockData();

      expect(amount).to.equal(10);
      expect(lockDurations).to.deep.equal([
        daysToSeconds(1),
        daysToSeconds(2),
        daysToSeconds(3),
        daysToSeconds(4),
        daysToSeconds(5),
      ]);
      expect(releasePercents).to.deep.equal([20, 20, 20, 20, 20]);
      expect(nextReleaseIdx).to.equal(0);
      expect(releasedAmount).to.equal(0);
    });

    it('should revert when unlock percents and unlock dates length not match', async function () {
      await expect(
        lockContract.initialize(
          owner.address,
          addr1.address,
          coinContract.address,
          10,
          [
            daysToSeconds(1),
            daysToSeconds(2),
            daysToSeconds(3),
            daysToSeconds(4),
            daysToSeconds(5),
          ],
          [20, 20, 20, 20],
          await latestBlockTimestamp()
        )
      ).to.revertedWith('TokenTimeLock: unlock length not match');
    });

    it('should revert when total unlock percents not 100', async function () {
      await expect(
        lockContract.initialize(
          owner.address,
          addr1.address,
          coinContract.address,
          10,
          [
            daysToSeconds(1),
            daysToSeconds(2),
            daysToSeconds(3),
            daysToSeconds(4),
            daysToSeconds(5),
          ],
          [20, 20, 20, 20, 10],
          await latestBlockTimestamp()
        )
      ).to.revertedWith('TokenTimeLock: unlock percent not match 100');
    });

    it('should revert when call initialize() more than once', async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        10,
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 20, 20, 20],
        await latestBlockTimestamp()
      );

      await expect(
        lockContract.initialize(
          owner.address,
          addr1.address,
          coinContract.address,
          10,
          [
            daysToSeconds(1),
            daysToSeconds(2),
            daysToSeconds(3),
            daysToSeconds(4),
            daysToSeconds(5),
          ],
          [20, 20, 20, 20, 20],
          await latestBlockTimestamp()
        )
      ).to.reverted;
    });

    it('should set owner correctly when initialize()', async function () {
      await lockContract.initialize(
        addr1.address,
        addr1.address,
        coinContract.address,
        10,
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 20, 20, 20],
        await latestBlockTimestamp()
      );

      expect(await lockContract.owner()).to.equal(addr1.address);
    });
  });

  describe('release locked tokens', function () {
    it('should release locked tokens to correct user when unlock conditions are met', async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        BigNumber.from(100_000_000).mul(
          BigNumber.from(10).pow(BigNumber.from(await coinContract.decimals()))
        ),
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 10, 25, 25],
        await latestBlockTimestamp()
      );
      await coinContract.transfer(
        lockContract.address,
        BigNumber.from(100_000_000).mul(
          BigNumber.from(10).pow(BigNumber.from(await coinContract.decimals()))
        )
      );
      const decimals = await coinContract.decimals();

      // Release 1st phase
      ethers.provider.send('evm_increaseTime', [3600 * 24]);
      await lockContract.release();
      expect(await coinContract.balanceOf(addr1.address)).to.equal(
        BigNumber.from(20_000_000).mul(
          BigNumber.from(10).pow(BigNumber.from(decimals))
        )
      );

      // Release 2nd 3rd phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 2]);
      await lockContract.release();
      expect(await coinContract.balanceOf(addr1.address)).to.equal(
        BigNumber.from(50_000_000).mul(
          BigNumber.from(10).pow(BigNumber.from(decimals))
        )
      );

      // Release remaining phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 2]);
      await lockContract.release();
      expect(await coinContract.balanceOf(addr1.address)).to.equal(
        BigNumber.from(100_000_000).mul(
          BigNumber.from(10).pow(BigNumber.from(decimals))
        )
      );
    });

    it('should emit Release event with correct data', async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        100,
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 10, 25, 25],
        await latestBlockTimestamp()
      );

      await coinContract.transfer(lockContract.address, 100);

      const releaseDates = [
        (await latestBlockTimestamp()) + daysToSeconds(1),
        (await latestBlockTimestamp()) + daysToSeconds(5),
      ];

      // Move to 1st phase
      ethers.provider.send('evm_increaseTime', [3600 * 24]);
      await expect(lockContract.connect(addr1).release())
        .to.emit(lockContract, 'Released')
        .withArgs(20, 20, 0, 0, releaseDates[0]);

      // Move to last phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 4]);
      await expect(lockContract.connect(addr1).release())
        .to.emit(lockContract, 'Released')
        .withArgs(80, 100, 1, 4, releaseDates[1]);
    });

    it('should set release dates correct', async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        100,
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 10, 25, 25],
        await latestBlockTimestamp()
      );

      await coinContract.transfer(lockContract.address, 100);

      const originDate = await latestBlockTimestamp();
      const expectedReleaseDates = [
        originDate + daysToSeconds(1),
        originDate + daysToSeconds(5),
        originDate + daysToSeconds(5),
        originDate + daysToSeconds(5),
        originDate + daysToSeconds(5),
      ];

      // Move to 1st phase
      ethers.provider.send('evm_increaseTime', [3600 * 24]);
      await lockContract.connect(addr1).release();
      const [_1, _2, _3, _4, _5, _6, _7, releaseDates] =
        await lockContract.lockData();
      expect(releaseDates[0]).to.equal(expectedReleaseDates[0]);

      // Move to last phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 4]);
      await lockContract.connect(addr1).release();
      const [__1, __2, __3, __4, __5, __6, __7, releaseDates_2] =
        await lockContract.lockData();
      expect(releaseDates_2[0]).to.equal(expectedReleaseDates[0]);
      expect(releaseDates_2[1]).to.equal(expectedReleaseDates[1]);
      expect(releaseDates_2[2]).to.equal(expectedReleaseDates[2]);
      expect(releaseDates_2[3]).to.equal(expectedReleaseDates[3]);
      expect(releaseDates_2[4]).to.equal(expectedReleaseDates[4]);
    });

    it(`should revert when does not meet next unlock phase requirements`, async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        10,
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 10, 25, 25],
        await latestBlockTimestamp()
      );

      await coinContract.transfer(lockContract.address, 100);

      await expect(lockContract.connect(addr1).release()).to.be.revertedWith(
        'TokenTimeLock: next phase unavailable'
      );

      // Release 1st phase
      ethers.provider.send('evm_increaseTime', [3600 * 24]);
      await lockContract.connect(addr1).release();

      // Should revert if users try to release 2nd phase
      await expect(lockContract.connect(addr1).release()).to.be.revertedWith(
        'TokenTimeLock: next phase unavailable'
      );

      // Release 2nd, 3rd, 4th phase
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 3]);
      await lockContract.connect(addr1).release();

      // Should revert if users try to release 5th phase
      await expect(lockContract.connect(addr1).release()).to.be.revertedWith(
        'TokenTimeLock: next phase unavailable'
      );
    });

    it('should revert when all lock phases are released', async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        10,
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 10, 25, 25],
        await latestBlockTimestamp()
      );
      await coinContract.transfer(lockContract.address, 100);

      // Release all phases
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 5]);
      await lockContract.connect(addr1).release();

      await expect(lockContract.connect(addr1).release()).to.be.revertedWith(
        'TokenTimeLock: all phases are released'
      );
    });

    it('should revert when contract has insufficient balance to withdraw', async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        100,
        [
          daysToSeconds(1),
          daysToSeconds(2),
          daysToSeconds(3),
          daysToSeconds(4),
          daysToSeconds(5),
        ],
        [20, 20, 10, 25, 25],
        await latestBlockTimestamp()
      );
      await coinContract.transfer(lockContract.address, 50);
      // Release all phases
      ethers.provider.send('evm_increaseTime', [3600 * 24 * 5]);
      await expect(lockContract.connect(addr1).release()).to.be.revertedWith(
        'TokenTimeLock: insufficient balance'
      );
    });

    it('should safety release for owner only and transfers back to owner', async function () {
      await lockContract.initialize(
        owner.address,
        addr1.address,
        coinContract.address,
        100,
        [daysToSeconds(1)],
        [100],
        await latestBlockTimestamp()
      );

      const lockAmount = 100;
      await coinContract.transfer(lockContract.address, lockAmount);
      const ownerBalance = await coinContract.balanceOf(owner.address);

      await expect(lockContract.connect(addr1).safetyRelease()).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(lockContract.safetyRelease()).to.emit(
        lockContract,
        'SafetyReleaseActivated'
      );

      expect(await coinContract.balanceOf(owner.address)).to.equal(
        BigNumber.from(ownerBalance).add(lockAmount)
      );
    });
  });
});
