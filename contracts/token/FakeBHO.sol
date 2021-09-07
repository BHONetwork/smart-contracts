// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract FakeBHO is ERC20PresetMinterPauser {
    constructor() ERC20PresetMinterPauser("Bholdus Token", "BHO") {
        mint(_msgSender(), 10_000_000_000 * (10**18));
    }
}
