// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "./CoinBHO.sol";

contract StakingBHOPool is
    Initializable,
    ContextUpgradeable,
    OwnableUpgradeable
{
    struct StakingInfo {
        uint256 amount;
        uint256 startDate;
        uint8 programId;
        bool isWithdrawn;
        bool isExist;
    }

    mapping(address => uint32) private _nextStakingIds;
    mapping(address => mapping(uint32 => StakingInfo)) private _stakingInfos;
    address private _feeCollector;
    CoinBHO private _token;

    // Interest date at the end of september
    uint256 public constant SEPTEMBER_INTEREST_DATE = 1633046400;
    // Interest date at the end of october
    uint256 public constant OCTOBER_INTEREST_DATE = 1635724800;
    // Interest date at the end of november
    uint256 public constant NOVEMBER_INTEREST_DATE = 1638316800;
    // Interest date at the end of december
    uint256 public constant DECEMBER_INTEREST_DATE = 1640995200;

    // APY of Program 1 in basis points
    uint256 public constant APY_PROGRAM_1 = 5000;
    // APY of Program 2 in basis points
    uint256 public constant APY_PROGRAM_2 = 3000;

    // Useful constants
    uint256 private constant SECONDS_PER_DAY = 86400;

    function initialize(
        address owner,
        address token,
        address feeCollector
    ) public initializer returns (bool) {
        ContextUpgradeable.__Context_init_unchained();
        OwnableUpgradeable.__Ownable_init_unchained();
        OwnableUpgradeable.transferOwnership(owner);
        _feeCollector = feeCollector;
        _token = CoinBHO(token);
        return true;
    }

    function enterStaking(uint8 programId, uint256 amount)
        public
        returns (bool)
    {
        require(programId == 1 || programId == 2, "staking program not exists");
        require(
            block.timestamp < DECEMBER_INTEREST_DATE,
            "staking program is over"
        );

        _token.transferFrom(_msgSender(), address(this), amount);

        uint32 stakingId = _nextStakingIds[_msgSender()];
        _stakingInfos[_msgSender()][stakingId] = StakingInfo({
            amount: amount,
            startDate: block.timestamp,
            programId: programId,
            isExist: true,
            isWithdrawn: false
        });

        _nextStakingIds[_msgSender()]++;

        return true;
    }

    function _calculateReward(
        uint256 amount,
        uint256 startDate,
        uint256 interestDate,
        uint256 withdrawDate,
        uint256 apy
    ) private pure returns (uint256) {
        require(startDate < interestDate, "Staking: invalid start date");
        require(withdrawDate >= interestDate, "Staking: invalid withdraw date");

        uint256 reward;
        uint256 stakingDurationInDays = (interestDate - startDate) /
            SECONDS_PER_DAY;
        if (stakingDurationInDays < 1) {
            // Users that stake at the day before interest date
            if ((withdrawDate - startDate) / SECONDS_PER_DAY < 1) {
                // Users must wait for 24 hours to receive 1-day interest
                revert("Staking: withrawal required 24 hours");
            } else {
                reward = (amount * apy * 1) / (365 * 10_000);
            }
        } else {
            reward = (amount * apy * stakingDurationInDays) / (365 * 10_000);
        }

        return reward;
    }

    function leaveStaking(uint32 stakingId) public returns (bool) {
        StakingInfo storage stakingInfo = _stakingInfos[_msgSender()][
            stakingId
        ];
        require(stakingInfo.isExist, "Staking: not exists");
        require(!stakingInfo.isWithdrawn, "Staking: already withdrawn");

        uint256 reward;
        if (stakingInfo.programId == 1) {
            reward = _calculateReward(
                stakingInfo.amount,
                stakingInfo.startDate,
                DECEMBER_INTEREST_DATE,
                block.timestamp,
                APY_PROGRAM_1
            );
        } else if (stakingInfo.programId == 2) {
            uint256 interestDate;
            if (stakingInfo.startDate < SEPTEMBER_INTEREST_DATE) {
                interestDate = SEPTEMBER_INTEREST_DATE;
            } else if (stakingInfo.startDate < OCTOBER_INTEREST_DATE) {
                interestDate = OCTOBER_INTEREST_DATE;
            } else if (stakingInfo.startDate < NOVEMBER_INTEREST_DATE) {
                interestDate = NOVEMBER_INTEREST_DATE;
            } else if (stakingInfo.startDate < DECEMBER_INTEREST_DATE) {
                interestDate = DECEMBER_INTEREST_DATE;
            }
            reward = _calculateReward(
                stakingInfo.amount,
                stakingInfo.startDate,
                interestDate,
                block.timestamp,
                APY_PROGRAM_2
            );
        }

        _token.mint(reward + reward / 10);
        _token.transfer(_feeCollector, reward / 10);
        _token.transfer(_msgSender(), stakingInfo.amount + reward);
        stakingInfo.isWithdrawn = true;

        return true;
    }
}
