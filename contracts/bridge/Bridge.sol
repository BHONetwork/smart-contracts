//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

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

contract Bridge {
    address public admin;
    address public relayer;
    IERC20 public bholdusToken = IERC20(0xf4275FD572398215ea31e630832C9652E59051E9);

    struct TransferInfo {
        address from;
        bytes32 to;
        uint256 amount;
        uint16 target_chain;
        uint256 service_fee;
    }

    uint32 next_outbound_transfer_id = 0;
    uint32 next_confirmed_outbound_transfer_id = 0;
    uint32 next_inbound_transfer_id = 0;
    uint256 service_fee = 10;

    event TransferInitiated(uint256 indexed transfer_id, address from, bytes32 to, uint256 amount, uint256 target_chain);
    event TokensReleased(uint256 indexed transfer_id, bytes32 from, address to, uint256 indexed amount);

    mapping(uint256 => TransferInfo) _transferInfo;

    constructor(
        address _admin,
        address _relayer
    ){
        admin = _admin;
        relayer = _relayer;
    }

    function initiateTransfer(bytes32 to, uint256 amount, uint16 target_chain) public payable{
        require(msg.value > 0, "Require fee to execute transaction");
        IERC20(bholdusToken).transferFrom(msg.sender, address(this), amount);
        next_outbound_transfer_id = next_outbound_transfer_id + 1;
        TransferInfo memory transferInfo;
        transferInfo.service_fee = msg.value;
        _transferInfo[next_outbound_transfer_id] = transferInfo;
        emit TransferInitiated(next_outbound_transfer_id, msg.sender, to, amount, target_chain);
    }

    function confirmTransfer(uint256 transfer_id) public onlyRelayer{
        TransferInfo memory transferInfo = _transferInfo[transfer_id];
        require(transferInfo.from != msg.sender, "Incorrect transferID outbound");
        IERC20(bholdusToken).transferFrom(address(this), msg.sender, transferInfo.service_fee);
    }

    function releaseToken(uint256 transfer_id, bytes32 from, address to, uint256 amount) public onlyRelayer{
        require(transfer_id == next_inbound_transfer_id, "Incorrect inbound transferID");
        IERC20(bholdusToken).approve(address(this), amount);
        IERC20(bholdusToken).transferFrom(address(this), msg.sender, amount);
        next_inbound_transfer_id += 1;
        emit TokensReleased(transfer_id, from, to, amount);
    }

    function getBalance(address addr) public view returns(uint256){
        return addr.balance;
    }

    function forceRegisterRelayer(address _relayer) public{
        relayer = _relayer;
    }

    function forceUnregisterRelayer(address _relayer) public{
        
    }

    function forceRegisterToken(address _token) public{
        bholdusToken = IERC20(_token);
    }
    
    modifier onlyRelayer() {
        require(msg.sender == relayer, "Caller is not the relayer");
        _;
    }
}