const Test = require('../config/testConfig.js');
const truffleAssert = require('truffle-assertions');
const BigNumber = require('bignumber.js');

contract('Flight Surety', async(accounts) => {

    var config;
    const passenger1 = accounts[6];
    const passenger2 = accounts[7];

    let newAirline = accounts[2];
    let newAirline3 = accounts[3];
    let newAirline4 = accounts[4];
    let newAirline5 = accounts[5];
    const notRegisteredAirline = accounts[9];

    const FLIGHT_NUMBER = 'AC110';
    const FLIGHT_TIMESTAMP = '1591878209161'
    const FLIGHT_KEY = '0x9ade82db5b73ee2f831ed8e5250ec1c25ca144e93a2c2763385b823aa4ba5dff'
    const PAYOUT_PERCENTAGE = 150
    const INSURED_AMOUNT = web3.utils.toWei('1', 'Ether')
    const AIRLINE_FUND = web3.utils.toWei('10', 'ether');

    before('setup contract', async() => {
        config = await Test.Config(accounts);
        await config.flightSuretyData.setAuthorizedCaller(config.flightSuretyApp.address);
    })

    describe('Initial funding of the contract', () => {
        it('should send funds to contract', async() => {
            await config.flightSuretyApp.fund({ from: config.firstAirline, value: AIRLINE_FUND })
            const isAirlineFunded = await config.flightSuretyData.isAirlineFunded(config.firstAirline);
            assert.equal(isAirlineFunded, true, 'Airline did not fund the contract');
        })
        it('should not allow to send less than 10 ether for funding', async() => {
            await truffleAssert.reverts(
                config.flightSuretyApp.fund({ from: config.firstAirline, value: web3.utils.toWei('5', 'ether') }),
                'Minimal funding required is 10 ethers'
            )
        })
    })

    describe('registering and voting for airlines', async() => {
        it('should have first airline registered', async() => {
            let firstAirlineRegistered = await config.flightSuretyApp.isAirlineRegistered(config.firstAirline);
            assert.equal(firstAirlineRegistered, true, 'First airline is not registered');
        })

        it('registered airlines can register a new airline', async() => {
            await config.flightSuretyApp.registerAirline(newAirline, { from: config.firstAirline });
            newAirlineRegisterd = await config.flightSuretyApp.isAirlineRegistered(newAirline);
            assert.equal(newAirlineRegisterd, true, 'Airline was not registered');
        });

        it('can register 4 airlines before multi party consensus', async() => {
            await config.flightSuretyApp.registerAirline(newAirline3, { from: config.firstAirline });
            await config.flightSuretyApp.registerAirline(newAirline4, { from: config.firstAirline });
            await config.flightSuretyApp.registerAirline(newAirline5, { from: config.firstAirline });

            const airlineRegisterd3 = await config.flightSuretyApp.isAirlineRegistered(newAirline3);
            const airlineRegisterd4 = await config.flightSuretyApp.isAirlineRegistered(newAirline4);
            const airlineRegisterd5 = await config.flightSuretyApp.isAirlineRegistered(newAirline5);

            assert.equal(airlineRegisterd3, true, 'Airline 3 was not registered');
            assert.equal(airlineRegisterd4, true, 'Airline 4 was not registered');
            assert.equal(airlineRegisterd5, false, 'Airline 5 is registered but should not be');
        })

        it('Multi party consensus completed', async() => {
            // let newAirline4 = accounts[4];
            // let newAirline5 = accounts[5];
            await config.flightSuretyApp.fund({ from: newAirline4, value: AIRLINE_FUND })
            await config.flightSuretyApp.registerAirline(newAirline5, { from: newAirline4 });
            airline5Registerd = await config.flightSuretyApp.isAirlineRegistered(newAirline5);
            assert.equal(airline5Registerd, true, 'Airline 5 was not registered')
        })
    })

    describe('registering flights and buying insurance', () => {
        before(async() => {
            await config.flightSuretyData.setAuthorizedCaller(config.firstAirline);
            await web3.eth.sendTransaction({ from: config.firstAirline, to: config.flightSuretyData.address, value: web3.utils.toWei('10', 'Ether') })
            await config.flightSuretyData.setAuthorizedCaller(config.flightSuretyApp.address);
        });

        it('should register a flight', async() => {
            await config.flightSuretyApp.registerFlight(FLIGHT_NUMBER, FLIGHT_TIMESTAMP, { from: config.firstAirline });
        });

        it('should buy insurance for 1 ether', async() => {
            await config.flightSuretyApp.buy(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, { from: passenger1, value: INSURED_AMOUNT });
            isPassengerInsrured = await config.flightSuretyData.isPassengerInsured(passenger1, FLIGHT_KEY);
            assert.equal(isPassengerInsrured, true, 'Passenger was not marked as insured for this flight');
        });
        it('should not buy insurance for more than 1 ether', async() => {
            await truffleAssert.reverts(
                config.flightSuretyApp.buy(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, { from: passenger1, value: web3.utils.toWei('1.1', 'Ether') }),
                'Insurance price must be greater then 0 but lower then 1 ether'
            )
        });

        it('payout only possible for insured passengers', async() => {
            await truffleAssert.reverts(
                config.flightSuretyApp.pay(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, { from: passenger2 }),
                'Passenger not insured.'
            )
        });
        it('insured passenger payout', async() => {
            await config.flightSuretyData.setAuthorizedCaller(config.owner);
            await config.flightSuretyData.creditInsurees(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, PAYOUT_PERCENTAGE);
            await config.flightSuretyData.setAuthorizedCaller(config.flightSuretyApp.address);

            let balanceBeforePayout = BigNumber(await web3.eth.getBalance(passenger1));
            let tx = await config.flightSuretyApp.pay(config.firstAirline, FLIGHT_NUMBER, FLIGHT_TIMESTAMP, { from: passenger1 });
            let gasPrice = BigNumber(await web3.eth.getGasPrice())
            let txGasFee = BigNumber(tx.receipt.gasUsed * gasPrice)
            let endBalance = BigNumber(await web3.eth.getBalance(passenger1));
            let payout = BigNumber(web3.utils.toWei('1.5', 'ether'));
            let currentBalance = balanceBeforePayout.minus(txGasFee).plus(payout);

            assert.equal(endBalance.isEqualTo(currentBalance), true, 'Payout did not happend');
        });
    });
});