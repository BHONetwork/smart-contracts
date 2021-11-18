//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IERC20 {
    function balanceOf(address owner) external view returns (uint256);

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function transfer(address to, uint256 value) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}

contract Bridge is OwnableUpgradeable, UUPSUpgradeable{ 
    address public admin;
    mapping(address => bool) public relayer;
    uint256 public service_fee;
    IERC20 public bholdusToken = IERC20(0xf4275FD572398215ea31e630832C9652E59051E9);

    struct TransferInfo {
        address from;
        bytes32 to;
        uint256 amount;
        uint16 target_chain;
        uint256 service_fee;
    }

    uint256 public next_outbound_transfer_id = 0;
    uint256 public next_confirmed_outbound_transfer_id = 0;
    uint256 public next_inbound_transfer_id = 0;

    event TransferInitiated(uint256 indexed transfer_id, address indexed from, bytes32 indexed to, uint256 amount, uint256 target_chain);
    event TokensReleased(uint256 indexed transfer_id, bytes32 indexed from, address indexed to, uint256 amount);

    mapping(uint256 => TransferInfo) public _transferInfo;

    function initialize(address _admin,
        address _token,
        uint256 _fee
        ) public initializer returns (bool) {
        __Ownable_init();
        __UUPSUpgradeable_init();

        admin = _admin;
        bholdusToken = IERC20(_token);
        service_fee = _fee;

        return true;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    function initiateTransfer(bytes32 to, uint256 amount, uint16 target_chain) public payable{
        require(msg.value == service_fee, "Missing service fee");
        IERC20(bholdusToken).transferFrom(msg.sender, address(this), amount + msg.value);
        
        //set transfer info
        TransferInfo memory transferInfo;
        transferInfo.service_fee = msg.value;
        transferInfo.amount = amount;
        transferInfo.from = msg.sender;
        transferInfo.to = to;
        transferInfo.target_chain = target_chain;
        _transferInfo[next_outbound_transfer_id] = transferInfo;
        
        emit TransferInitiated(next_outbound_transfer_id, msg.sender, to, amount, target_chain);
        next_outbound_transfer_id = next_outbound_transfer_id + 1;
    }

    function confirmTransfer(uint256 transfer_id) public onlyRelayer{
        require(next_confirmed_outbound_transfer_id < next_outbound_transfer_id, 'Incorrect outbound id');
        TransferInfo memory transferInfo = _transferInfo[transfer_id];
        IERC20(bholdusToken).approve(address(this),  transferInfo.service_fee);
        IERC20(bholdusToken).transferFrom(address(this), msg.sender, transferInfo.service_fee);
        next_confirmed_outbound_transfer_id = next_confirmed_outbound_transfer_id + 1;
    }

    function releaseToken(uint256 transfer_id, bytes32 from, address to, uint256 amount) public onlyRelayer{
        require(transfer_id == next_inbound_transfer_id, "Incorrect inbound transferID");
        IERC20(bholdusToken).approve(address(this), amount);
        IERC20(bholdusToken).transferFrom(address(this), to, amount);
        next_inbound_transfer_id += 1;
        emit TokensReleased(transfer_id, from, to, amount);
    }

    function getBalance(address addr) public view returns(uint256){
        return addr.balance;
    }

    function forceRegisterRelayer(address _relayer) public onlyOwner{
        relayer[_relayer] = true;
    }

    function checkRegisterRelayer(address _relayer) public view returns(bool){
        return relayer[_relayer];
    }

    function forceUnregisterRelayer(address _relayer) public onlyOwner{
        
    }

    function forceRegisterToken(address _token) public onlyOwner{
        bholdusToken = IERC20(_token);
    }

    function setFee(uint256 _fee) public onlyOwner{
        service_fee = _fee;
    }

    function getTransferInfo(uint256 transfer_id) public view returns(TransferInfo memory){
        return _transferInfo[transfer_id];
    }
    
    modifier onlyRelayer() {
        require(relayer[msg.sender] == true, "Caller is not the relayer");
        _;
    }
}