const { Product } = require('../models');
const { Op } = require('sequelize');
const xlsx = require('xlsx');
const fs = require('fs');

exports.list = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const username = req.session.user.full_name;
    
    const { search, status, maxPrice, barcode } = req.query;
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 10; 
    const offset = (currentPage - 1) * itemsPerPage;

    let whereCondition = {
      created_by: userId
    };

    if (barcode && barcode.trim() !== '') {
      whereCondition.barcode = barcode.trim();
    }

    if (search && search.trim() !== '') {
      const cleanSearch = search.trim().toLowerCase();
      
      const searchMatch = Product.sequelize.where(
        Product.sequelize.fn('LOWER', Product.sequelize.col('name')),
        { [Op.like]: `%${cleanSearch}%` }
      );

      if (whereCondition[Op.and]) {
        whereCondition[Op.and].push(searchMatch);
      } else {
        whereCondition[Op.and] = [searchMatch];
      }
    }

    if (maxPrice && maxPrice.trim() !== '') {
      whereCondition.sell_price = { [Op.lte]: Number(maxPrice) };
    }

    if (status === 'low') {
      whereCondition.quantity_in_stock = {
        [Op.lte]: Product.sequelize.literal('COALESCE(reorder_level, 5)')
      };
    } else if (status === 'available') {
      whereCondition.quantity_in_stock = {
        [Op.gt]: Product.sequelize.literal('COALESCE(reorder_level, 5)')
      };
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: whereCondition,
      limit: itemsPerPage,
      offset: offset,
      order: [['created_at', 'DESC']] 
    });

    const totalPages = Math.ceil(count / itemsPerPage);

    res.render('products/index', { 
      products, 
      query: req.query,
      currentPage,
      totalPages,
      totalCount: count,
      username
    });

  } catch (error) {
    console.error('Pagination query processing failed:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.createPage = (req, res) => {
  const username = req.session.user.full_name;
  res.render('products/create', { username });
};

exports.create = async (req, res) => {
  const userId = req.session.user.id;
  const username = req.session.user.full_name;
  try {
    const {
      name,
      barcode, 
      buy_price,
      sell_price,
      quantity_in_stock,
      reorder_level
    } = req.body;

    await Product.create({
      name,
      barcode: barcode && barcode.trim() !== '' ? barcode.trim() : null,
      buy_price,
      sell_price,
      quantity_in_stock,
      reorder_level,
      created_by: userId
    });

    res.redirect('/products');
  } catch (err) {
    console.error(err);
    res.send('Error creating product');
  }
};

exports.editPage = async (req, res) => {
  const username = req.session.user.full_name;
  const product = await Product.findByPk(req.params.id);
  res.render('products/edit', { product, username });
};

exports.update = async (req, res) => {
  await Product.update(req.body, {
    where: { id: req.params.id }
  });

  res.redirect('/products');
};

exports.delete = async (req, res) => {
  await Product.destroy({
    where: { id: req.params.id }
  });

  res.redirect('/products');
};

exports.bulkDelete = async (req, res) => {
  try {
    const { productIds } = req.body;
    const userId = req.session.user.id;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).send('No products selected for deletion.');
    }

    await Product.destroy({
      where: {
        id: { [Op.in]: productIds },
        created_by: userId
      }
    });

    res.redirect('/products');
  } catch (error) {
    console.error('Bulk deletion failed:', error);
    res.status(500).send('Error executing bulk deletion');
  }
};

exports.bulkUpload = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // 1. FIX: Check req.file (singular) because you are using Multer
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    // 2. Read from the disk path provided by Multer
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const productsToCreate = sheetData.map(row => ({
      name: row['Product Name'] || row['name'],
      // Safe check for barcodes to avoid errors if the column is blank or evaluated as a number
      barcode: (row['Barcode'] || row['barcode']) ? String(row['Barcode'] || row['barcode']).trim() : null,
      buy_price: Number(row['Cost Price'] || row['buy_price'] || 0),
      sell_price: Number(row['Selling Price'] || row['sell_price'] || 0),
      quantity_in_stock: parseInt(row['Initial Stock'] || row['quantity_in_stock'] || 0),
      reorder_level: parseInt(row['Low Stock Limit'] || row['reorder_level'] || 5),
      created_by: userId
    })).filter(p => p.name); // Filter out rows with missing names

    if (productsToCreate.length > 0) {
      await Product.bulkCreate(productsToCreate);
    }

    // 3. GOOD PRACTICE: Delete the temporary file from your 'uploads/' folder 
    // so your server disk space doesn't fill up over time.
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.error('Failed to delete temporary file:', unlinkError);
    }

    res.redirect('/products');
  } catch (error) {
    console.error('Bulk excel import failed:', error);
    res.status(500).send('Error processing excel spreadsheet validation.');
  }
};