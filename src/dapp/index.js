import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async() => {
    let contract = new Contract('localhost', () => {
        const FLIGHT_STATUS_CODES = {
            0: 'Unknown',
            10: 'On Time',
            20: 'Late Airline',
            30: 'Late Weather',
            40: 'Late Technical',
            50: 'Late (Other)'
        };

        document.addEventListener("OracleReportEvent", function(e) {
            let flightStatus = FLIGHT_STATUS_CODES[e.detail]
            smallerDisplay([{ label: 'Oracle Report Event', value: flightStatus }]);
        });

        document.addEventListener("FlightStatusInfo", function(e) {
            let flightStatus = FLIGHT_STATUS_CODES[e.detail]
            smallerDisplay([{ label: 'Final Flight Status:', value: flightStatus }]);
        });

        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error, result);
            display('Operational Status', 'Check if contract is operational', [{ label: 'Operational Status', error: error, value: result }]);
        });

        // User-submitted transaction
        DOM.elid('submit-oracle').addEventListener('click', () => {
            let ele = DOM.elid("flights-oracle");
            let flight = ele.options[ele.selectedIndex].value;
            let number = flight.split(' |')[0]
            let timestamp = flight.split('| ')[1]
                // Write transaction
            contract.fetchFlightStatus(number, timestamp, (error, result) => {
                display('Oracles', 'Trigger oracles', [{ label: 'Fetch Flight Status', error: error, value: result.flight + ' ' + result.timestamp }]);
            });
        })

        DOM.elid('buy-insurance').addEventListener('click', () => {
            const ele = DOM.elid("flights");
            const flight = ele.options[ele.selectedIndex].value;
            const timestamp = flight.split('| ')[1]
            const number = flight.split(' |')[0]
            const title = 'Insurance';
            const description = 'Purchased';
            let value = DOM.elid('insurance-amount').value;
            console.log('VALUE', value);

            if (value == '') {
                value = '0'
            }

            contract.buyInsurance(number, timestamp, value, (error, result) => {
                if (error) {
                    display(title, description, [{ label: 'Error!', error }]);
                } else {
                    display(title, description, [{ label: 'Success!', value: `You are now insured on flight: ${result.flight} | ${result.timestamp}` }]);
                }
            });
        })
    });
})();


function display(title, description, results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    section.appendChild(DOM.h2(title));
    section.appendChild(DOM.h5(description));
    results.map((result) => {
        let row = section.appendChild(DOM.div({ className: 'row' }));
        row.appendChild(DOM.div({ className: 'col-sm-4 field' }, result.label));
        row.appendChild(DOM.div({ className: 'col-sm-8 field-value' }, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);
}

function smallerDisplay(results) {
    let displayDiv = DOM.elid("display-wrapper");
    let section = DOM.section();
    results.map((result) => {
        let row = section.appendChild(DOM.div({ className: 'row' }));
        row.appendChild(DOM.div({ className: 'col-sm-4 field' }, result.label));
        row.appendChild(DOM.div({ className: 'col-sm-8 field-value' }, result.error ? String(result.error) : String(result.value)));
        section.appendChild(row);
    })
    displayDiv.append(section);
}