const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

// const pool = async () => {
//     try{
//         await mongoose.connect(process.env.DB_URI);
//     }catch(err){
//         console.error(err);
//     }
// } 
const client = new MongoClient(process.env.DB_URI);
const pool = async () => {
    try {
      await client.connect();
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
    }
  }
module.exports = pool;
