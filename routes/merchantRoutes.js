const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
// Import your authentication/authorization middleware as needed
// const { isAuthenticated } = require('../middleware/auth');
const auth = require('../middleware/auth');

router.get('/', auth, merchantController.getAllMerchants);
router.post('/', auth, merchantController.createMerchant);
router.put('/:id', auth, merchantController.updateMerchant);
router.patch('/:id/toggle', auth, merchantController.toggleMerchantStatus);
router.delete('/:id', auth, merchantController.deleteMerchant);
router.get('/create', auth, merchantController.renderCreateForm);
router.get('/edit/:id', auth, merchantController.renderEditForm);

module.exports = router;