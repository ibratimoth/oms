const router = require('express').Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const excelFilter = (req, file, cb) => {
  if (file.mimetype.includes("excel") || file.mimetype.includes("spreadsheetml")) {
    cb(null, true);
  } else {
    cb(new Error("Please upload only excel files."), false);
  }
};

const upload = multer({ storage: storage, fileFilter: excelFilter });

router.get('/', auth, productController.list);

router.get('/create', auth, productController.createPage);

router.post('/create', auth, productController.create);

router.get('/edit/:id', auth, productController.editPage);

router.post('/edit/:id', auth, productController.update);

router.get('/delete/:id', auth, productController.delete);

router.post('/bulk-delete', auth, productController.bulkDelete);

router.post('/bulk-upload', auth, upload.single('excel_file'), productController.bulkUpload);

module.exports = router;