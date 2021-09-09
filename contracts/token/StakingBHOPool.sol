// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./CoinBHOV2.sol";

contract StakingBHOPool is
    Initializable,
    ContextUpgradeable,
    AccessControlUpgradeable
{
    struct StakingInfo {
        uint256 amount;
        uint256 startDate;
        uint32 programId;
        bool isWithdrawn;
        bool isExist;
    }

    struct ProgramInfo {
        uint256[] interestDates;
        uint256 apy;
        bool isExist;
    }

    mapping(address => uint64) private _nextStakingIds;
    mapping(address => mapping(uint64 => StakingInfo)) private _stakingInfos;
    mapping(uint64 => ProgramInfo) private _programInfos;
    uint64 private _nextProgramId;
    address private _feeCollector;
    CoinBHOV2 private _token;

    event RegisterProgram(address indexed who, uint64 indexed programId);
    event EnterStaking(
        address indexed who,
        uint256 amount,
        uint64 indexed stakingId
    );
    event LeaveStaking(
        address indexed who,
        uint256 reward,
        uint256 totalAmount,
        uint64 indexed stakingId
    );
    event EmergencyWithdraw(
        address indexed admin,
        address indexed who,
        uint256 amount,
        uint64 indexed stakingId
    );

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

    // Access Control roles
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant PROGRAM_AUTHOR_ROLE =
        keccak256("PROGRAM_AUTHOR_ROLE");

    function nextStakingId(address staker) public view returns (uint64) {
        return _nextStakingIds[staker];
    }

    function stakingInfo(address staker, uint64 stakingId)
        public
        view
        returns (StakingInfo memory)
    {
        return _stakingInfos[staker][stakingId];
    }

    function nextProgramId() public view returns (uint64) {
        return _nextProgramId;
    }

    function programInfo(uint64 programId)
        public
        view
        returns (ProgramInfo memory)
    {
        return _programInfos[programId];
    }

    /**
     * @dev Since this staking contract is deployed with proxy approach,
     * this is its constructor
     *
     * @param admin address with admin rights. This address has highest power
     * @param token token contract
     * @param feeCollector address that collects fee when users leave staking and withdraw interests
     */
    function initialize(
        address admin,
        address token,
        address feeCollector
    ) public initializer returns (bool) {
        ContextUpgradeable.__Context_init_unchained();
        AccessControlUpgradeable.__AccessControl_init_unchained();

        AccessControlUpgradeable._setupRole(DEFAULT_ADMIN_ROLE, admin);
        AccessControlUpgradeable._setupRole(EMERGENCY_ROLE, admin);
        AccessControlUpgradeable._setupRole(PROGRAM_AUTHOR_ROLE, admin);

        _feeCollector = feeCollector;
        _token = CoinBHOV2(token);

        // Two default staking programs
        uint256[] memory interestDates1 = new uint256[](1);
        interestDates1[0] = DECEMBER_INTEREST_DATE;
        _programInfos[0] = ProgramInfo({
            apy: APY_PROGRAM_1,
            interestDates: interestDates1,
            isExist: true
        });

        uint256[] memory interestDates2 = new uint256[](4);
        interestDates2[0] = SEPTEMBER_INTEREST_DATE;
        interestDates2[1] = OCTOBER_INTEREST_DATE;
        interestDates2[2] = NOVEMBER_INTEREST_DATE;
        interestDates2[3] = DECEMBER_INTEREST_DATE;
        _programInfos[1] = ProgramInfo({
            apy: APY_PROGRAM_2,
            interestDates: interestDates2,
            isExist: true
        });
        _nextProgramId = 2;
        return true;
    }

    function registerProgram(uint256 apy, uint256[] memory interestDates)
        public
        returns (bool)
    {
        require(
            hasRole(PROGRAM_AUTHOR_ROLE, _msgSender()),
            "Staking: program author role required"
        );
        require(
            interestDates.length > 0,
            "Staking: invalid program interest dates"
        );

        uint64 programId = _nextProgramId;
        _programInfos[programId] = ProgramInfo({
            apy: apy,
            interestDates: interestDates,
            isExist: true
        });
        _nextProgramId++;

        emit RegisterProgram(_msgSender(), programId);
        return true;
    }

    /**
     * @dev Internal utility function to calculate reward.
     *
     * @param amount staked amount
     * @param startDate date that users start staking
     * @param interestDate date that users can withdraw their interest along with staked amount
     * @param apy Annual percentage yield
     */
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

    /**
     * @dev Users can become a staker to earn interest using this function.
     * Before entering staking, users must `approve` this staking contract to transfer their tokens to this contract for lockup.
     *
     * @param programId Staking program described by BHOLDUS. Must either 1 or 2
     * @param amount Amount of tokens users want to stake
     */
    function enterStaking(uint32 programId, uint256 amount)
        public
        returns (bool)
    {
        ProgramInfo memory _programInfo = _programInfos[programId];
        require(_programInfo.isExist, "Staking: program not exists");
        require(
            block.timestamp <
                _programInfo.interestDates[
                    _programInfo.interestDates.length - 1
                ],
            "Staking: program is over"
        );

        _token.transferFrom(_msgSender(), address(this), amount);

        uint64 stakingId = _nextStakingIds[_msgSender()];
        _stakingInfos[_msgSender()][stakingId] = StakingInfo({
            amount: amount,
            startDate: block.timestamp,
            programId: programId,
            isExist: true,
            isWithdrawn: false
        });

        _nextStakingIds[_msgSender()]++;

        emit EnterStaking(_msgSender(), amount, stakingId);
        return true;
    }

    /**
     * @dev Users can withdraw staked amount and reward using this function.
     * Users can only withdraw if interest date is sastisfied
     *
     * @param stakingId Staking identifiier
     */
    function leaveStaking(uint32 stakingId) public returns (bool) {
        StakingInfo storage _stakingInfo = _stakingInfos[_msgSender()][
            stakingId
        ];
        require(_stakingInfo.isExist, "Staking: staking not exists");
        require(!_stakingInfo.isWithdrawn, "Staking: already withdrawn");

        uint256 reward;
        uint256 interestDate;
        ProgramInfo memory _programInfo = _programInfos[_stakingInfo.programId];

        for (uint256 i = 0; i < _programInfo.interestDates.length; ++i) {
            if (_stakingInfo.startDate < _programInfo.interestDates[i]) {
                interestDate = _programInfo.interestDates[i];
                break;
            }
        }

        reward = _calculateReward(
            _stakingInfo.amount,
            _stakingInfo.startDate,
            interestDate,
            block.timestamp,
            _programInfo.apy
        );

        _token.mint(address(this), reward + reward / 10);
        _token.transfer(_feeCollector, reward / 10);
        _token.transfer(_msgSender(), _stakingInfo.amount + reward);
        _stakingInfo.isWithdrawn = true;

        emit LeaveStaking(
            _msgSender(),
            reward,
            _stakingInfo.amount + reward,
            stakingId
        );
        return true;
    }

    /**
     * @dev Withdraw staked amount to users.
     * This is only for emergency, i.e when mistakes happen.
     * And only address that has EMERGENCY_ROLE can withdraw
     *
     * @param staker staker
     * @param stakingId staking identifier
     */
    function emergencyWithdraw(address staker, uint64 stakingId)
        public
        returns (bool)
    {
        require(
            hasRole(EMERGENCY_ROLE, _msgSender()),
            "Staking: emergency role required"
        );
        StakingInfo storage _stakingInfo = _stakingInfos[staker][stakingId];
        require(_stakingInfo.isExist, "Staking: staking not exists");
        require(!_stakingInfo.isWithdrawn, "Staking: already withdrawn");

        _token.transfer(staker, _stakingInfo.amount);

        _stakingInfo.isWithdrawn = true;

        emit EmergencyWithdraw(
            _msgSender(),
            staker,
            _stakingInfo.amount,
            stakingId
        );
        return true;
    }
}
