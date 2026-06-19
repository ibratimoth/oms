const router = require('express').Router();
const orderController = require('../controllers/orderController');
const stockController = require('../controllers/stockController');
const auth = require('../middleware/auth');

router.get('/', auth, orderController.list);
router.get('/create', auth, orderController.createPage);
router.post('/create', auth, orderController.create);

// COMPLETE ORDER (stock deduction)
router.get('/complete/:id', auth, orderController.completeOrder);

router.get('/invoice/:id', auth, orderController.invoice);

router.get('/view/:id', auth, orderController.view);

router.get('/stock/history', auth, stockController.history);

router.get('/edit/:id', auth, orderController.editForm);

router.post('/edit/:id', auth, orderController.update);

module.exports = router;