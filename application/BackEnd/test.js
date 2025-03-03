const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: "Test passed" }); // Send the message in an object
});

module.exports = router;
