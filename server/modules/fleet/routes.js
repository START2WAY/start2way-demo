const express = require('express');
const router = express.Router();
const FleetAIService = require('./services/FleetAIService');

router.post('/ai/chat', FleetAIService.handleChat);

module.exports = router;
