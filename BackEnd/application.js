require('dotenv').config()
const express = require('express');
const app = express();
const testRouter = require('./test.js');
const cardsRouter = require('./cards.js');
const mongoose = require('mongoose');
const db = require('./config/database.js');
const pool = require('./config/database.js');
const connectToDatabase = require('./config/database.js');
const cors = require('cors');
const path = require("path");

const PORT = process.env.PORT || 8080;
pool();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

app.use(cors());

//Remove when running on server
//Keep when running on local host
/*
const corsOptions = {
    origin: 'http://localhost:8080', // This allows only requests from this origin

};

app.use(cors(corsOptions));
*/
//END cors options for server vs local

app.use('/test', testRouter);
app.use('/cards', cardsRouter);
app.use('/search', cardsRouter);
app.use('/search', cardsRouter);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const root = path.join(__dirname, '../react-app/build');
app.use(express.static(root));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../react-app/build", "index.html"))
})

// there should only be 1 listen
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });

module.exports = app;