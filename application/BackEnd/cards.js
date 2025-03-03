const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
// const client = require('./config/database.js');
const { MongoClient } = require('mongodb');
const client = new MongoClient(process.env.DB_URI);
// const querystring = require('node:querystring');
const { URLSearchParams } = require('url');

// router.get('/', (req, res, next) => {
//     res.json({ message: " passed" }); // Send the message in an object

// });

router.get('/', async function(req, res, next) {
    const searchParams = new URLSearchParams(req.query);
    const searchString = searchParams.get('search');
    const type = searchParams.get('t');
    const search = new RegExp(searchString, "i");

  console.log("type: ", type);
    try {
        const db = client.db("aquamatedb");

        let searchResultsFauna = [];
        let searchResultsFlora = [];
        let searchResultsTank = [];

        const collectionFauna = db.collection('fauna');
        const collectionFlora = db.collection('flora');
        const collectionTank = db.collection('tank');

        if(type === 'fauna' || type === null){
            const searchResultsCursorFauna = await collectionFauna.find({ $or: [{ commonName: { $regex: search } }, { scientificName: { $regex: search } }] });
            searchResultsFauna = await searchResultsCursorFauna.toArray();
        }
        
        if(type === 'flora' || type === null){
            const searchResultsCursorFlora = await collectionFlora.find({ $or: [{ commonName: { $regex: search } }, { scientificName: { $regex: search } }] });
            searchResultsFlora = await searchResultsCursorFlora.toArray();
        }

        if(type === 'tank' || type === null){
            const searchResultsCursorTank = await collectionTank.find({ shape: { $regex: search } });
            searchResultsTank = await searchResultsCursorTank.toArray();
        }

        const searchResults = searchResultsFauna.concat(searchResultsFlora, searchResultsTank);

        //does not return everything if nothing found for a particular type
        if (searchResults.length == 0 && type === null) {
            console.log('search: ', search);
            console.log("No Docs found.");

            // returns everything if query found nothing
            const resultsCursorFauna = await collectionFauna.find({});
            const resultsCursorFlora = await collectionFlora.find({});
            const resultsCursorTank = await collectionTank.find({});
            const resultsFauna = await resultsCursorFauna.toArray();
            const resultsFlora = await resultsCursorFlora.toArray();
            const resultsTank = await resultsCursorTank.toArray();
            const results =  resultsFauna.concat(resultsFlora, resultsTank);
            res.json(results);
            for await (const doc of results) {
                console.dir(doc);
            }
        }else{
            console.log('searchFound: ',search);
            res.json(searchResults);
        }
        // const doc = searchResults[0];
        // console.dir(doc);
        for await (const doc of searchResults) {
            console.dir(doc);
        }

    } catch (error) {
        console.error('Error searching MongoDB:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }

})

module.exports = router;