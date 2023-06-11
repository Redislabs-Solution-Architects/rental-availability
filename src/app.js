import { createClient, AggregateSteps } from 'redis';
import express from 'express';
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.APP_PORT || 8000;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
var client;
const app = express();
app.use(express.json());

/**
 * Static html/js files
 */
app.get('/', async(req, res) => {
    if (!await client.exists('load-complete')) {
        res.status(400).send('Data Load in Progress');
    }
    else {
        res.status(200).sendFile(path.join(__dirname,'./public', 'index.html'));
    }
});
app.use(express.static('./public'));

/**
 * This route implements a Redis aggregation on the properties stored as JSON documents.  It first finds the geographic
 * coords for the zip code input.  The property type and resulting zip coords are then used as a query to an aggregation
 * which then performs JSONPath filtering to find matching properties with availability meeting the input begin and end date/times.
 */
app.post('/property/search', async (req, res) => {
    const { type, zip, radius, begin, end } = req.body;
    console.log(`app - POST /property/search ${JSON.stringify(req.body)}`);
    
    try {
        const loc = await client.get(`zip:${zip}`);
        if (!loc) {
            throw new Error('Zip code not found');
        }
        const query = `@type:{${type}} @coords:[${loc} ${radius} mi]`;
        const docs = await client.ft.aggregate('propIdx', query,
            {
                DIALECT: 3,
                LOAD: [
                        '@__key',
                        { identifier: `$.availability[?(@.begin<=${begin} && @.end>=${end})]`,
                            AS: 'match'
                        }
                ],
                STEPS: [
                    {   type: AggregateSteps.FILTER,
                        expression: 'exists(@match)'
                    },
                    {
                        type: AggregateSteps.SORTBY,
                        BY: {
                            BY: '@rate',
                            DIRECTION: 'ASC'
                        }
                    },
                    {
                        type: AggregateSteps.LIMIT,
                        from: 0,
                        size: 3
                    }
                ]
                
            }); 
            
        if (docs && docs.results) {
            let properties = [];
            for (const result of docs.results) {
                const rental_date = JSON.parse(result.match);
                const property = {
                    "key": result.__key,
                    "rate": result.rate,
                    "begin": rental_date[0].begin,
                    "end": rental_date[0].end
                };
                properties.push(property);
            }
            console.log(`app - POST /property/search - properties found: ${properties.length}`);
            res.status(200).json(properties);
        }
        else {
            console.log('app - POST /property/search - no properties found');
            res.status(401).send('No properties found');
        }
    }
    catch (err) {
        console.log(`app - POST /property/search - error: ${err.message}`);
        res.status(400).json({ 'error': err.message });
    }
});

app.listen(port, async () => {
    client = createClient({url: redisUrl});
    client.on('error', (err) => {
        console.error(err.message);
    });  
    await client.connect();
    if (!await client.exists('load-complete')) {
        new Worker('./load.js');  //worker thread to load Redis with the input .csv files
    }
    console.log(`Server is up - http://localhost:${port}`)
});