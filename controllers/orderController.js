const { Order, OrderItem, Product, sequelize, StockMovement, Merchant } = require('../models');
const { generateOrderNumber } = require('../utils/orderHelper');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const logger = require('./../utils/logger');
const XLSX = require('xlsx');
const fs = require('fs');

exports.list = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const username = req.session.user.full_name;
    const business_id = req.session.user.business_id;

    const { orderNo, customer, maxAmount, status } = req.query;
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 10;
    const offset = (currentPage - 1) * itemsPerPage;

    let whereCondition = { business_id: business_id };

    if (orderNo && orderNo.trim() !== '') {
      whereCondition.order_number = { [Op.like]: `%${orderNo.trim()}%` };
    }

    if (customer && customer.trim() !== '') {
      const cleanCustomer = customer.trim().toLowerCase();
      whereCondition[Op.or] = [
        Order.sequelize.where(
          Order.sequelize.fn('LOWER', Order.sequelize.col('customer_name')),
          { [Op.like]: `%${cleanCustomer}%` }
        ),
        Order.sequelize.where(
          Order.sequelize.fn('LOWER', Order.sequelize.col('customer_phone')),
          { [Op.like]: `%${cleanCustomer}%` }
        )
      ];
    }

    if (maxAmount && maxAmount.trim() !== '') {
      whereCondition.total_amount = { [Op.lte]: Number(maxAmount) };
    }

    if (status && status.trim() !== '') {
      whereCondition.status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereCondition,
      limit: itemsPerPage,
      offset: offset,
      include: [
        {
          model: OrderItem,
          include: [Product]
        },
        { model: Merchant } // Include Merchant info if associated
      ],
      order: [['createdAt', 'DESC']]
    });

    // Fetch active merchants list for completion modal
    const merchants = await Merchant.findAll({
      where: {
        business_id: business_id,
        is_active: true
      }
    });

    const totalPages = Math.ceil(count / itemsPerPage);

    res.render('orders/index', {
      orders,
      merchants, // Pass merchants to layout view
      query: req.query,
      currentPage,
      totalPages,
      totalCount: count,
      username,
      userRole: req.session.user?.role
    });

  } catch (error) {
    console.error('Error generating consolidated orders profile collection:', error);
    return res.status(500).render('error', {
      message: 'Failed to open user order panel.',
      username,
      userRole: req.session.user?.role
    });
  }
};

exports.createPage = async (req, res) => {
  try {
    const username = req.session.user?.full_name || 'User';
    const userId = req.session.user.id;
    const business_id = req.session.user.business_id;
    const products = await Product.findAll({
      where: {
        business_id: business_id
      }
    });

    let errorMessage = '';
    if (typeof req.flash === 'function') {
      const flashError = req.flash('error');
      errorMessage = flashError.length > 0 ? flashError[0] : '';
    } else if (req.session.error) {
      errorMessage = req.session.error;
      delete req.session.error;
    }

    res.render('orders/create', {
      products,
      username,
      error: errorMessage,
      messages: { error: errorMessage },
      userRole: req.session.user?.role
    });

  } catch (err) {
    console.error('Error rendering order creation view layer:', err);
    return res.status(500).render('error', {
      message: 'Failed to open user order panel.',
      username,
      userRole: req.session.user?.role
    });
  }
};

exports.create = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { items } = req.body;
    const userId = req.session.user.id;
    const username = req.session.user.full_name;
    const business_id = req.session.user.business_id;

    console.log('username:', username);
    let total = 0;
    let totalProfit = 0;

    const orderNumber = await generateOrderNumber(Order);
    const order = await Order.create({
      order_number: orderNumber,
      status: 'pending',
      total_amount: 0,
      profit_amount: 0,
      created_by: userId,
      business_id: business_id,
      customer_name: req.body.customer_name,
      customer_phone: req.body.customer_phone
    }, { transaction: t });

    for (let item of items) {

      const product = await Product.findByPk(item.product_id);
      const qty = parseInt(item.quantity);

      if (!qty || qty <= 0) {
        throw new Error(`Invalid quantity for ${product.name}`);
      }

      if (product.quantity_in_stock < qty) {
        throw new Error(
          `Not enough stock for ${product.name}. Available: ${product.quantity_in_stock}`
        );
      }

      const subtotal = product.sell_price * qty;

      const profit = (product.sell_price - product.buy_price) * qty;

      total += subtotal;
      totalProfit += profit;

      console.log(`Creating order with order id ${order.id} `);

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        quantity: qty,
        unit_price: product.sell_price,
        subtotal
      }, { transaction: t });
    }

    await order.update({
      total_amount: total,
      profit_amount: totalProfit
    }, { transaction: t });

    await t.commit();

    res.redirect('/orders');

  } catch (err) {
    await t.rollback();
    console.error('Error creating order:', err);
    return res.status(500).render('error', {
      message: 'Failed to create order.',
      username,
      userRole: req.session.user?.role
    });
  }
};

exports.completeOrder = async (req, res) => {
  const t = await sequelize.transaction();
  const userId = req.session.user.id;
  const business_id = req.session.user.business_id;

  let { merchant_id, payment_method } = req.body;

  // If cash is selected, force merchant_id to null
  if (payment_method === 'CASH' || !merchant_id) {
    merchant_id = null;
  }

  try {
    const order = await Order.findByPk(req.params.id, {
      include: OrderItem
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Deduct inventory stock
    for (let item of order.OrderItems) {
      const product = await Product.findByPk(item.product_id);
      if (product) {
        product.quantity_in_stock -= item.quantity;
        await product.save({ transaction: t });

        await StockMovement.create({
          product_id: product.id,
          type: 'OUT',
          quantity: item.quantity,
          reference: order.order_number,
          created_by: userId,
          business_id: business_id
        }, { transaction: t });
      }
    }

    // Update order status & payment details
    await order.update({
      status: 'completed',
      merchant_id: merchant_id,
      payment_method: payment_method || 'CASH'
    }, { transaction: t });

    await t.commit();

    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.json({ success: true, message: 'Order completed successfully!' });
    }

    res.redirect('/orders');

  } catch (err) {
    await t.rollback();
    console.error('Error completing order:', err);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(500).json({ success: false, message: 'Failed to complete order.' });
    }
    return res.status(500).render('error', {
      message: 'Failed to complete order.',
      username: req.session.user?.full_name,
      userRole: req.session.user?.role
    });
  }
};

exports.invoice = async (req, res) => {
  const username = req.session.user.full_name;
  const order = await Order.findByPk(req.params.id, {
    include: OrderItem
  });

  res.render('orders/invoice', { order, username, userRole: req.session.user?.role });
};

exports.view = async (req, res) => {
  try {
    const username = req.session.user.full_name;
    const business_id = req.session.user.business_id;

    const order = await Order.findOne({
      where: {
        id: req.params.id,
        business_id: business_id
      },
      include: [
        {
          model: OrderItem,
          include: [Product]
        },
        { model: Merchant }
      ]
    });

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Fetch active merchants list for modal completion
    const merchants = await Merchant.findAll({
      where: {
        business_id: business_id,
        is_active: true
      }
    });

    res.render('orders/view', {
      order,
      merchants,
      username,
      userRole: req.session.user?.role
    });

  } catch (error) {
    console.error('Error opening order details:', error);
    return res.status(500).render('error', {
      message: 'Failed to retrieve order details.',
      username: req.session.user?.full_name,
      userRole: req.session.user?.role
    });
  }
};

exports.editForm = async (req, res) => {
  const username = req.session.user.full_name;
  const business_id = req.session.user.business_id;

  const order = await Order.findOne({
    where: {
      id: req.params.id,
      business_id: business_id
    },
    include: [
      {
        model: OrderItem,
        include: [Product]
      }
    ]
  });

  if (!order) {
    return res.status(404).send('Order not found');
  }

  if (order.status === 'completed') {
    return res.send('Completed orders cannot be edited');
  }

  const products = await Product.findAll({
    where: {
      business_id: business_id
    }
  });

  res.render('orders/edit', {
    order,
    products,
    username,
    userRole: req.session.user?.role
  });
};

exports.update = async (req, res) => {

  const t = await sequelize.transaction();
  const username = req.session.user.full_name;
  const business_id = req.session.user.business_id;

  try {

    const order = await Order.findOne({
      where: {
        id: req.params.id,
        business_id: business_id
      },
      include: [OrderItem]
    });

    if (!order) {
      await t.rollback();
      return res.status(404).send('Order not found');
    }

    if (order.status === 'completed') {
      await t.rollback();
      return res.send('Completed orders cannot be edited');
    }

    const {
      customer_name,
      customer_phone,
      items
    } = req.body;

    logger.info(req.body, 'Received order update request');

    let total = 0;
    let profit = 0;

    await OrderItem.destroy({
      where: {
        order_id: order.id
      },
      transaction: t
    });

    for (const item of items) {

      const product = await Product.findOne({
        where: {
          id: item.product_id,
          business_id: req.session.user.business_id
        }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const qty = parseInt(item.quantity);

      if (!qty || qty <= 0) {
        throw new Error(`Invalid quantity for ${product.name}`);
      }

      const subtotal = qty * product.sell_price;

      const itemProfit =
        (product.sell_price - product.buy_price) * qty;

      total += subtotal;
      profit += itemProfit;

      await OrderItem.create({
        order_id: order.id,
        product_id: product.id,
        quantity: qty,
        unit_price: product.sell_price,
        subtotal
      }, { transaction: t });
    }

    await order.update({
      customer_name,
      customer_phone,
      total_amount: total,
      profit_amount: profit
    }, { transaction: t });

    await t.commit();

    res.redirect('/orders');

  } catch (err) {

    await t.rollback();

    console.error(err);

    res.send(err.message);
  }
};

exports.bulkUploadExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please select and upload a valid Excel file.' });
  }

  const t = await sequelize.transaction();
  const filePath = req.file.path;

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!sheetData || sheetData.length === 0) {
      await t.rollback();
      removeTempFile(filePath);
      return res.status(400).json({ success: false, message: 'Bulk Upload Failed! The uploaded Excel sheet contains no data entries.' });
    }

    const userId = req.session.user.id;

    const orderGroups = {};
    let currentOriginalRowIdx = 2;

    for (let row of sheetData) {
      const cName = (row.customer_name || 'Excel Bulk Customer').trim();
      let rawPhone = row.customer_phone ? String(row.customer_phone).trim() : '';
      let cPhone = '';

      if (rawPhone) {
        let cleanedPhone = rawPhone.replace(/\D/g, '');
        if (cleanedPhone.startsWith('0')) {
          cPhone = '255' + cleanedPhone.substring(1);
        } else if (cleanedPhone.startsWith('255')) {
          cPhone = cleanedPhone;
        } else if (cleanedPhone.length >= 9) {
          cPhone = '255' + cleanedPhone;
        } else {
          cPhone = cleanedPhone;
        }
      }

      const groupKey = `${cName}||${cPhone}`;
      if (!orderGroups[groupKey]) {
        orderGroups[groupKey] = {
          customer_name: cName,
          customer_phone: cPhone,
          rows: []
        };
      }

      orderGroups[groupKey].rows.push({
        ...row,
        spreadsheetRowNumber: currentOriginalRowIdx
      });

      currentOriginalRowIdx++;
    }

        const orderNumber = await generateOrderNumber(Order);

    // --- STEP 2: PROCESS EACH DISTINCT ORDER GROUP ---
    for (const key of Object.keys(orderGroups)) {
      const group = orderGroups[key];

      const order = await Order.create({
        order_number: orderNumber,
        status: 'pending',
        total_amount: 0,
        profit_amount: 0,
        created_by: userId,
        business_id: req.session.user.business_id,
        customer_name: group.customer_name,
        customer_phone: group.customer_phone
      }, { transaction: t });

      let orderTotal = 0;
      let orderTotalProfit = 0;

      for (let item of group.rows) {
        const barcodeStr = item.barcode ? String(item.barcode).trim() : null;
        const qty = parseInt(item.quantity);
        const rowNo = item.spreadsheetRowNumber;

        if (!barcodeStr) {
          await t.rollback();
          removeTempFile(filePath);
          return res.status(400).json({
            success: false,
            message: `Row ${rowNo}: Barcode field entry is missing for customer "${group.customer_name}".`
          });
        }

        if (!qty || qty <= 0) {
          await t.rollback();
          removeTempFile(filePath);
          return res.status(400).json({
            success: false,
            message: `Row ${rowNo} [Barcode: ${barcodeStr}]: Invalid quantity entry for customer "${group.customer_name}".`
          });
        }

        const product = await Product.findOne({
          where: { barcode: barcodeStr },
          transaction: t
        });

        if (!product) {
          await t.rollback();
          removeTempFile(filePath);
          return res.status(400).json({
            success: false,
            message: `Row ${rowNo}: Barcode "${barcodeStr}" is not registered in the system.`
          });
        }

        if (product.quantity_in_stock < qty) {
          await t.rollback();
          removeTempFile(filePath);
          return res.status(400).json({
            success: false,
            message: `Row ${rowNo}: Insufficient inventory for item "${product.name}". Requested: ${qty}, Available: ${product.quantity_in_stock}`
          });
        }

        const subtotal = product.sell_price * qty;
        const profit = (product.sell_price - product.buy_price) * qty;

        orderTotal += subtotal;
        orderTotalProfit += profit;

        await OrderItem.create({
          order_id: order.id,
          product_id: product.id,
          quantity: qty,
          unit_price: product.sell_price,
          subtotal
        }, { transaction: t });

        await product.update({
          quantity_in_stock: product.quantity_in_stock - qty
        }, { transaction: t });
      }

      await order.update({
        total_amount: orderTotal,
        profit_amount: orderTotalProfit
      }, { transaction: t });
    }

    await t.commit();
    removeTempFile(filePath);

    return res.status(200).json({
      success: true,
      message: `Bulk orders imported successfully! Processed ${Object.keys(orderGroups).length} distinct invoices cleanly.`
    });

  } catch (err) {
    if (!t.finished) await t.rollback();
    removeTempFile(filePath);
    console.error('Excel Multer Import Exception Logged:', err);

    return res.status(500).json({
      success: false,
      message: `Bulk Upload Failed Unexpectedly! Error: ${err.message}`
    });
  }
};

// Clean helper abstraction to unlink disk cache files safely
function removeTempFile(path) {
  try {
    if (fs.existsSync(path)) fs.unlinkSync(path);
  } catch (err) {
    console.error('File cleanup exception:', err);
  }
}

