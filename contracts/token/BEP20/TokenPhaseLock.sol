// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IBEP20.sol";
import "./SafeBEP20.sol";
import "../../math/SafeMathX.sol";
import "../../utils/Arrays.sol";

contract TokenPhaseLock is Context, Ownable {
    using SafeBEP20 for IBEP20;
    using Arrays for uint256[];
    using SafeMathX for uint256;

    mapping(address => mapping(string => PhaseLock)) private _phaseLocks;

    IBEP20 private _token;

    /// Rep
    struct PhaseLock {
        string lockId;
        uint256 amount;
        uint256 startTimestamp;
        uint256[] unlockDates;
        uint256[] unlockPercents;
        uint256 nextUnlockIdx;
        uint256 withdrawnAmount;
        bool alreadyExists;
    }

    constructor(IBEP20 token_) {
        _token = token_;
    }

    /// @return Token being held
    function token() public view virtual returns (IBEP20) {
        return _token;
    }

    /// @return Returning a lock info
    function getLock(string memory lockId)
        public
        view
        returns (PhaseLock memory)
    {
        PhaseLock memory lock = _phaseLocks[_msgSender()][lockId];
        return lock;
    }

    /// @notice Register a new lock for a user
    /// @dev Each user can have multiple locks identified by lock id.
    /// Reverts in the following cases:
    /// - Duplicated lock id for a user.
    /// - `unlockDates` and `unlockPercents` length don't match.
    /// - `unlockPercents` sum is not equal to 100 (100%).
    /// @param user user receiving tokens when they are unlocked.
    /// @param lockId lock id representing the lock.
    /// @param amount amount of tokens to be locked.
    /// @param unlockDates an array of durations (in days) that some amount of locked tokens to be unlocked.
    /// @param unlockPercents an array of percentages of total locked tokens to be unlocked at corresponding `unlockDates`.
    /// @return Return `true` if register successfully, otherwise `false`.
    function registerNewLock(
        address user,
        string memory lockId,
        uint256 amount,
        uint256[] memory unlockDates,
        uint256[] memory unlockPercents
    ) public onlyOwner returns (bool) {
        require(
            !_phaseLocks[user][lockId].alreadyExists,
            "TokenPhaseLock: Duplicated Lock Id"
        );
        require(
            unlockDates.length == unlockPercents.length,
            "TokenPhaseLock: Unlock Dates and Unlock Percents length not match"
        );
        require(
            unlockPercents.sum() == 100,
            "TokenPhaseLock: Total Unlock Percents is not 100"
        );

        PhaseLock storage lock = _phaseLocks[user][lockId];
        lock.lockId = lockId;
        lock.amount = amount;
        lock.startTimestamp = block.timestamp;
        lock.unlockDates = unlockDates;
        lock.unlockPercents = unlockPercents;
        lock.nextUnlockIdx = 0;
        lock.withdrawnAmount = 0;
        lock.alreadyExists = true;

        return true;
    }

    /// @notice Withdraw unlocked tokens to user.
    /// @dev User (sender) can withdraw unlocked tokens by calling this function.
    /// This function will release locked tokens from multiple lock phases that meets unlock requirements
    /// Reverts in the following cases:
    /// - Lock id not exists
    /// - No tokens to be withdrawn including:
    ///     + All lock phases are already released
    ///     + Do not meet next unlock requirements
    /// - Amount of tokens that this smart contract holds is insufficient. In this case, users should contact the owner of the token.
    /// @param lockId Lock id that users want to withdraw
    /// @return Return `true` if succeeds, otherwise `false`
    function release(string memory lockId) public returns (bool) {
        PhaseLock storage lock = _phaseLocks[_msgSender()][lockId];

        require(
            lock.alreadyExists,
            "TokenPhaseLock: Can't withdraw tokens from a lock that doesn't exists"
        );
        require(
            lock.nextUnlockIdx < lock.unlockPercents.length,
            "TokenPhaseLock: All lock phases are released"
        );
        require(
            block.timestamp >=
                lock.startTimestamp +
                    lock.unlockDates[lock.nextUnlockIdx] *
                    1 days,
            "TokenPhaseLock: Not meet next unlock requirements"
        );

        uint256 availableWithdrawAmount = 0;
        while (
            lock.nextUnlockIdx < lock.unlockPercents.length &&
            block.timestamp >=
            lock.startTimestamp + lock.unlockDates[lock.nextUnlockIdx] * 1 days
        ) {
            uint256 stepWithdrawAmount = 0;
            if (lock.nextUnlockIdx == lock.unlockPercents.length - 1) {
                stepWithdrawAmount =
                    lock.amount -
                    lock.withdrawnAmount -
                    availableWithdrawAmount;
            } else {
                stepWithdrawAmount = lock.amount.mulScale(
                    lock.unlockPercents[lock.nextUnlockIdx],
                    100
                );
            }

            availableWithdrawAmount += stepWithdrawAmount;
            lock.nextUnlockIdx++;
        }

        uint256 balance = token().balanceOf(address(this));
        require(
            balance >= availableWithdrawAmount,
            "TokenPhaseLock: Insufficient balance to withdraw"
        );
        lock.withdrawnAmount += availableWithdrawAmount;
        token().safeTransfer(_msgSender(), availableWithdrawAmount);

        return true;
    }
}
