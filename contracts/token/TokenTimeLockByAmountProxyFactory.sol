// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./TokenTimeLockByAmount.sol";

contract TokenTimeLockByAmountProxyFactory {
    event ProxyCreated(address proxy, address implementation, address factory);

    function createProxy(
        address lock,
        address user_,
        address token_,
        uint32[] calldata lockDurations_,
        uint256[] calldata releaseAmounts_,
        uint64 startDate_
    ) public returns (address) {
        address proxy = Clones.clone(lock);
        bool setupResult = TokenTimeLockByAmount(proxy).initialize(
            address(this),
            user_,
            token_,
            lockDurations_,
            releaseAmounts_,
            startDate_
        );
        require(setupResult, "TokenTimeLockByAmountProxy: can't setup");

        emit ProxyCreated(proxy, lock, address(this));

        return proxy;
    }
}
