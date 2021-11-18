import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { expect } from 'chai';
import type { Contract, ContractFactory } from 'ethers';
import { ethers, deployments, getNamedAccounts } from 'hardhat';
import { connect } from 'http2';

const { BigNumber } = ethers;

describe('Bridge', async () =>{
  let coinContract: Contract;
  let bridgeContract: Contract;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let owner: SignerWithAddress;

//   const {bridgeAdmin, alice, bob} = await getNamedAccounts();


  beforeEach(async () => {
    await deployments.fixture(['bridge']);
    [addr1, addr2, owner] = await ethers.getSigners();
    coinContract = await ethers.getContract('CoinBHO');
    bridgeContract = await ethers.getContract('Bridge');
    await coinContract.deployed();
    await bridgeContract.deployed();
  });

  describe('Transaction', function(){
      it('Transfer correct token amount', async () =>{
        // Transfer 50 tokens from owner to addr1
        const decimals = await coinContract.decimals();
        const approveAmount = BigNumber.from(100_000_000_000_000).mul(
            BigNumber.from(10).pow(decimals)
        );

        const transferAmount = BigNumber.from(10).mul(
          BigNumber.from(10).pow(decimals)
        );

        let fromAddr = '0x05416460deb76d57af601be17e777b93592d8d4d4a4096c57876a91c84f4a712'
        await coinContract.approve(bridgeContract.address, approveAmount);
        await bridgeContract.initiateTransfer(fromAddr, transferAmount, 0, { value: 1000_000_000 })
        const balanceContract = await coinContract.balanceOf(bridgeContract.address);
        expect(balanceContract).to.equal(transferAmount.add(1000_000_000))
      })

      it('Register relayer', async() =>{
        await bridgeContract.forceRegisterRelayer(addr1.address);
        const isRelayer = await bridgeContract.checkRegisterRelayer(addr1.address);
        expect(isRelayer).to.equal(true);
      })

      it('Should revert confirm transfer if not relayer', async() =>{
        let transfer_id = bridgeContract.next_outbound_transfer_id() - 1;
        let service_fee = bridgeContract.service_fee
        expect(bridgeContract.connect(addr1).confirmTransfer(0)).to.revertedWith("Caller is not the relayer")
      })

      it('Should revert releasetoken if not relayer', async() =>{
        let transfer_id = 0;
        let from = '0x05416460deb76d57af601be17e777b93592d8d4d4a4096c57876a91c84f4a712'

        const decimals = await coinContract.decimals();
        const transferAmount = BigNumber.from(10_000_000).mul(
          BigNumber.from(10).pow(decimals)
        );

        expect(bridgeContract.connect(addr1).releaseToken(0, from, addr2.address, transferAmount)).to.revertedWith("Caller is not the relayer")
      })

      it('Confirm transfer succes', async() =>{
        const decimals = await coinContract.decimals();
        const approveAmount = BigNumber.from(10_000_0_000_000_000).mul(
            BigNumber.from(10).pow(decimals)
        );

        const transferAmount = BigNumber.from(10).mul(
          BigNumber.from(10).pow(decimals)
        );

        let fromAddr = '0x05416460deb76d57af601be17e777b93592d8d4d4a4096c57876a91c84f4a712'
        await coinContract.approve(bridgeContract.address, approveAmount);
        await bridgeContract.initiateTransfer(fromAddr, transferAmount, 0, { value: 1000_000_000 })
        
        let service_fee = await bridgeContract.service_fee()
        await bridgeContract.forceRegisterRelayer(addr1.address);
        await coinContract.connect(addr1).approve(bridgeContract.address, approveAmount);
        // await coinContract.transfer(bridgeContract.address, 1000_000_000);
        await bridgeContract.connect(addr1).confirmTransfer(0)
        let balanceRelayer = await coinContract.balanceOf(addr1.address);
        let outboundId = await bridgeContract.next_confirmed_outbound_transfer_id()
        expect(outboundId).to.equal(1)
      })

      it('Release token success', async() =>{
        let transfer_id = 0;
        let from = '0x05416460deb76d57af601be17e777b93592d8d4d4a4096c57876a91c84f4a712'

        const decimals = await coinContract.decimals();
        const transferAmount = BigNumber.from(10_000_000).mul(
          BigNumber.from(10).pow(decimals)
        );

        const approveAmount = BigNumber.from(100_000_000_000).mul(
          BigNumber.from(10).pow(decimals)
        );

        let fromAddr = '0x05416460deb76d57af601be17e777b93592d8d4d4a4096c57876a91c84f4a712'
        await coinContract.approve(bridgeContract.address, approveAmount);
        await bridgeContract.initiateTransfer(fromAddr, transferAmount, 0, { value: 1000_000_000 })

        await bridgeContract.forceRegisterRelayer(addr1.address);
        await coinContract.connect(addr1).approve(bridgeContract.address, transferAmount);
        await bridgeContract.connect(addr1).releaseToken(0, from, addr2.address, transferAmount)
        let balanceTo = await coinContract.balanceOf(addr2.address);
        expect(balanceTo).to.equal(transferAmount)
      })
  })
})