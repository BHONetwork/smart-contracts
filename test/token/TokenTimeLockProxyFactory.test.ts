import { expect } from 'chai';
import { ethers, waffle, deployments } from 'hardhat';
import {
  Contract,
  BigNumber,
  ContractFactory,
  ContractTransaction,
} from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { EthUtils } from '../../utils';

describe('TokenTimeLockProxyFactory', async function () {
  let lockProxyFactoryContract: Contract;
  let lockContract: Contract;
  let coinContract: Contract;
  let owner: SignerWithAddress;

  beforeEach(async function () {
    await deployments.fixture([
      'token-time-lock',
      'token-time-lock-proxy-factory',
      'coin-bho',
    ]);
    [owner] = await ethers.getSigners();
    lockProxyFactoryContract = await ethers.getContract(
      'TokenTimeLockProxyFactory'
    );
    lockContract = await ethers.getContract('TokenTimeLock');
    coinContract = await ethers.getContract('CoinBHO');
    await lockContract.deployed();
    await coinContract.deployed();
  });

  describe('create proxy', async function () {
    it('should revert if implementation address do not have initialize()', async function () {
      await expect(
        lockProxyFactoryContract.createProxy(
          owner.address,
          ethers.constants.AddressZero,
          owner.address,
          coinContract.address,
          100,
          [60, 120],
          [50, 50],
          await EthUtils.latestBlockTimestamp()
        )
      ).to.reverted;
    });

    it('should revert if supplied parameters are invalid lock settings', async function () {
      await expect(
        lockProxyFactoryContract.createProxy(
          owner.address,
          lockContract.address,
          owner.address,
          coinContract.address,
          100,
          [60, 120],
          [50],
          await EthUtils.latestBlockTimestamp()
        )
      ).to.reverted;
    });

    it('should emit event ProxyCreated with correct parameters', async function () {
      await expect(
        lockProxyFactoryContract.createProxy(
          owner.address,
          lockContract.address,
          owner.address,
          coinContract.address,
          100,
          [60, 120],
          [50, 50],
          await EthUtils.latestBlockTimestamp()
        )
      ).to.emit(lockProxyFactoryContract, 'ProxyCreated');
    });

    it('should owner of proxy is correct', async function () {
      const proxyAddr = await getProxyAddr(
        lockProxyFactoryContract,
        owner.address,
        lockContract.address,
        owner.address,
        coinContract.address,
        100,
        [60, 120],
        [50, 50],
        await EthUtils.latestBlockTimestamp()
      );
      const proxyContract = lockContract.attach(proxyAddr);

      expect(await proxyContract.owner()).to.equal(owner.address);
    });
  });

  describe('interact with proxy once created', async function () {
    it('should return correct lock state', async function () {
      const proxyAddr = await getProxyAddr(
        lockProxyFactoryContract,
        owner.address,
        lockContract.address,
        owner.address,
        coinContract.address,
        100,
        [60, 120],
        [50, 50],
        await EthUtils.latestBlockTimestamp()
      );
      const proxyContract = lockContract.attach(proxyAddr);

      await shouldLockStateCorrect(
        proxyContract,
        owner.address,
        coinContract.address,
        100,
        0,
        [60, 120],
        [50, 50],
        0
      );
    });

    it('two proxies should have different lock state', async function () {
      // First proxy
      const proxyAddr1 = await getProxyAddr(
        lockProxyFactoryContract,
        owner.address,
        lockContract.address,
        owner.address,
        coinContract.address,
        100,
        [60, 120],
        [50, 50],
        await EthUtils.latestBlockTimestamp()
      );

      // Second proxy
      const proxyAddr2 = await getProxyAddr(
        lockProxyFactoryContract,
        owner.address,
        lockContract.address,
        owner.address,
        coinContract.address,
        120,
        [50, 100],
        [60, 40],
        await EthUtils.latestBlockTimestamp()
      );

      const proxyContract1 = lockContract.attach(proxyAddr1);
      const proxyContract2 = lockContract.attach(proxyAddr2);

      // First proxy assertion
      await shouldLockStateCorrect(
        proxyContract1,
        owner.address,
        coinContract.address,
        100,
        0,
        [60, 120],
        [50, 50],
        0
      );

      // Second proxy assertion
      await shouldLockStateCorrect(
        proxyContract2,
        owner.address,
        coinContract.address,
        120,
        0,
        [50, 100],
        [60, 40],
        0
      );
    });
  });
});

async function shouldLockStateCorrect(
  lockContract: Contract,
  userAddr: string,
  tokenAddr: string,
  amount: number,
  releaseAmount: number,
  lockDuration: number[],
  releasePercents: number[],
  nextReleaseIdx: number
) {
  const [
    _user,
    _token,
    _amount,
    _releasedAmount,
    _startDate,
    _lockDurations,
    _releasePercents,
    _releaseDates,
    _nextReleaseIdx,
  ] = await lockContract.functions.lockData();

  expect(_user).to.equal(userAddr);
  expect(_token).to.equal(tokenAddr);
  expect(_amount).to.equal(amount);
  expect(_releasedAmount).to.equal(releaseAmount);
  expect(_lockDurations).deep.equal(lockDuration);
  expect(_releasePercents).deep.equal(releasePercents);
  expect(_nextReleaseIdx).to.equal(nextReleaseIdx);
}

async function getProxyAddr(
  factoryContract: Contract,
  ownerAddr: string,
  lockContractAddr: string,
  userAddr: string,
  coinContractAddr: string,
  amount: number,
  lockDurations: number[],
  releasePercents: number[],
  startDate: number
): Promise<string> {
  const tx: ContractTransaction = await factoryContract.createProxy(
    ownerAddr,
    lockContractAddr,
    userAddr,
    coinContractAddr,
    amount,
    lockDurations,
    releasePercents,
    startDate
  );
  const receipt = await tx.wait();
  const [event] = receipt.events!.filter((evt) => evt.event === 'ProxyCreated');
  const [proxyAddr1] = event?.args!;

  return proxyAddr1;
}
