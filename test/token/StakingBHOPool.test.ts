import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import type { Contract, ContractFactory } from 'ethers';
import { ethers, deployments, getNamedAccounts } from 'hardhat';
import { EthUtils } from '../../utils';
import { BigNumber } from '@ethersproject/bignumber';

async function ensureEnterStaking(
  user: string,
  amount: BigNumber,
  programId: number,
  expectedStakingId: number
) {
  const poolContract = await ethers.getContract('StakingBHOPool', user);
  const coinContract = await ethers.getContract('CoinBHO', user);

  await coinContract.approve(poolContract.address, amount);

  await expect(poolContract.enterStaking(programId, amount))
    .to.emit(poolContract, 'EnterStaking')
    .withArgs(user, amount, expectedStakingId);

  expect(await coinContract.balanceOf(user)).to.eq(
    EthUtils.expandDecimals(0, 18)
  );
  expect(await coinContract.balanceOf(poolContract.address)).to.eq(amount);

  const stakingInfo = await poolContract.stakingInfo(user, expectedStakingId);
  expect(stakingInfo.isWithdrawn).to.eq(false);
  expect(stakingInfo.isExist).to.eq(true);
}

async function ensureLeaveStaking(
  user: string,
  amount: BigNumber,
  stakingId: number,
  expectedReward: BigNumber
) {
  const poolContract = await ethers.getContract('StakingBHOPool', user);
  const coinContract = await ethers.getContract('CoinBHO', user);
  await expect(poolContract.leaveStaking(stakingId))
    .to.emit(poolContract, 'LeaveStaking')
    .withArgs(user, expectedReward, amount.add(expectedReward), stakingId);

  expect(await coinContract.balanceOf(user)).to.equal(
    amount.add(expectedReward)
  );
  expect(await coinContract.balanceOf(poolContract.address)).to.equal(
    BigNumber.from(0)
  );

  const stakingInfo = await poolContract.stakingInfo(user, stakingId);
  expect(stakingInfo.isWithdrawn).to.eq(true);
  expect(stakingInfo.isExist).to.eq(true);
}

async function ensureEmergencyWithdraw(
  admin: string,
  user: string,
  amount: BigNumber,
  stakingId: number
) {
  const poolContract = await ethers.getContract('StakingBHOPool', admin);
  const coinContract = await ethers.getContract('CoinBHO', admin);
  await expect(poolContract.emergencyWithdraw(user, 0))
    .to.emit(poolContract, 'EmergencyWithdraw')
    .withArgs(admin, user, amount, stakingId);
  expect(await coinContract.balanceOf(user)).to.eq(amount);
  expect(await coinContract.balanceOf(poolContract.address)).to.eq(0);

  const stakingInfo = await poolContract.stakingInfo(user, stakingId);
  expect(stakingInfo.isWithdrawn).to.eq(true);
  expect(stakingInfo.isExist).to.eq(true);
}

describe('StakingBHOPool', function () {
  let deployer: string;
  let feeCollector: string;
  let defaultAdmin: string;
  let alice: string;

  beforeEach(async () => {
    await deployments.fixture(['staking-bho-pool', 'coin-bho-v2']);
    ({ deployer, feeCollector, defaultAdmin, alice } =
      await getNamedAccounts());
    const poolContract = await ethers.getContract('StakingBHOPool');
    const coinContract = await ethers.getContract('CoinBHO', deployer);

    // Alice got 100k BHO
    await coinContract.transfer(alice, EthUtils.expandDecimals(100_000, 18));

    // Set blocktimestamp to 25/09/2021 1AM
    await EthUtils.setNextBlockTimestamp(1632531600);
  });

  describe('Register program', function () {
    it('should revert when sender is not authorized', async function () {
      const poolContract = await ethers.getContract('StakingBHOPool', alice);
      await expect(
        poolContract.registerProgram(5000, [1641088922])
      ).to.revertedWith('Staking: program author role required');
    });

    it('should revert when interestDates is invalid', async function () {
      const poolContract = await ethers.getContract(
        'StakingBHOPool',
        defaultAdmin
      );
      await expect(poolContract.registerProgram(5000, [])).to.revertedWith(
        'Staking: invalid program interest dates'
      );
    });

    it('should works when given inputs are valid', async function () {
      const poolContract = await ethers.getContract(
        'StakingBHOPool',
        defaultAdmin
      );
      await expect(poolContract.registerProgram(5000, [1641088922, 1641090000]))
        .to.emit(poolContract, 'RegisterProgram')
        .withArgs(defaultAdmin, 2);
      const programInfo = await poolContract.programInfo(2);
      expect(programInfo.interestDates).to.deep.eq([
        BigNumber.from(1641088922),
        BigNumber.from(1641090000),
      ]);
      expect(programInfo.apy).to.eq(5000);
      expect(programInfo.isExist).to.eq(true);
    });
  });

  describe('Enter staking', function () {
    it('should revert when program not exists', async function () {
      const poolContract = await ethers.getContract('StakingBHOPool', alice);
      await expect(poolContract.enterStaking(2, 10_000)).to.be.revertedWith(
        'Staking: program not exists'
      );
    });

    it('should revert when staking program is expired', async function () {
      // Set block timestamp to 02/01/2022
      await EthUtils.setNextBlockTimestamp(1641088922);

      const poolContract = await ethers.getContract('StakingBHOPool', alice);
      await expect(poolContract.enterStaking(1, 10_000)).to.be.revertedWith(
        'Staking: program is over'
      );
    });

    it(`should revert when user's approved balance for staking contract is insufficient`, async function () {
      const poolContract = await ethers.getContract('StakingBHOPool', alice);
      await expect(poolContract.enterStaking(1, 10_000)).to.be.revertedWith(
        'BEP20: transfer amount exceeds allowance'
      );
    });

    it(`should revert when user's balance is insufficient`, async function () {
      const poolContract = await ethers.getContract('StakingBHOPool', alice);
      const coinContract = await ethers.getContract('CoinBHO', alice);

      await coinContract.approve(
        poolContract.address,
        EthUtils.expandDecimals(200_000, 18)
      );

      await expect(
        poolContract.enterStaking(1, EthUtils.expandDecimals(200_000, 18))
      ).to.be.revertedWith('BEP20: transfer amount exceeds balance');
    });

    it(`should work when give inputs are valid`, async function () {
      const stakingAmount = EthUtils.expandDecimals(100_000, 18);
      await ensureEnterStaking(alice, stakingAmount, 1, 0);
    });
  });

  describe('Leave staking', async function () {
    it('should revert when staking id not exists', async function () {
      const stakingAmount = EthUtils.expandDecimals(100_000, 18);
      await ensureEnterStaking(alice, stakingAmount, 1, 0);
      const poolContract = await ethers.getContract('StakingBHOPool', alice);
      await expect(poolContract.leaveStaking(1)).to.revertedWith(
        'Staking: staking not exists'
      );
    });

    it('should revert when interest date not coming yet', async function () {
      const stakingAmount = EthUtils.expandDecimals(100_000, 18);
      await ensureEnterStaking(alice, stakingAmount, 1, 0);
      const poolContract = await ethers.getContract('StakingBHOPool', alice);
      await expect(poolContract.leaveStaking(0)).to.revertedWith(
        'Staking: invalid withdraw date'
      );
    });

    it('should work for cases when users stake within 24 hours before interest date', async function () {
      // Staking at 30/09/2021 14h
      await EthUtils.setNextBlockTimestamp(1633010400);
      const stakingAmount = EthUtils.expandDecimals(100_000, 18);
      await ensureEnterStaking(alice, stakingAmount, 1, 0);
      const poolContract = await ethers.getContract('StakingBHOPool', alice);

      // Withdraw at 01/10/2021 13h
      await EthUtils.setNextBlockTimestamp(1633093200);
      await expect(poolContract.leaveStaking(0)).to.revertedWith(
        'Staking: withrawal required 24 hours'
      );

      // Withdraw at 01/10/2021 15h
      await EthUtils.setNextBlockTimestamp(1633100400);
      await ensureLeaveStaking(
        alice,
        stakingAmount,
        0,
        stakingAmount.mul(3000).div(BigNumber.from(10_000).mul(365))
      );
    });

    it('should receive correct reward', async function () {
      const stakingAmount = EthUtils.expandDecimals(100_000, 18);
      await ensureEnterStaking(alice, stakingAmount, 1, 0);

      // Leave staking at 01/10/2021 1h
      // So reward should be 5 days from 25/09/2021 1h with apy 30
      await EthUtils.setNextBlockTimestamp(1633050000);
      const reward = stakingAmount
        .mul(3000)
        .mul(5)
        .div(BigNumber.from(10_000).mul(365));
      await ensureLeaveStaking(alice, stakingAmount, 0, reward);
    });

    it('should revert when attempt to withdraw already withdrawn staking', async function () {
      const stakingAmount = EthUtils.expandDecimals(100_000, 18);
      await ensureEnterStaking(alice, stakingAmount, 1, 0);
      const poolContract = await ethers.getContract('StakingBHOPool', alice);

      // Leave staking at 01/10/2021 1h
      // So reward should be 5 days with apy 30
      await EthUtils.setNextBlockTimestamp(1633050000);
      await ensureLeaveStaking(
        alice,
        stakingAmount,
        0,
        stakingAmount.mul(3000).mul(5).div(BigNumber.from(10_000).mul(365))
      );

      await expect(poolContract.leaveStaking(0)).to.revertedWith(
        'Staking: already withdrawn'
      );
    });
  });

  describe('Emergency withdraw', async function () {
    it('should revert if not called from emergency role', async function () {
      const poolContract = await ethers.getContract('StakingBHOPool', alice);
      await expect(poolContract.emergencyWithdraw(alice, 0)).to.revertedWith(
        'Staking: emergency role required'
      );
    });

    it('should revert if staking not exists', async function () {
      const poolContract = await ethers.getContract(
        'StakingBHOPool',
        defaultAdmin
      );
      await expect(poolContract.emergencyWithdraw(alice, 0)).to.revertedWith(
        'Staking: staking not exists'
      );
    });

    it('should revert if already withdrawn', async function () {
      const stakingAmount = EthUtils.expandDecimals(100_000, 18);
      await ensureEnterStaking(alice, stakingAmount, 1, 0);
      const poolContract = await ethers.getContract(
        'StakingBHOPool',
        defaultAdmin
      );

      // Leave staking at 01/10/2021 1h
      // So reward should be 5 days with apy 30
      await EthUtils.setNextBlockTimestamp(1633050000);
      await ensureLeaveStaking(
        alice,
        stakingAmount,
        0,
        stakingAmount.mul(3000).mul(5).div(BigNumber.from(10_000).mul(365))
      );

      await expect(poolContract.emergencyWithdraw(alice, 0)).to.revertedWith(
        'Staking: already withdrawn'
      );
    });

    it('should work if given inputs are valid', async function () {
      const stakingAmount = EthUtils.expandDecimals(100_000, 18);
      await ensureEnterStaking(alice, stakingAmount, 1, 0);
      const poolContract = await ethers.getContract(
        'StakingBHOPool',
        defaultAdmin
      );
      await ensureEmergencyWithdraw(defaultAdmin, alice, stakingAmount, 0);
    });
  });
});
