import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import { ethers, deployments, getNamedAccounts } from 'hardhat';
import { connect } from 'http2';
import { Contract, BigNumber } from 'ethers';
import {
  TransactionReceipt,
  TransactionResponse,
} from '@ethersproject/abstract-provider';
import exp from 'constants';

describe('Bridge', async () => {
  let coinContract: Contract;
  let bridgeContract: Contract;
  let deployer: SignerWithAddress;
  let bridgeAdmin: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let decimals: number;
  const toAddress =
    '0x05416460deb76d57af601be17e777b93592d8d4d4a4096c57876a91c84f4a712';
  const serviceFee = ethers.BigNumber.from('1000000000000000');
  const platformFee = ethers.BigNumber.from('1000000000000000');

  beforeEach(async () => {
    await deployments.fixture(['bridge']);
    const {
      deployer: _deployer,
      bridgeAdmin: _bridgeAdmin,
      alice: _alice,
      bob: _bob,
    } = await getNamedAccounts();
    deployer = await ethers.getSigner(_deployer);
    bridgeAdmin = await ethers.getSigner(_bridgeAdmin);
    alice = await ethers.getSigner(_alice);
    bob = await ethers.getSigner(_bob);
    coinContract = await ethers.getContract('CoinBHO');
    bridgeContract = await ethers.getContract('Bridge');
    await coinContract.deployed();
    await bridgeContract.deployed();
    decimals = await coinContract.decimals();
  });

  describe('Transaction', function () {
    it('Initiate transfer without sending service fee should revert', async () => {
      // Transfer 50 tokens from owner to alice
      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);
      const decimals = await coinContract.decimals();
      const transferAmount = BigNumber.from(10).mul(
        BigNumber.from(10).pow(decimals)
      );
      await expect(
        bridgeContract.initiateTransfer(toAddress, transferAmount, 0)
      ).to.revertedWith('Missing service fee');
    });

    it('Initiate transfer without approve should revert', async () => {
      // Transfer 50 tokens from owner to alice
      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);
      const decimals = await coinContract.decimals();
      const transferAmount = BigNumber.from(10).mul(
        BigNumber.from(10).pow(decimals)
      );
      await expect(
        bridgeContract.initiateTransfer(toAddress, transferAmount, 0, {
          value: serviceFee,
        })
      ).to.revertedWith('BEP20: transfer amount exceeds allowance');
    });

    it('Initiate transfer with insufficient balance should revert', async () => {
      // Transfer 50 tokens from owner to alice
      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);
      const decimals = await coinContract.decimals();
      const transferAmount = BigNumber.from(10).mul(
        BigNumber.from(10).pow(decimals)
      );
      await expect(
        bridgeContract
          .connect(alice)
          .initiateTransfer(toAddress, transferAmount, 0, {
            value: serviceFee,
          })
      ).to.revertedWith('BEP20: transfer amount exceeds balance');
    });

    it('Initiate transfer with unregistered chain should revert', async () => {
      // Transfer 50 tokens from owner to alice
      const decimals = await coinContract.decimals();
      const transferAmount = BigNumber.from(10).mul(
        BigNumber.from(10).pow(decimals)
      );
      await expect(
        bridgeContract
          .connect(alice)
          .initiateTransfer(toAddress, transferAmount, 0, {
            value: serviceFee,
          })
      ).to.revertedWith('Unsupported chain');
    });

    it('Initiate transfer with amount less than minimum deposit should revert', async () => {
      const decimals = await coinContract.decimals();
      const approveAmount = BigNumber.from(100_000_000).mul(
        BigNumber.from(10).pow(decimals)
      );

      const transferAmount = BigNumber.from(10);

      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);

      await coinContract.approve(bridgeContract.address, approveAmount);

      await expect(
        bridgeContract
          .connect(alice)
          .initiateTransfer(toAddress, transferAmount, 0, { value: serviceFee })
      ).to.revertedWith('Minimum amount required');
    });

    it('Initiate transfer with frozen bridge should revert', async () => {
      const decimals = await coinContract.decimals();
      const approveAmount = BigNumber.from(100_000_000).mul(
        BigNumber.from(10).pow(decimals)
      );

      const transferAmount = BigNumber.from(10);

      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);

      await coinContract.approve(bridgeContract.address, approveAmount);

      await bridgeContract.connect(bridgeAdmin).forceFreeze();

      await expect(
        bridgeContract
          .connect(alice)
          .initiateTransfer(toAddress, transferAmount, 0, { value: serviceFee })
      ).to.revertedWith('Bridge is frozen by admin');
    });

    it('Initiate transfer should work', async () => {
      const fee = serviceFee.add(platformFee);
      // Transfer 50 tokens from owner to alice
      const decimals = await coinContract.decimals();
      const approveAmount = BigNumber.from(100_000_000_000_000).mul(
        BigNumber.from(10).pow(decimals)
      );

      const transferAmount = BigNumber.from(10).mul(
        BigNumber.from(10).pow(decimals)
      );
      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);
      await bridgeContract
        .connect(bridgeAdmin)
        .forceSetPlatformFee(platformFee);

      await coinContract.approve(bridgeContract.address, approveAmount);
      const beforeBridgeCoinBalance = await coinContract.balanceOf(
        bridgeContract.address
      );
      const beforeBridgeNativeBalance: BigNumber =
        await ethers.provider.getBalance(bridgeContract.address);
      const beforeUserCoinBalance: BigNumber = await coinContract.balanceOf(
        deployer.getAddress()
      );
      const beforeUserNativeBalance: BigNumber =
        await bridgeContract.getBalance(deployer.address);

      const result: Promise<TransactionResponse> = bridgeContract
        .connect(deployer)
        .initiateTransfer(toAddress, transferAmount, 0, {
          value: fee,
        });
      await expect(result)
        .to.emit(bridgeContract, 'TransferInitiated')
        .withArgs(
          BigNumber.from(0),
          deployer.address,
          toAddress,
          transferAmount,
          0
        );

      const txReceipt = await (await result).wait();
      const gasFee = txReceipt.gasUsed.mul(await ethers.provider.getGasPrice());

      const afterBridgeCoinBalance = await coinContract.balanceOf(
        bridgeContract.address
      );
      const afterBridgeNativeBalance: BigNumber =
        await ethers.provider.getBalance(bridgeContract.address);
      const afterUserCoinBalance = await coinContract.balanceOf(
        deployer.address
      );
      const afterUserNativeBalance: BigNumber = await bridgeContract.getBalance(
        deployer.address
      );

      expect(afterBridgeCoinBalance).to.equal(
        transferAmount.add(beforeBridgeCoinBalance)
      );
      expect(afterUserCoinBalance).to.equal(
        beforeUserCoinBalance.sub(transferAmount)
      );
      expect(afterBridgeNativeBalance).to.equal(
        beforeBridgeNativeBalance.add(fee)
      );
      expect(afterUserNativeBalance).to.equal(
        beforeUserNativeBalance.sub(fee).sub(gasFee)
      );

      expect(await bridgeContract.nextOutboundTransferId()).to.eq(1);

      const transferInfo = await bridgeContract.outboundTransfers(0);
      expect(transferInfo.amount).to.eq(transferAmount);
      expect(transferInfo.from).to.eq(deployer.address);
      expect(transferInfo.to).to.eq(toAddress);
      expect(transferInfo.serviceFee).to.eq(fee);
      expect(transferInfo.targetChain).to.eq(0);
      expect(transferInfo.isExist).to.eq(true);
    });

    it('Register relayer not by admin should revert', async () => {
      await expect(
        bridgeContract.connect(alice).forceRegisterRelayer(alice.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Register relayer should work', async () => {
      await bridgeContract
        .connect(bridgeAdmin)
        .forceRegisterRelayer(alice.address);

      expect(await bridgeContract.relayers(alice.address)).to.eq(true);
    });

    it('Unregister relayer not by admin should revert', async () => {
      await expect(
        bridgeContract.connect(alice).forceUnregisterRelayer(alice.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Unregister relayer should work', async () => {
      await bridgeContract
        .connect(bridgeAdmin)
        .forceRegisterRelayer(alice.address);

      await bridgeContract
        .connect(bridgeAdmin)
        .forceUnregisterRelayer(alice.address);

      expect(await bridgeContract.relayers(alice.address)).to.eq(false);
    });

    it('Register chain not by admin should revert', async () => {
      await expect(
        bridgeContract.connect(alice).forceRegisterChain(0)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Register chain should work', async () => {
      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);
      expect(await bridgeContract.chains(0)).to.eq(true);
    });

    it('Unregister chain not by admin should revert', async () => {
      await expect(
        bridgeContract.connect(alice).forceUnregisterChain(0)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Unregister chain should work', async () => {
      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);

      await bridgeContract.connect(bridgeAdmin).forceUnregisterChain(0);
      expect(await bridgeContract.chains(0)).to.eq(false);
    });

    it('confirm transfer by unregistered relayer should revert', async () => {
      await expect(
        bridgeContract.connect(alice).confirmTransfer(0)
      ).to.be.revertedWith('Caller is not the registered relayer');
    });

    it('confirm transfer with invalid transfer_id should revert', async () => {
      const transferAmount = ethers.BigNumber.from('10').mul(
        BigNumber.from(10).pow(decimals)
      );
      await bridgeContract
        .connect(bridgeAdmin)
        .forceRegisterRelayer(alice.address);
      await coinContract
        .connect(deployer)
        .approve(bridgeContract.address, transferAmount);

      await expect(
        bridgeContract.connect(alice).confirmTransfer(0)
      ).to.revertedWith('All transfers are confirmed');

      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);

      await bridgeContract.initiateTransfer(toAddress, transferAmount, 0, {
        value: serviceFee,
      });

      await expect(
        bridgeContract.connect(alice).confirmTransfer(1)
      ).to.revertedWith('Invalid transfer id');
    });

    it('confirm transfer with frozen bridge should revert', async () => {
      await bridgeContract.connect(bridgeAdmin).forceFreeze();
      await bridgeContract
        .connect(bridgeAdmin)
        .forceRegisterRelayer(alice.address);
      await expect(
        bridgeContract.connect(alice).confirmTransfer(0)
      ).to.be.revertedWith('Bridge is frozen by admin');
    });

    it('confirm transfer should work', async () => {
      const transferAmount = ethers.BigNumber.from('10').mul(
        BigNumber.from(10).pow(decimals)
      );

      await bridgeContract
        .connect(bridgeAdmin)
        .forceRegisterRelayer(alice.address);
      await coinContract
        .connect(deployer)
        .approve(bridgeContract.address, transferAmount);

      await bridgeContract.connect(bridgeAdmin).forceRegisterChain(0);

      await bridgeContract.initiateTransfer(toAddress, transferAmount, 0, {
        value: serviceFee,
      });

      const relayerBeforeNativeBalance = await ethers.provider.getBalance(
        alice.address
      );
      const tx = await bridgeContract.connect(alice).confirmTransfer(0);
      const receipt: TransactionReceipt = await tx.wait();
      const gasFee = receipt.gasUsed.mul(await ethers.provider.getGasPrice());
      const transferInfo = await bridgeContract.outboundTransfers(0);

      expect(await ethers.provider.getBalance(alice.address)).to.eq(
        relayerBeforeNativeBalance.sub(gasFee).add(transferInfo.serviceFee)
      );
    });

    it('Release tokens by unregistered relayer should revert', async () => {
      await expect(
        bridgeContract
          .connect(alice)
          .releaseToken(0, toAddress, bob.address, 100_00)
      ).to.revertedWith('Caller is not the registered relayer');
    });

    it('Release tokens with invalid transfer id should revert', async () => {
      await bridgeContract
        .connect(bridgeAdmin)
        .forceRegisterRelayer(alice.address);
      await expect(
        bridgeContract
          .connect(alice)
          .releaseToken(1, toAddress, bob.address, 100_000)
      ).to.revertedWith('Invalid transfer id');
    });

    it('Release token should work', async () => {
      await bridgeContract
        .connect(bridgeAdmin)
        .forceRegisterRelayer(alice.address);

      await coinContract
        .connect(deployer)
        .transfer(bridgeContract.address, 100_000);

      const beforeUserCoinBalance = await coinContract.balanceOf(bob.address);

      await expect(
        bridgeContract
          .connect(alice)
          .releaseToken(0, toAddress, bob.address, 100_000)
      )
        .to.emit(bridgeContract, 'TokensReleased')
        .withArgs(0, toAddress, bob.address, 100_000);
      let balanceTo = await coinContract.balanceOf(bob.address);
      expect(balanceTo).to.equal(beforeUserCoinBalance.add(100_000));
      expect(await bridgeContract.nextInboundTransferId()).to.eq(1);
    });

    it('Release token with frozen bridge should revert', async () => {
      await bridgeContract
        .connect(bridgeAdmin)
        .forceRegisterRelayer(alice.address);
      await bridgeContract.connect(bridgeAdmin).forceFreeze();
      await expect(
        bridgeContract
          .connect(alice)
          .releaseToken(1, toAddress, bob.address, 100_000)
      ).to.revertedWith('Bridge is frozen by admin');
    });

    it('Freeze/unfreeze without admin rights should revert', async () => {
      await expect(bridgeContract.forceFreeze()).to.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(bridgeContract.forceUnfreeze()).to.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Freeze/unfreeze with admin rights should work', async () => {
      await bridgeContract.connect(bridgeAdmin).forceFreeze();
      expect(await bridgeContract.frozen()).to.eq(true);
      await bridgeContract.connect(bridgeAdmin).forceUnfreeze();
      expect(await bridgeContract.frozen()).to.eq(false);
    });

    it('Set service fee without admin rights should revert', async () => {
      await expect(bridgeContract.forceSetServiceFee(10)).to.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Set service fee with admin rights should work', async () => {
      await bridgeContract.connect(bridgeAdmin).forceSetServiceFee(10);
      expect(await bridgeContract.serviceFee()).to.eq(10);
    });

    it('Set platform fee without admin rights should revert', async () => {
      await expect(bridgeContract.forceSetPlatformFee(10)).to.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Set service fee with admin rights should work', async () => {
      await bridgeContract.connect(bridgeAdmin).forceSetPlatformFee(10);
      expect(await bridgeContract.platformFee()).to.eq(10);
    });
  });
});
