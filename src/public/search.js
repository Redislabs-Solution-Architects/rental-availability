/**
 * @fileoverview JS file containing the form action for the GUI.  Executes a REST API 
 * call to the Express server. In this case, the Search endpoint.
 */

'use strict';

function val(id) {
    return document.getElementById(id).value;
}

function hide(id) {
    id.innerHTML = '';
}

async function search() {
    const url = 'http://localhost:8000/property/search';
    const beginTS = Math.floor((new Date(val('begin'))).getTime()/1000);
    const endTS = Math.floor((new Date(val('end'))).getTime()/1000);
    const input = {
        "type": val('type'),
        "zip": val('zip'),
        "radius": val('radius'),
        "begin": beginTS,
        "end": endTS
    };
    const searchStart = Date.now();
    const response = await fetch(url, {
       method: "POST",
       headers: {
        "Content-Type": "application/json"
       }, 
       body: JSON.stringify(input)
    });
    const searchStop = Date.now();

    const properties = await response.json();
    let results;
    if (properties) {
        results = `First ${properties.length} Matching Properties Sorted by Ascending Rate<br>`;
        results += `Timestamp Range: ${beginTS} - ${endTS}<br>`;
        results += `Search RTT: ${searchStop - searchStart} ms<br><br>`;
        for (const property of properties) {
            results += `Key: ${property.key}<br>`;
            results += `Hourly Rate: $${property.rate}<br>`;
            results += `Availability Start: ${(new Date(property.begin*1000)).toString()} (${property.begin})<br>`;
            results += `Availability End: ${(new Date(property.end*1000)).toString()} (${property.end})<br><br>`;
        } 
    }
    else {
        results = 'No properties found'
    }
    document.getElementById('results').innerHTML = results
}

window.addEventListener('DOMContentLoaded', () => {
    hide(document.getElementById('results'));
});