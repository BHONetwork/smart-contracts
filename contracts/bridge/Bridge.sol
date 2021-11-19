//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../token/BEP20/IBEP20.sol";

contract Bridge is OwnableUpgradeable, UUPSUpgradeable {
    struct TransferInfo {
        uint256 amount;
        uint256 service_fee;
        address from;
        bytes32 to;
        uint16 target_chain;
        bool is_exist;
    }

    mapping(uint256 => TransferInfo) public outboundTransfers;
    mapping(address => bool) public relayers;
    mapping(uint16 => bool) public chains;
    uint256 public next_outbound_transfer_id;
    uint256 public next_confirm_outbound_transfer_id;
    uint256 public next_inbound_transfer_id;
    uint256 public service_fee;
    address public bholdus_token;

    event TransferInitiated(
        uint256 indexed transfer_id,
        address indexed from,
        bytes32 indexed to,
        uint256 amount,
        uint16 target_chain
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
        uint256 _fee
    ) public initializer returns (bool) {
        __Ownable_init();
        __UUPSUpgradeable_init();

        bholdus_token = _token;
        service_fee = _fee;

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
        uint16 target_chain
    ) public payable {
        require(chains[target_chain], "Unsupported chain");
        require(msg.value == service_fee, "Missing service fee");
        IBEP20(bholdus_token).transferFrom(msg.sender, address(this), amount);

        //set transfer info
        TransferInfo memory transferInfo;
        transferInfo.service_fee = msg.value;
        transferInfo.amount = amount;
        transferInfo.from = msg.sender;
        transferInfo.to = to;
        transferInfo.target_chain = target_chain;
        transferInfo.is_exist = true;
        outboundTransfers[next_outbound_transfer_id] = transferInfo;

        emit TransferInitiated(
            next_outbound_transfer_id,
            msg.sender,
            to,
            amount,
            target_chain
        );
        next_outbound_transfer_id = next_outbound_transfer_id + 1;
    }

    function confirmTransfer(uint256 transfer_id) public onlyRelayer {
        require(
            next_confirm_outbound_transfer_id < next_outbound_transfer_id,
            "All transfers are confirmed"
        );

        require(
            next_confirm_outbound_transfer_id == transfer_id,
            "Invalid transfer id"
        );

        TransferInfo memory transferInfo = outboundTransfers[transfer_id];
        payable(address(msg.sender)).transfer(transferInfo.service_fee);

        next_confirm_outbound_transfer_id =
            next_confirm_outbound_transfer_id +
            1;
    }

    function releaseToken(
        uint256 transfer_id,
        bytes32 from,
        address to,
        uint256 amount
    ) public onlyRelayer {
        require(transfer_id == next_inbound_transfer_id, "Invalid transfer id");
        IBEP20(bholdus_token).transfer(to, amount);
        next_inbound_transfer_id += 1;
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
        bholdus_token = _token;
    }

    function forceSetFee(uint256 _fee) public onlyOwner {
        service_fee = _fee;
    }

    function forceWithdrawNative(address payable to) public onlyOwner {
        to.transfer(address(this).balance);
    }

    function forceWithdraw(address to) public onlyOwner {
        IBEP20(bholdus_token).transfer(
            to,
            IBEP20(bholdus_token).balanceOf(address(this))
        );
    }

    function forceRegisterChain(uint16 chain) public onlyOwner {
        chains[chain] = true;
    }

    function forceUnregisterChain(uint16 chain) public onlyOwner {
        chains[chain] = false;
    }

    modifier onlyRelayer() {
        require(
            relayers[msg.sender] == true,
            "Caller is not the registered relayer"
        );
        _;
    }
}
