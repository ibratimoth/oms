const router = require('express').Router();
const orderController = require('../controllers/orderController');
const stockController = require('../controllers/stockController');
const auth = require('../middleware/auth');
const upload = require('../middleware/multerConfig');

router.get('/', auth, orderController.list);

router.get('/create', auth, orderController.createPage);

router.post('/create', auth, orderController.create);

router.get('/complete/:id', auth, orderController.completeOrder);

router.get('/invoice/:id', auth, orderController.invoice);

router.get('/view/:id', auth, orderController.view);

router.get('/stock/history', auth, stockController.history);

router.get('/edit/:id', auth, orderController.editForm);

router.post('/edit/:id', auth, orderController.update);

// router.post('/bulk-upload', auth, upload.single('excel_file'), orderController.bulkUploadExcel);

router.post('/bulk-upload', (req, res, next) => {
  upload.single('excel_file')(req, res, function (err) {
    if (err) {
      console.error('Multer File Filter Restriction Triggered:', err.message);
      
      if (typeof req.flash === 'function') {
        req.flash('error', err.message);
      } else {
        req.session.error = err.message;
      }
      
      const fallbackTarget = req.get('Referer') || '/orders/create';
      
      // FORCE SESSION TO SAVE TO STORAGE LAYER BEFORE MOVING THE BROWSER
      return req.session.save(() => {
        res.redirect(fallbackTarget);
      });
    }
    
    next();
  });
}, orderController.bulkUploadExcel);

module.exports = router;