//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../token/BEP20/IBEP20.sol";

contract Bridge is OwnableUpgradeable, UUPSUpgradeable {
    struct TransferInfo {
        uint256 amount;
        uint256 serviceFee;
        address from;
        bytes32 to;
        uint16 targetChain;
        bool isExist;
    }

    mapping(uint256 => TransferInfo) public outboundTransfers;
    mapping(address => bool) public relayers;
    mapping(uint16 => bool) public chains;
    uint256 public nextOutboundTransferId;
    uint256 public nextConfirmOutboundTransferId;
    uint256 public nextInboundTransferId;
    uint256 public serviceFee;
    uint256 public minDeposit;
    address public bholdusToken;
    bool public frozen;

    event TransferInitiated(
        uint256 indexed transfer_id,
        address indexed from,
        bytes32 indexed to,
        uint256 amount,
        uint16 targetChain
    );

    event TokensReleased(
        uint256 indexed transfer_id,
        bytes32 indexed from,
        address indexed to,
        uint256 amount
    );

    function initialize(
        address _admin,
        address _token,
        uint256 _fee,
        uint256 _minDeposit
    ) public initializer returns (bool) {
        __Ownable_init();
        __UUPSUpgradeable_init();

        bholdusToken = _token;
        serviceFee = _fee;
        minDeposit = _minDeposit;

        transferOwnership(_admin);

        return true;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    function initiateTransfer(
        bytes32 to,
        uint256 amount,
        uint16 targetChain
    ) public payable {
        require(!frozen, "Bridge is frozen by admin");
        require(chains[targetChain], "Unsupported chain");
        require(msg.value == serviceFee, "Missing service fee");
        require(amount >= minDeposit, "Minimum amount required");

        IBEP20(bholdusToken).transferFrom(msg.sender, address(this), amount);

        //set transfer info
        TransferInfo memory transferInfo;
        transferInfo.serviceFee = msg.value;
        transferInfo.amount = amount;
        transferInfo.from = msg.sender;
        transferInfo.to = to;
        transferInfo.targetChain = targetChain;
        transferInfo.isExist = true;
        outboundTransfers[nextOutboundTransferId] = transferInfo;

        emit TransferInitiated(
            nextOutboundTransferId,
            msg.sender,
            to,
            amount,
            targetChain
        );
        nextOutboundTransferId = nextOutboundTransferId + 1;
    }

    function confirmTransfer(uint256 transfer_id) public onlyRelayer {
        require(!frozen, "Bridge is frozen by admin");
        require(
            nextConfirmOutboundTransferId < nextOutboundTransferId,
            "All transfers are confirmed"
        );

        require(
            nextConfirmOutboundTransferId == transfer_id,
            "Invalid transfer id"
        );

        TransferInfo memory transferInfo = outboundTransfers[transfer_id];
        payable(address(msg.sender)).transfer(transferInfo.serviceFee);

        nextConfirmOutboundTransferId = nextConfirmOutboundTransferId + 1;
    }

    function releaseToken(
        uint256 transfer_id,
        bytes32 from,
        address to,
        uint256 amount
    ) public onlyRelayer {
        require(!frozen, "Bridge is frozen by admin");
        require(transfer_id == nextInboundTransferId, "Invalid transfer id");
        IBEP20(bholdusToken).transfer(to, amount);
        nextInboundTransferId += 1;
        emit TokensReleased(transfer_id, from, to, amount);
    }

    function getBalance(address addr) public view returns (uint256) {
        return addr.balance;
    }

    function forceRegisterRelayer(address _relayer) public onlyOwner {
        relayers[_relayer] = true;
    }

    function forceUnregisterRelayer(address _relayer) public onlyOwner {
        relayers[_relayer] = false;
    }

    function forceRegisterToken(address _token) public onlyOwner {
        bholdusToken = _token;
    }

    function forceSetFee(uint256 _fee) public onlyOwner {
        serviceFee = _fee;
    }

    function forceWithdrawNative(address payable to) public onlyOwner {
        to.transfer(address(this).balance);
    }

    function forceWithdraw(address to) public onlyOwner {
        IBEP20(bholdusToken).transfer(
            to,
            IBEP20(bholdusToken).balanceOf(address(this))
        );
    }

    function forceRegisterChain(uint16 chain) public onlyOwner {
        chains[chain] = true;
    }

    function forceUnregisterChain(uint16 chain) public onlyOwner {
        chains[chain] = false;
    }

    function forceSetMinDeposit(uint256 amount) public onlyOwner {
        minDeposit = amount;
    }

    function forceFreeze() public onlyOwner {
        frozen = true;
    }

    function forceUnfreeze() public onlyOwner {
        frozen = false;
    }

    modifier onlyRelayer() {
        require(
            relayers[msg.sender] == true,
            "Caller is not the registered relayer"
        );
        _;
    }
}
