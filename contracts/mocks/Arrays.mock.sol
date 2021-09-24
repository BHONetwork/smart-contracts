// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "../utils/Arrays.sol";

contract ArraysTest is Context {
    using Arrays for uint256[];

    function sum(uint256[] memory arr) public pure returns (uint256) {
        return arr.sum();
    }
}
