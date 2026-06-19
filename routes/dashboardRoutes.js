const router = require('express').Router();
const auth = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

router.get('/', auth, dashboardController.index);

module.exports = router;