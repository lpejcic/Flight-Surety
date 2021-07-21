import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

let registeredAirline;
const ORACLES_COUNT = 20;
const ORACLE_ACCOUNT_START_INDEX = 30;
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;
const STATUS_CODES = [STATUS_CODE_UNKNOWN, STATUS_CODE_ON_TIME, STATUS_CODE_LATE_AIRLINE, STATUS_CODE_LATE_WEATHER, STATUS_CODE_LATE_TECHNICAL, STATUS_CODE_LATE_OTHER];

console.log('The App Contract Address: ', config.appAddress);
console.log('Web3 Version', web3.version);

flightSuretyApp.events.OracleRequest({
    fromBlock: 0
}, function(error, event) {
    if (error) console.log(error)
    fetchFlightStatus(event.returnValues);
});

let accounts;
let flights = [
    ['AA111', '1626280168'],
    ['AA222', '1636280158'],
    ['AA333', '1626270158'],
    ['2G111', '1626280258'],
    ['DL111', '1626280187'],
    ['DL222', '1626280218'],
    ['US111', '1626280198'],
    ['US222', '1626280658'],
    ['CP111', '1624880158']
];
let oracles = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
    8: [],
    9: [],
};

const registerOracles = async() => {
    let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
    let accountIndex = ORACLE_ACCOUNT_START_INDEX;

    for (let i = 1; i < ORACLES_COUNT; i++) {
        await flightSuretyApp.methods.registerOracle().send({ from: accounts[accountIndex], gas: 30000000, value: fee });
        let result = await flightSuretyApp.methods.getMyIndexes().call({ from: accounts[accountIndex] });
        oracles[result[0]].push(accounts[accountIndex]);
        oracles[result[1]].push(accounts[accountIndex]);
        oracles[result[2]].push(accounts[accountIndex]);
        accountIndex += 1;
    }

    console.log('Oracles registered', oracles);
    return true;
}

const registerFlights = async() => {
    flights.forEach(async flight => {
        await flightSuretyApp.methods.registerFlight(flight[0], flight[1]).send({ from: registeredAirline, gas: 30000000 });
    });
}

const fetchFlightStatus = async(request) => {
    for (let i = 0; i < oracles[request.index].length; i++) {
        let status = STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)]; // Random status
        try {
            await flightSuretyApp.methods.submitOracleResponse(request.index, request.airline, request.flight, request.timestamp, status).send({ from: oracles[request.index][i], gas: 30000000 });
        } catch (error) {
            console.error("Oracle error:", error);
        }
    }
}

// Init
(async() => {
    accounts = await web3.eth.getAccounts();
    web3.eth.defaultAccount = accounts[0];
    registeredAirline = accounts[1];
    await registerOracles();
    await registerFlights();
})();

const app = express();
app.get('/api', (req, res) => {
    res.send({
        message: 'An API for use with your Dapp!'
    })
})

export default app;