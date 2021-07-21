const Test = require('../config/testConfig.js');
const truffleAssert = require('truffle-assertions');

contract('Oracles', async(accounts) => {

    const TEST_ORACLES_COUNT = 20;
    const ORACLE_ACCOUNT_START_INDEX = 30;
    const FLIGHT_NUMBER = 'AC110';
    const FLIGHT_TIMESTAMP = '1626280168'

    let passenger = accounts[2];
    let requestedOracleIndex;

    let config;
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

    before('setup contract', async() => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.setAuthorizedCaller(config.flightSuretyApp.address);
    });

    describe('Register oracle and request flight status', () => {
        it('can register oracles', async() => {
            // ARRANGE
            const registrationFee = await config.flightSuretyApp.REGISTRATION_FEE.call();
            let accIndex = ORACLE_ACCOUNT_START_INDEX;

            // ACT
            for (let i = 1; i < TEST_ORACLES_COUNT; i++) {
                await config.flightSuretyApp.registerOracle({ from: accounts[accIndex], value: registrationFee });
                const result = await config.flightSuretyApp.getMyIndexes.call({ from: accounts[accIndex] });

                assert.equal(web3.utils.isBN(result[0]), true, 'Index 0 is not set');
                assert.equal(web3.utils.isBN(result[1]), true, 'Index 1 is not set');
                assert.equal(web3.utils.isBN(result[2]), true, 'Index 2 is not set');

                oracles[result[0]].push(accounts[accIndex]);
                oracles[result[1]].push(accounts[accIndex]);
                oracles[result[2]].push(accounts[accIndex]);

                accIndex += 1;
            }
        });

        it('flight needs to be registered before fetching its status from oracles', async() => {
            await truffleAssert.reverts(
                config.flightSuretyApp.fetchFlightStatus(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, { from: passenger }),
                'Flight is not registered'
            )
        });
        it('should get flight status update from oracles', async() => {
            await config.flightSuretyApp.registerFlight(FLIGHT_NUMBER, FLIGHT_TIMESTAMP, { from: config.firstAirline });

            const tx = await config.flightSuretyApp.fetchFlightStatus(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, { from: passenger });

            truffleAssert.eventEmitted(tx, 'OracleRequest', (event) => {
                indexHasOracle = oracles[event.index].length > 0;
                requestedOracleIndex = event.index.toString(10);
                return indexHasOracle &&
                    (event.airline == config.firstAirline) &&
                    (event.flight == FLIGHT_NUMBER) &&
                    (event.timestamp == FLIGHT_TIMESTAMP);
            })
        });
    });
});