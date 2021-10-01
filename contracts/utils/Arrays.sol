// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

library Arrays {
    function sum(uint256[] memory arr) internal pure returns (uint256) {
        uint256 _sum;
        for (uint256 i; i < arr.length; ++i) {
            _sum += arr[i];
        }
        return _sum;
    }
}
