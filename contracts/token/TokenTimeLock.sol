// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./BEP20/IBEP20.sol";
import "./BEP20/SafeBEP20.sol";
import "../math/SafeMathX.sol";
import "hardhat/console.sol";

contract TokenTimeLock is Context, Ownable {
    using SafeBEP20 for IBEP20;
    using SafeMathX for uint256;

    /// Release date that user initiates a release of each phase
    uint64[] private _releaseDates;

    /// Lock duration (in seconds) of each phase
    uint32[] private _lockDurations;

    /// Release percent of each phase
    uint32[] private _releasePercents;

    /// Total locked tokens
    uint256 private _amount;

    /// Total released amount to user
    uint256 private _releasedAmount;

    /// Beneficiary
    address private _user;

    /// Start date of the lock
    uint64 private _startDate;

    /// Next release phase
    uint32 private _nextReleaseIdx;

    /// Token address
    address private _token;

    event Released(
        uint256 phaseReleasedAmount,
        uint256 totalReleasedAmount,
        uint32 fromIdx,
        uint32 toIdx,
        uint64 date
    );

    function token() public view returns (IBEP20) {
        return IBEP20(_token);
    }

    function lockData()
        public
        view
        returns (
            address user,
            address token_,
            uint256 amount,
            uint256 releasedAmount,
            uint64 startDate,
            uint32[] memory lockDurations,
            uint32[] memory releasePercents,
            uint64[] memory releaseDates,
            uint32 nextReleaseIdx
        )
    {
        return (
            _user,
            _token,
            _amount,
            _releasedAmount,
            _startDate,
            _lockDurations,
            _releasePercents,
            _releaseDates,
            _nextReleaseIdx
        );
    }

    /// @notice Register a new lock for a user
    /// Reverts in the following cases:
    /// - Duplicated lock id for a user.
    /// - `lockDurations` and `unlockPercents` length don't match.
    /// - `unlockPercents` sum is not equal to 100 (100%).
    function setup(
        address user_,
        address token_,
        uint256 amount_,
        uint32[] calldata lockDurations_,
        uint32[] calldata releasePercents_,
        uint64 startDate_
    ) public returns (bool) {
        require(
            lockDurations_.length == releasePercents_.length,
            "TokenTimeLock: unlock length not match"
        );

        uint256 _sum = 0;
        for (uint256 i = 0; i < releasePercents_.length; ++i) {
            _sum += releasePercents_[i];
        }

        require(_sum == 100, "TokenTimeLock: unlock percent not match 100");

        _user = user_;
        _token = token_;
        _startDate = startDate_;
        _lockDurations = lockDurations_;
        _releasePercents = releasePercents_;
        _amount = amount_;
        _releasedAmount = 0;
        _nextReleaseIdx = 0;
        _releaseDates = new uint64[](_lockDurations.length);

        return true;
    }

    /// @notice Release unlocked tokens to user.
    /// @dev User (sender) can release unlocked tokens by calling this function.
    /// This function will release locked tokens from multiple lock phases that meets unlock requirements
    /// Reverts in the following cases:
    /// - No tokens to be withdrawn including:
    ///     + All lock phases are already released
    ///     + Do not meet next unlock requirements
    /// - Amount of tokens that this smart contract holds is insufficient. In this case, users should contact the owner of the token.
    /// @return Return `true` if succeeds, otherwise `false`
    function release() public returns (bool) {
        uint256 numOfPhases = _lockDurations.length;

        require(
            _nextReleaseIdx < numOfPhases,
            "TokenTimeLock: all phases are released"
        );
        require(
            block.timestamp >=
                _startDate + _lockDurations[_nextReleaseIdx] * 1 seconds,
            "TokenTimeLock: next phase unavailable"
        );

        uint256 prevReleaseIdx = _nextReleaseIdx;

        uint256 availableReleaseAmount = 0;
        while (
            _nextReleaseIdx < numOfPhases &&
            block.timestamp >=
            _startDate + _lockDurations[_nextReleaseIdx] * 1 seconds
        ) {
            uint256 stepReleaseAmount = 0;
            if (_nextReleaseIdx == numOfPhases - 1) {
                stepReleaseAmount =
                    _amount -
                    _releasedAmount -
                    availableReleaseAmount;
            } else {
                stepReleaseAmount = _amount.mulScale(
                    _releasePercents[_nextReleaseIdx],
                    100
                );
            }

            availableReleaseAmount += stepReleaseAmount;
            _nextReleaseIdx++;
        }

        uint256 balance = token().balanceOf(address(this));
        require(
            balance >= availableReleaseAmount,
            "TokenTimeLock: insufficient balance"
        );
        _releasedAmount += availableReleaseAmount;
        token().safeTransfer(_msgSender(), availableReleaseAmount);

        uint64 releaseDate = uint64(block.timestamp);

        for (uint256 i = prevReleaseIdx; i < _nextReleaseIdx; ++i) {
            _releaseDates[i] = releaseDate;
        }

        emit Released(
            availableReleaseAmount,
            _releasedAmount,
            uint32(prevReleaseIdx),
            _nextReleaseIdx - 1,
            releaseDate
        );

        return true;
    }
}
