import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { Contract } from 'ethers';

declare module 'mocha' {
  export interface Context {
    wrapper: Contract;
  }
}

describe('SafeBEP20', async function () {
  const SafeBEP20Wrapper = await ethers.getContractFactory('SafeBEP20Test');
  const BEP20ReturnFalseMock = await ethers.getContractFactory(
    'BEP20ReturnFalseMock'
  );
  const BEP20ReturnTrueMock = await ethers.getContractFactory(
    'BEP20ReturnTrueMock'
  );
  const BEP20NoReturnMock = await ethers.getContractFactory(
    'BEP20NoReturnMock'
  );

  describe('with address that has no contract code', function () {
    beforeEach(async function () {
      this.wrapper = await SafeBEP20Wrapper.deploy(
        ethers.constants.AddressZero
      );
    });

    shouldRevertOnAllCalls('Address: call to non-contract');
  });

  describe('with token that returns false on all calls', function () {
    beforeEach(async function () {
      this.wrapper = await SafeBEP20Wrapper.deploy(
        (
          await BEP20ReturnFalseMock.deploy()
        ).address
      );
    });

    shouldRevertOnAllCalls('SafeBEP20: BEP20 operation did not succeed');
  });

  describe('with token that returns true on all calls', function () {
    beforeEach(async function () {
      this.wrapper = await SafeBEP20Wrapper.deploy(
        (
          await BEP20ReturnTrueMock.deploy()
        ).address
      );
    });

    shouldOnlyRevertOnErrors();
  });

  describe('with token that returns no boolean values', function () {
    beforeEach(async function () {
      this.wrapper = await SafeBEP20Wrapper.deploy(
        (
          await BEP20NoReturnMock.deploy()
        ).address
      );
    });

    shouldOnlyRevertOnErrors();
  });
});

function shouldRevertOnAllCalls(reason: string) {
  it('reverts on transfer', async function () {
    await expect(this.wrapper.transfer()).to.be.revertedWith(reason);
  });

  it('reverts on transferFrom', async function () {
    await expect(this.wrapper.transferFrom()).to.be.revertedWith(reason);
  });

  it('reverts on approve', async function () {
    await expect(this.wrapper.approve(0)).to.be.revertedWith(reason);
  });

  it('reverts on increaseAllowance', async function () {
    // [TODO] make sure it's reverting for the right reason
    await expect(this.wrapper.increaseAllowance(0)).to.be.reverted;
  });

  it('reverts on decreaseAllowance', async function () {
    // [TODO] make sure it's reverting for the right reason
    await expect(this.wrapper.decreaseAllowance(0)).to.be.reverted;
  });
}

function shouldOnlyRevertOnErrors() {
  it("doesn't revert on transfer", async function () {
    await this.wrapper.transfer();
  });

  it("doesn't revert on transferFrom", async function () {
    await this.wrapper.transferFrom();
  });

  describe('approvals', function () {
    context('with zero allowance', function () {
      beforeEach(async function () {
        await this.wrapper.setAllowance(0);
      });

      it("doesn't revert when approving a non-zero allowance", async function () {
        await this.wrapper.approve(100);
      });

      it("doesn't revert when approving a zero allowance", async function () {
        await this.wrapper.approve(0);
      });

      it("doesn't revert when increasing the allowance", async function () {
        await this.wrapper.increaseAllowance(10);
      });

      it('reverts when decreasing the allowance', async function () {
        await expect(this.wrapper.decreaseAllowance(10)).to.be.revertedWith(
          'SafeBEP20: decreased allowance below zero'
        );
      });
    });

    context('with non-zero allowance', function () {
      beforeEach(async function () {
        await this.wrapper.setAllowance(100);
      });

      it('reverts when approving a non-zero allowance', async function () {
        await expect(this.wrapper.approve(20)).to.be.revertedWith(
          'SafeBEP20: approve from non-zero to non-zero allowance'
        );
      });

      it("doesn't revert when approving a zero allowance", async function () {
        await this.wrapper.approve(0);
      });

      it("doesn't revert when increasing the allowance", async function () {
        await this.wrapper.increaseAllowance(10);
      });

      it("doesn't revert when decreasing the allowance to a positive value", async function () {
        await this.wrapper.decreaseAllowance(50);
      });

      it('reverts when decreasing the allowance to a negative value', async function () {
        await expect(this.wrapper.decreaseAllowance(200)).to.be.revertedWith(
          'SafeBEP20: decreased allowance below zero'
        );
      });
    });
  });
}
