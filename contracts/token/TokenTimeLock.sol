// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./BEP20/IBEP20.sol";
import "./BEP20/SafeBEP20.sol";
import "../math/SafeMathX.sol";

contract TokenTimeLock is Initializable {
    using SafeBEP20 for IBEP20;
    using SafeMathX for uint256;

    /// Total locked tokens
    uint256 private _amount;

    /// Total released amount to user
    uint256 private _releasedAmount;

    /// Version
    string private _version;

    /// Beneficiary
    address private _user;

    /// Token address
    address private _token;

    /// Factory address
    address private _factory;

    /// Start date of the lock
    uint64 private _startDate;

    /// Release date that user initiates a release of each phase
    uint64[] private _releaseDates;

    /// Lock duration (in seconds) of each phase
    uint32[] private _lockDurations;

    /// Release percent of each phase
    uint32[] private _releasePercents;

    /// Next release phase
    uint32 private _nextReleaseIdx;

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

    function beneficiary() public view returns (address) {
        return _user;
    }

    function amount() public view returns (uint256) {
        return _amount;
    }

    function releasedAmount() public view returns (uint256) {
        return _releasedAmount;
    }

    function startDate() public view returns (uint64) {
        return _startDate;
    }

    function lockDurations() public view returns (uint32[] memory) {
        return _lockDurations;
    }

    function releasePercents() public view returns (uint32[] memory) {
        return _releasePercents;
    }

    function releaseDates() public view returns (uint64[] memory) {
        return _releaseDates;
    }

    function nextReleaseIdx() public view returns (uint32) {
        return _nextReleaseIdx;
    }

    function factory() public view returns (address) {
        return _factory;
    }

    function lockData()
        public
        view
        returns (
            address user,
            address token_,
            uint256 amount_,
            uint256 releasedAmount_,
            uint64 startDate_,
            uint32[] memory lockDurations_,
            uint32[] memory releasePercents_,
            uint64[] memory releaseDates_,
            uint32 nextReleaseIdx_,
            address factory_
        )
    {
        return (
            beneficiary(),
            address(token()),
            amount(),
            releasedAmount(),
            startDate(),
            lockDurations(),
            releasePercents(),
            releaseDates(),
            nextReleaseIdx(),
            factory()
        );
    }

    /// @notice Register a new lock for a user
    /// Reverts in the following cases:
    /// - Duplicated lock id for a user.
    /// - `lockDurations` and `unlockPercents` length don't match.
    /// - `unlockPercents` sum is not equal to 100 (100%).
    function initialize(
        address factory_,
        address user_,
        address token_,
        uint256 amount_,
        uint32[] calldata lockDurations_,
        uint32[] calldata releasePercents_,
        uint64 startDate_
    ) public initializer returns (bool) {
        require(
            lockDurations_.length == releasePercents_.length,
            "TokenTimeLock: unlock length not match"
        );

        uint256 _sum;
        for (uint256 i = 0; i < releasePercents_.length; ++i) {
            _sum += releasePercents_[i];
        }

        require(_sum == 100, "TokenTimeLock: unlock percent not match 100");

        require(user_ != address(0), "TokenTimeLock: user address is zero");

        require(token_ != address(0), "TokenTimeLock: token address is zero");

        require(
            factory_ != address(0),
            "TokenTimeLock: factory address is zero"
        );

        require(amount_ > 0, "TokenTimeLock: amount must greater than zero");

        _factory = factory_;
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

        uint256 availableReleaseAmount;
        while (
            _nextReleaseIdx < numOfPhases &&
            block.timestamp >=
            _startDate + _lockDurations[_nextReleaseIdx] * 1 seconds
        ) {
            uint256 stepReleaseAmount;
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
        token().safeTransfer(beneficiary(), availableReleaseAmount);

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
