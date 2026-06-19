const { Product } = require('../models');
const { Op } = require('sequelize');

exports.list = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Destructure parameters, including the new 'barcode' key from the view form
    const { search, status, maxPrice, barcode } = req.query;
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 10; 
    const offset = (currentPage - 1) * itemsPerPage;

    let whereCondition = {
      created_by: userId
    };

    // ⚡ 1. Direct Barcode Hardware Scanner Match
    if (barcode && barcode.trim() !== '') {
      whereCondition.barcode = barcode.trim();
    }

    // 2. Case-Insensitive Text Query Pattern Matching
    if (search && search.trim() !== '') {
      const cleanSearch = search.trim().toLowerCase();
      
      // If a barcode filter is already present, safely combine conditions with an [Op.and] array wrapper
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

    // 3. Pricing Ceiling Filter
    if (maxPrice && maxPrice.trim() !== '') {
      whereCondition.sell_price = { [Op.lte]: Number(maxPrice) };
    }

    // 4. Stock Threshold Level Filters
    if (status === 'low') {
      whereCondition.quantity_in_stock = {
        [Op.lte]: Product.sequelize.literal('COALESCE(reorder_level, 5)')
      };
    } else if (status === 'available') {
      whereCondition.quantity_in_stock = {
        [Op.gt]: Product.sequelize.literal('COALESCE(reorder_level, 5)')
      };
    }

    // Fetch array data chunk and total metrics matching the specific criteria
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereCondition,
      limit: itemsPerPage,
      offset: offset,
      order: [['created_at', 'DESC']] // Changed from 'createdAt' to match the underscored table standard
    });

    // Compute absolute ceiling page numbers
    const totalPages = Math.ceil(count / itemsPerPage);

    // Pass everything to your layout dashboard template channel
    res.render('products/index', { 
      products, 
      query: req.query,
      currentPage,
      totalPages,
      totalCount: count
    });

  } catch (error) {
    console.error('Pagination query processing failed:', error);
    res.status(500).send('Internal Server Error');
  }
};

exports.createPage = (req, res) => {
  res.render('products/create');
};

exports.create = async (req, res) => {
  const userId = req.session.user.id;
  try {
    const {
      name,
      barcode, // 👈 Capture the incoming barcode input field value
      buy_price,
      sell_price,
      quantity_in_stock,
      reorder_level
    } = req.body;

    await Product.create({
      name,
      // If empty string or undefined, pass null so the DB Trigger generates the 'DEL-XXXXX' sequence
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
  const product = await Product.findByPk(req.params.id);
  res.render('products/edit', { product });
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