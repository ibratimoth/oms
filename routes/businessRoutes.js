const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');

// List All
router.get('/', businessController.getAllBusinesses);

// Create Operations (Place above /:id routes)
router.get('/create', businessController.showCreateBusiness);
router.post('/create', businessController.createBusiness);

// View One
router.get('/view/:id', businessController.getBusinessById);

// Update Operations
router.get('/edit/:id', businessController.showEditBusiness);
router.post('/edit/:id', businessController.updateBusiness);

// Delete Operation
router.get('/delete/:id', businessController.deleteBusiness);

module.exports = router;