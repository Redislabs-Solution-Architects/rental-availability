/**
 * @fileoverview Utility for loading address and zip info into Redis
 * 
 */

import { createClient, SchemaFieldTypes } from 'redis';
import { uniqueNamesGenerator, names } from 'unique-names-generator';
import { parse } from 'csv-parse';
import fs from 'node:fs';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const TYPES = ['office', 'field', 'court', 'classroom', 'auditorium'];
const MAX_PROPERTIES = 100000;

class Loader {

    /**
    * Main public function.  Establishes a Redis connection, builds a search index, inserts
    * zip codes and their associated lat/longs as Redis Strings, and inserts properties as Redis JSON
    * documents.
    */
    async load() {
        this.client = createClient({url: redisUrl});
        this.client.on('error', (err) => {
            console.error(err.message);
        }); 
        await this.client.connect();
        await this.#index();
        await this.#insertZips();
        await this.#insertProperties();

        await this.client.set('load-complete', 'true');
        await this.client.disconnect();
    }

    /**
    * Private function for generating non-overlapping availability dates for a property.  Returns a random
    * number of date/times (up to 50).  Dates are converted to UNIX timestamps.
    * @returns {Array<Date>} 
    */
    #getAvailability() {
        let availability = [];
        const num_dates = Math.floor(Math.random() * 50) + 1;  // up to 50 availability dates
        let begin = new Date();
        for (let i=0; i < num_dates; i++) {
            begin.setDate(begin.getDate() + Math.floor(Math.random() * 30));  //random avail begin date up to 30 days from now
            begin.setHours(Math.floor(Math.random() * 24), 0, 0, 0)  //random hour for that date
            let end = new Date(begin)
            end.setHours(begin.getHours() + Math.floor(Math.random() * 8))  //random end time.  up to 8 hours after the avail begin
            availability.push({"begin": Math.floor(begin.getTime()/1000), "end": Math.floor(end.getTime()/1000)});
            begin = new Date(end);  //establishes an increasing sequence of dates.  non-overlapping
        }
        return availability;
    }

    /**
    * Private function for reading a csv file of addresses and then adding fictional owner and availability
    * date ranges.  The resulting documents are written to Redis as JSON.
    */
    async #insertProperties() {
        const csvStream = fs.createReadStream("./data/co.csv").pipe(parse({ delimiter: ",", from_line: 2}));
        let id = 1;
        for await (const row of csvStream) {
            const doc = {
                "id": id,
                "address": {
                    "coords": `${row[0]} ${row[1]}`,
                    "number": row[2],
                    "street": row[3],
                    "unit": row[4],
                    "city": row[5],
                    "state": "CO",
                    "postcode": row[8]
                },
                "owner": {
                    "fname": uniqueNamesGenerator({dictionaries: [names], style: 'capital', length: 1, separator: ' '}),
                    "lname": uniqueNamesGenerator({dictionaries: [names], style: 'capital', length: 1, separator: ' '}),
                },
                "type": `${TYPES[Math.floor(Math.random() * TYPES.length)]}`,
                "availability": this.#getAvailability(),
                "rate": Math.round((Math.random() * 250 + 125) * 100) / 100
            }
            await this.client.json.set(`property:${id}`, '.', doc);
            id++;
            if (id > MAX_PROPERTIES) {
                break;
            }
        }

    }

    /**
    * Private function for reading a csv file of zip codes and geographic coordinates.  Results are
    * written to Redis as Strings.
    */
    async #insertZips() {
        const csvStream = fs.createReadStream("./data/zip_lat_long.csv").pipe(parse({ delimiter: ",", from_line: 2}));
        for await (const row of csvStream) {
            const zip = row[0];
            const lat = row[1];
            const lon = row[2];
            await this.client.set(`zip:${zip}`, `${lon} ${lat}`);
        }
    }

    /**
    * Private function for creating a Redis Search index on the properties that are stored as JSON documents
    * in Redis.
    */
    async #index() {
        try {
            await client.ft.dropIndex('propIdx');
        }
        catch (err) {};

        await this.client.ft.create('propIdx', {
            '$.address.coords': {
                type: SchemaFieldTypes.GEO,
                AS: 'coords',
                SORTABLE: true
            },
            '$.rate': {
                type: SchemaFieldTypes.NUMERIC,
                AS: 'rate',
                SORTABLE: true
            },
            '$.type': {
                type: SchemaFieldTypes.TAG,
                AS: 'type'
            },
            '$.availability[*].begin': {
                type: SchemaFieldTypes.NUMERIC,
                AS: 'begin'
            },
            '$.availability[*].end': {
                type: SchemaFieldTypes.NUMERIC,
                AS: 'end'
            }
        }, { ON: 'JSON', PREFIX: 'property:'});
    }
}

(async () => {
    console.log('loader - data load started');
    const loader = new Loader();
    await loader.load();
    console.log('loader - data load complete');
})();