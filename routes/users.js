const express = require('express');
const router = express.Router();

// router.get('/', (req, res, next) => {
//   res.send(`<h2>Welcome ${req.query.username ? req.query.username : "Person"}</h2>`);
// });

router.get('/', (req, res, next) => {
  if(!req.query.username) next('route');
  res.send(`<h2>Welcome ${req.query.username}</h2>`);
  next();
})

module.exports = router;
