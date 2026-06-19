const router = require('express').Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');

// LIST
router.get('/', auth, productController.list);

// CREATE
router.get('/create', auth, productController.createPage);
router.post('/create', auth, productController.create);

// EDIT
router.get('/edit/:id', auth, productController.editPage);
router.post('/edit/:id', auth, productController.update);

// DELETE
router.get('/delete/:id', auth, productController.delete);

module.exports = router;