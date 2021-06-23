import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';

describe('Arrays', function () {
  let arrayContract: Contract;

  before(async function () {
    const contractFactory = await ethers.getContractFactory('ArraysTest');
    arrayContract = await contractFactory.deploy();
  });

  describe('sum', function () {
    it('should return correct sum', async function () {
      const arr = [1, 1, 1];
      const sumOfArr = arr.reduce((acc, ele) => {
        return acc + ele;
      }, 0);
      const result = await arrayContract.sum(arr);
      expect(result).to.equal(sumOfArr);
    });
  });
});
