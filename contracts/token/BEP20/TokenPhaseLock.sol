// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./IBEP20.sol";
import "./SafeBEP20.sol";
import "../../math/SafeMathX.sol";
import "../../utils/Arrays.sol";
import "hardhat/console.sol";

contract TokenPhaseLock is Context, Ownable, Initializable {
    using SafeBEP20 for IBEP20;
    using SafeMathX for uint256;

    mapping(address => mapping(string => PhaseLock)) private _phaseLocks;

    IBEP20 private _token;

    struct PhaseLock {
        string lockId;
        uint256 amount;
        uint256 withdrawnAmount;
        uint32[] unlockDates;
        uint32[] unlockPercents;
        uint64 startTimestamp;
        uint32 nextUnlockIdx;
        bool alreadyExists;
    }

    constructor(IBEP20 token_) {
        initialize(token_);
    }

    function initialize(IBEP20 token_) public initializer {
        _token = token_;
    }

    /// @return Token being held
    function token() public view virtual returns (IBEP20) {
        return _token;
    }

    /// @return
    function getLock(address user_, string memory lockId_)
        public
        view
        returns (PhaseLock memory)
    {
        PhaseLock storage lock = _phaseLocks[user_][lockId_];
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
        uint32[] memory unlockDates,
        uint32[] memory unlockPercents,
        uint64 startTimestamp
    ) public onlyOwner returns (bool) {
        require(
            !_phaseLocks[user][lockId].alreadyExists,
            "TokenPhaseLock: dup lock id"
        );
        require(
            unlockDates.length == unlockPercents.length,
            "TokenPhaseLock: unlock length not match"
        );

        uint256 _sum = 0;
        for (uint256 i = 0; i < unlockPercents.length; ++i) {
            _sum += unlockPercents[i];
        }

        require(_sum == 100, "TokenPhaseLock: unlock percent not match 100");

        PhaseLock storage lock = _phaseLocks[user][lockId];
        lock.lockId = lockId;
        lock.amount = amount;
        lock.withdrawnAmount = 0;
        lock.unlockDates = unlockDates;
        lock.unlockPercents = unlockPercents;
        lock.startTimestamp = startTimestamp;
        lock.nextUnlockIdx = 0;
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
        uint256 numOfPhases = lock.unlockPercents.length;

        require(lock.alreadyExists, "TokenPhaseLock: lock not exists");
        require(
            lock.nextUnlockIdx < numOfPhases,
            "TokenPhaseLock: all phases are released"
        );
        require(
            block.timestamp >=
                lock.startTimestamp +
                    lock.unlockDates[lock.nextUnlockIdx] *
                    1 days,
            "TokenPhaseLock: next phase unavailable"
        );

        uint256 availableWithdrawAmount = 0;
        while (
            lock.nextUnlockIdx < numOfPhases &&
            block.timestamp >=
            lock.startTimestamp + lock.unlockDates[lock.nextUnlockIdx] * 1 days
        ) {
            uint256 stepWithdrawAmount = 0;
            if (lock.nextUnlockIdx == numOfPhases - 1) {
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
            "TokenPhaseLock: insufficient balance"
        );
        lock.withdrawnAmount += availableWithdrawAmount;
        token().safeTransfer(_msgSender(), availableWithdrawAmount);

        return true;
    }
}
