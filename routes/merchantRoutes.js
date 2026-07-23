const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
// Import your authentication/authorization middleware as needed
// const { isAuthenticated } = require('../middleware/auth');

router.get('/', merchantController.getAllMerchants);
router.post('/', merchantController.createMerchant);
router.put('/:id', merchantController.updateMerchant);
router.patch('/:id/toggle', merchantController.toggleMerchantStatus);
router.delete('/:id', merchantController.deleteMerchant);
router.get('/create', merchantController.renderCreateForm);
router.get('/edit/:id', merchantController.renderEditForm);

module.exports = router;