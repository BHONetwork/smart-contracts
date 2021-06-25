// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Arrays {
    function sum(uint256[] memory arr) internal pure returns (uint256) {
        uint256 _sum = 0;
        for (uint256 i = 0; i < arr.length; ++i) {
            _sum += arr[i];
        }
        return _sum;
    }
}
