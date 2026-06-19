const express = require('express');
const router = express.Router();

const stockController = require('../controllers/stockController');
const auth = require('../middleware/auth');

// 📊 STOCK MOVEMENT HISTORY
router.get('/', auth, stockController.history);

module.exports = router;