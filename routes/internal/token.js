const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper');

const router = express.Router();

require(rootPrefix + '/app/services/token/aggregatedDetails');

/* Get aggregated token details*/
router.get('/details', function(req, res, next) {
  req.decodedParams.apiName = 'tokenDetailsAggregated';

  Promise.resolve(routeHelper.perform(req, res, next, 'TokenAggregatedDetails', 'r_it_1'));
});

module.exports = router;