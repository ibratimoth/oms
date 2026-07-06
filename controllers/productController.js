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

    // 1. Structural Check: Check if Multer intercepted a file
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No spreadsheet file discovered in payload request.' });
    }

    // 2. Read spreadsheet from local temporary cache
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Check if sheet contains entries
    if (!sheetData || sheetData.length === 0) {
      removeTempFile(req.file.path);
      return res.status(400).json({ success: false, message: 'The uploaded Excel sheet is empty.' });
    }

    // 3. Document Scheme Mapping & Schema Safeguards
    const productsToCreate = [];
    
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      const name = row['Product Name'] || row['name'];
      
      // Data Integrity Guardrail: Skip empty placeholder rows safely, but throw notice if name field is broken
      if (!name) continue; 

      const buyPrice = Number(row['Cost Price'] || row['buy_price'] || 0);
      const sellPrice = Number(row['Selling Price'] || row['sell_price'] || 0);

      // Business Rule Validation: Cost price should not be higher than retail market value
      if (buyPrice > sellPrice) {
        removeTempFile(req.file.path);
        return res.status(400).json({ 
          success: false, 
          message: `Row ${i + 2}: "${name}" features a Cost Price higher than its Selling Price.` 
        });
      }

      productsToCreate.push({
        name: name,
        barcode: (row['Barcode'] || row['barcode']) ? String(row['Barcode'] || row['barcode']).trim() : null,
        buy_price: buyPrice,
        sell_price: sellPrice,
        quantity_in_stock: parseInt(row['Initial Stock'] || row['quantity_in_stock'] || 0),
        reorder_level: parseInt(row['Low Stock Limit'] || row['reorder_level'] || 5),
        created_by: userId
      });
    }

    if (productsToCreate.length === 0) {
      removeTempFile(req.file.path);
      return res.status(400).json({ success: false, message: 'No valid products with name attributes found to import.' });
    }

    // Execution Block
    await Product.bulkCreate(productsToCreate);

    // Drop temporary Multer caching file asset cleanly
    removeTempFile(req.file.path);

    // Return clean JSON success response
    return res.status(200).json({ 
      success: true, 
      message: `Successfully processed and imported ${productsToCreate.length} products into storage inventory.` 
    });

  } catch (error) {
    console.error('Bulk excel import failed:', error);
    if (req.file && req.file.path) removeTempFile(req.file.path);
    
    return res.status(500).json({ 
      success: false, 
      message: 'System failed to parse or validate the Excel document data structure.' 
    });
  }
};

function removeTempFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to clear temporary ledger upload file:', err);
  }
}

exports.getAllPrintableProducts = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const products = await Product.findAll({
      where: { 
        created_by: userId,
        barcode: { 
          [Op.ne]: null 
        } 
      }
    });

    return res.json(products);
  } catch (err) {
    console.error('Error fetching printable products layout:', err);
    return res.status(500).json({ error: 'Failed to retrieve product items data stream.' });
  }
};