'use strict';
require('dotenv').config();
const express = require('express');
const path = require('path');
const serverless = require('serverless-http');
const app = express();
const bodyParser = require('body-parser');

const router = express.Router();
router.get('/', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write('<h1>Hello from Express.js!</h1>');
  res.end();
});
router.get('/another', (req, res) => res.json({ route: req.originalUrl }));

var Airtable = require('airtable');
let airtableBases = {};

router.get('/airtable/getPrecinct', (req, res) => {
  res.append('Access-Control-Allow-Origin', 'https://www.miriamforbrookline.com')

  const baseId = 'appg4XLB1jVJqWHkE';
  const tableName = '2020 Street Precinct Index';

  const { streetNumber: streetNumberQuery, streetName } = req.query;
  const streetNumberMatches = streetNumberQuery.match(/(\d+)([^\d]*)/);
  const streetNumber = parseInt(streetNumberMatches[1]);
  const streetNumberSuffix = streetNumberMatches[2].toUpperCase();

  let base = airtableBases[baseId];
  if (!base) {
    base = new Airtable({apiKey: process.env.AIRTABLE_API_KEY}).base(baseId);
    airtableBases[baseId] = base;
  }

  let ranges = [];
  base(tableName).select({
    // Selecting the first 3 records in Grid view:
    maxRecords: 100,
    view: "Grid view",
    filterByFormula: `{streetName}="${streetName}"`,
    fields: ["rangeStart", "rangeStartSuffix", "rangeEnd", "rangeEndSuffix", "rangeNotes", "precinct"]
  }).eachPage(function page(records, fetchNextPage) {
    // This function (`page`) will get called for each page of records.

    records.forEach(function(record) {
        ranges.push(record);
    });

    // To fetch the next page of records, call `fetchNextPage`.
    // If there are more records, `page` will get called again.
    // If there are no more records, `done` will get called.
    fetchNextPage();

  }, function done(err) {
    if (err) { console.error(err); return; }

    for (let i = 0; i < ranges.length; i++) {
      const { fields } = ranges[i];
      const { rangeStart, rangeStartSuffix, rangeEnd, rangeEndSuffix, rangeNotes, precinct } = fields;

      if (
        (rangeNotes && rangeNotes === '(both sides)' || (streetNumber % 2 === rangeStart % 2)) &&
        streetNumber >= rangeStart && streetNumber <= rangeEnd
      ) {
        res.json({
          streetNumber,
          streetName,
          precinct: parseInt(precinct, 10)
        });
        return;
      }
    };

    res.json({
      streetNumber,
      streetName,
      precinct: -1
    })
  });
});

router.post('/', (req, res) => res.json({ postBody: req.body }));

app.use(bodyParser.json());
app.use('/.netlify/functions/server', router);  // path must route to lambda
app.use('/', (req, res) => res.sendFile(path.join(__dirname, '../index.html')));

module.exports = app;
module.exports.handler = serverless(app);
