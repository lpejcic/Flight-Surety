pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;
    using SafeMath for uint8;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    address private authorizedCaller;
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false

    struct Insurance {
        uint256 paid;
        uint256 insurancePayout;
    }

    mapping(address => bool) public registeredAirlines;
    mapping(address => uint256) fundedAirlines;
    mapping(bytes32 => address[]) passengers;
    mapping(bytes32 => mapping(address => Insurance)) flights;

    event InsurancePayoutPaid(address passenger, uint256 payment);

    uint8 public airlineRegisteredCounter = 1;


    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/


    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(address firstAirline) public {
        contractOwner = msg.sender;
        registeredAirlines[firstAirline] = true;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAuthorizedCaller() {
        require(msg.sender == authorizedCaller, "Caller is not an authorized caller");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/
    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */
    function isOperational() public view returns(bool) {
        return operational;
    }

    function isPassengerInsured(address passenger, bytes32 flightKey) public view returns(bool) {
        Insurance memory insured = flights[flightKey][passenger];
        return insured.paid > 0;
    }

    function isAirlineRegistered(address airline) public view returns(bool) {
        return registeredAirlines[airline];
    }

    function isAirlineFunded(address airline) public view returns(bool) {
        return fundedAirlines[airline] > 0;
    }


    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function setAuthorizedCaller(address appContract) requireContractOwner external {
        authorizedCaller = appContract;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline(address airline) external requireAuthorizedCaller requireIsOperational {
        registeredAirlines[airline] = true;
        airlineRegisteredCounter = uint8(airlineRegisteredCounter.add(1));
    }

    /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund(address airline) requireIsOperational requireAuthorizedCaller public payable {
        fundedAirlines[airline] = msg.value;
    }


    function buy(address passenger, address airline, string flight, uint256 timestamp)
        requireIsOperational 
        requireAuthorizedCaller 
        external payable 
        {

        bytes32 _key = getFlightKey(airline, flight, timestamp);
        require(!isPassengerInsured(passenger, _key), 'Insurance already bought');

        Insurance memory insured = Insurance({
            paid: msg.value,
            insurancePayout: 0
        });

        flights[_key][passenger] = insured;
        passengers[_key].push(passenger);
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees(address airline, string flight, uint256 timestamp, uint8 percentage)
        requireAuthorizedCaller 
        requireIsOperational 
        external 
        {

        bytes32 _key = getFlightKey(airline, flight, timestamp);
        for (uint256 i = 0; i < passengers[_key].length; i++) {
            address passenger = passengers[_key][i];
            flights[_key][passenger].insurancePayout = flights[_key][passenger].paid.mul(percentage).div(100);
        }
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay(address passenger, address airline, string flight, uint256 timestamp)
        requireAuthorizedCaller 
        requireIsOperational 
        external 
        {

        bytes32 _key = getFlightKey(airline, flight, timestamp);
        require(isPassengerInsured(passenger, _key), 'Passenger not insured.');
        require(flights[_key][passenger].insurancePayout > 0, 'There is no payout for this passenger.');

        uint256 payment = flights[_key][passenger].insurancePayout;
        flights[_key][passenger].insurancePayout = 0;
        address(uint160(passenger)).transfer(payment);
        emit InsurancePayoutPaid(passenger, payment);
    }

    function getFlightKey(address airline, string memory flight, uint256 timestamp) public pure returns(bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() external payable {
        fund(msg.sender);
    }
}
