const { Order, OrderItem, Product, sequelize, StockMovement } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const logger = require('./../utils/logger');
const XLSX = require('xlsx');

exports.list = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const username = req.session.user.full_name;
    
    const { orderNo, customer, maxAmount, status } = req.query;
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 10;
    const offset = (currentPage - 1) * itemsPerPage;

    let whereCondition = {
      created_by: userId
    };

    if (orderNo && orderNo.trim() !== '') {
      whereCondition.order_number = {
        [Op.like]: `%${orderNo.trim()}%`
      };
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
      whereCondition.total_amount = {
        [Op.lte]: Number(maxAmount)
      };
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
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const totalPages = Math.ceil(count / itemsPerPage);

    res.render('orders/index', {
      orders,
      query: req.query,
      currentPage,
      totalPages,
      totalCount: count,
      username
    });

  } catch (error) {
    console.error('Error generating consolidated orders profile collection:', error);
    res.status(500).send('Internal Server Error while computing transaction logs.');
  }
};

exports.createPage = async (req, res) => {
  try {
    const username = req.session.user?.full_name || 'User';
    const userId = req.session.user.id;
    const products = await Product.findAll({
      where: {
        created_by: userId
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
      messages: { error: errorMessage } 
    });

  } catch (err) {
    console.error('Error rendering order creation view layer:', err);
    res.status(500).send('Internal Server view generation exception logged.');
  }
};

exports.create = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { items } = req.body;
    const userId = req.session.user.id;
    const username = req.session.user.full_name;

    let total = 0;
    let totalProfit = 0;

    const order = await Order.create({
      order_number: 'ORD-' + Date.now(),
      status: 'pending',
      total_amount: 0,
      profit_amount: 0,
      created_by: userId,
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
    res.send(err.message);
  }
};

exports.completeOrder = async (req, res) => {
  const t = await sequelize.transaction();
  const userId = req.session.user.id;
  const username = req.session.user.full_name;

  try {
    const order = await Order.findByPk(req.params.id, {
      include: OrderItem
    });

    for (let item of order.OrderItems) {

      const product = await Product.findByPk(item.product_id);

      product.quantity_in_stock -= item.quantity;

      await product.save({ transaction: t });

      await StockMovement.create({
        product_id: product.id,
        type: 'OUT',
        quantity: item.quantity,
        reference: order.order_number,
        created_by: userId
      }, { transaction: t });
    }

    await order.update({
      status: 'completed'
    }, { transaction: t });

    await t.commit();

    res.redirect('/orders');

  } catch (err) {
    await t.rollback();
    res.send(err.message);
  }
};

exports.invoice = async (req, res) => {
  const username = req.session.user.full_name;
  const order = await Order.findByPk(req.params.id, {
    include: OrderItem
  });

  res.render('orders/invoice', { order , username });
};

exports.view = async (req, res) => {

  const userId = req.session.user.id;
  const username = req.session.user.full_name;
  const order = await Order.findOne({
    where: {
      id: req.params.id,
      created_by: userId
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

  logger.info(order.toJSON());
  res.render('orders/view', { order, username });
};

exports.editForm = async (req, res) => {
  const username = req.session.user.full_name;

  const order = await Order.findOne({
    where: {
      id: req.params.id,
      created_by: req.session.user.id
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
      created_by: req.session.user.id
    }
  });

  res.render('orders/edit', {
    order,
    products,
    username
  });
};

exports.update = async (req, res) => {

  const t = await sequelize.transaction();
  const username = req.session.user.full_name;

  try {

    const order = await Order.findOne({
      where: {
        id: req.params.id,
        created_by: req.session.user.id
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
          created_by: req.session.user.id
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
  const fallbackTarget = req.get('Referer') || '/orders/create';

  if (!req.file) {
    if (typeof req.flash === 'function') req.flash('error', 'Please select and upload a valid Excel file.');
    else req.session.error = 'Please select and upload a valid Excel file.';
    
    return req.session.save(() => res.redirect(fallbackTarget));
  }

  const t = await sequelize.transaction();

  try {
    const filePath = req.file.path; 
    const workbook = XLSX.readFile(filePath); 
    
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (sheetData.length === 0) {
      await t.rollback();
      if (typeof req.flash === 'function') req.flash('error', 'Bulk Upload Failed! The uploaded Excel sheet contains no data entries.');
      else req.session.error = 'Bulk Upload Failed! The uploaded Excel sheet contains no data entries.';
      
      return req.session.save(() => res.redirect(fallbackTarget));
    }

    const userId = req.session.user.id;

    // --- STEP 1: GROUP ROWS BY CUSTOMER ---
    // We create a map where key is "customer_name|customer_phone"
    const orderGroups = {};
    let currentOriginalRowIdx = 2; // Keep track of original spreadsheet row numbers for error reporting

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

      // Attach original spreadsheet row index for accurate validation tracking messages
      orderGroups[groupKey].rows.push({
        ...row,
        spreadsheetRowNumber: currentOriginalRowIdx
      });

      currentOriginalRowIdx++;
    }

    // --- STEP 2: PROCESS EACH DISTINCT ORDER GROUP ---
    for (const key of Object.keys(orderGroups)) {
      const group = orderGroups[key];

      // Create a distinct parent order record for this customer grouping
      const order = await Order.create({
        order_number: 'ORD-XL-' + Math.floor(100000 + Math.random() * 900000) + '-' + Date.now(),
        status: 'pending',
        total_amount: 0,
        profit_amount: 0,
        created_by: userId,
        customer_name: group.customer_name,
        customer_phone: group.customer_phone
      }, { transaction: t });

      let orderTotal = 0;
      let orderTotalProfit = 0;

      // Process items matching this customer group context
      for (let item of group.rows) {
        const barcodeStr = item.barcode ? String(item.barcode).trim() : null;
        const qty = parseInt(item.quantity);
        const rowNo = item.spreadsheetRowNumber;

        if (!barcodeStr) {
          await t.rollback();
          const msg = `Bulk Upload Failed! Row ${rowNo}: Barcode field entry is missing for customer "${group.customer_name}".`;
          if (typeof req.flash === 'function') req.flash('error', msg);
          else req.session.error = msg;
          return req.session.save(() => res.redirect(fallbackTarget));
        }

        if (!qty || qty <= 0) {
          await t.rollback();
          const msg = `Bulk Upload Failed! Row ${rowNo} [Barcode: ${barcodeStr}]: Invalid quantity entry for customer "${group.customer_name}".`;
          if (typeof req.flash === 'function') req.flash('error', msg);
          else req.session.error = msg;
          return req.session.save(() => res.redirect(fallbackTarget));
        }

        const product = await Product.findOne({
          where: { barcode: barcodeStr },
          transaction: t
        });

        if (!product) {
          await t.rollback();
          const msg = `Bulk Upload Failed! Row ${rowNo}: Barcode "${barcodeStr}" is not registered in the system.`;
          if (typeof req.flash === 'function') req.flash('error', msg);
          else req.session.error = msg;
          return req.session.save(() => res.redirect(fallbackTarget));
        }

        if (product.quantity_in_stock < qty) {
          await t.rollback();
          const msg = `Bulk Upload Failed! Row ${rowNo}: Insufficient inventory for item "${product.name}". Requested: ${qty}, Available: ${product.quantity_in_stock}`;
          if (typeof req.flash === 'function') req.flash('error', msg);
          else req.session.error = msg;
          return req.session.save(() => res.redirect(fallbackTarget));
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

      // Finalize financial metrics updates for this specific customer order object
      await order.update({
        total_amount: orderTotal,
        profit_amount: orderTotalProfit
      }, { transaction: t });
    }

    await t.commit();
    
    if (typeof req.flash === 'function') {
      req.flash('success', `Bulk orders imported successfully! Created ${Object.keys(orderGroups).length} distinct invoices.`);
      res.redirect('/orders');
    } else {
      req.session.save(() => {
        res.redirect('/orders');
      });
    }

  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error('Excel Multer Import Exception Logged:', err);
    
    const catchMsg = `Bulk Upload Failed Unexpectedly! ${err.message}`;
    if (typeof req.flash === 'function') {
      req.flash('error', catchMsg);
    } else {
      req.session.error = catchMsg;
    }
    
    return req.session.save(() => {
      res.redirect(fallbackTarget);
    });
  }
};

// exports.bulkUploadExcel = async (req, res) => {
//   const fallbackTarget = req.get('Referer') || '/orders/create';

//   if (!req.file) {
//     if (typeof req.flash === 'function') req.flash('error', 'Please select and upload a valid Excel file.');
//     else req.session.error = 'Please select and upload a valid Excel file.';
    
//     return req.session.save(() => res.redirect(fallbackTarget));
//   }

//   const t = await sequelize.transaction();

//   try {
//     const filePath = req.file.path; 
//     const workbook = XLSX.readFile(filePath); 
    
//     const sheetName = workbook.SheetNames[0];
//     const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

//     if (sheetData.length === 0) {
//       await t.rollback();
//       if (typeof req.flash === 'function') req.flash('error', 'Bulk Upload Failed! The uploaded Excel sheet contains no data entries.');
//       else req.session.error = 'Bulk Upload Failed! The uploaded Excel sheet contains no data entries.';
      
//       return req.session.save(() => res.redirect(fallbackTarget));
//     }

//     const userId = req.session.user.id;
//     let total = 0;
//     let totalProfit = 0;
    
//     const customerName = sheetData[0].customer_name || 'Excel Bulk Customer';
//     let rawPhone = sheetData[0].customer_phone ? String(sheetData[0].customer_phone).trim() : '';
//     let customerPhone = '';

//     if (rawPhone) {
//       let cleanedPhone = rawPhone.replace(/\D/g, '');
//       if (cleanedPhone.startsWith('0')) {
//         customerPhone = '255' + cleanedPhone.substring(1);
//       } else if (cleanedPhone.startsWith('255')) {
//         customerPhone = cleanedPhone;
//       } else if (cleanedPhone.length >= 9) {
//         customerPhone = '255' + cleanedPhone;
//       } else {
//         customerPhone = cleanedPhone;
//       }
//     }

//     const order = await Order.create({
//       order_number: 'ORD-XL-' + Date.now(),
//       status: 'pending',
//       total_amount: 0,
//       profit_amount: 0,
//       created_by: userId,
//       customer_name: customerName,
//       customer_phone: customerPhone
//     }, { transaction: t });

//     let rowNumber = 2; 
//     for (let row of sheetData) {
//       const barcodeStr = row.barcode ? String(row.barcode).trim() : null;
//       const qty = parseInt(row.quantity);

//       if (!barcodeStr) {
//         await t.rollback();
//         const msg = `Bulk Upload Failed! Row ${rowNumber}: Barcode field entry is missing.`;
//         if (typeof req.flash === 'function') req.flash('error', msg);
//         else req.session.error = msg;
        
//         return req.session.save(() => res.redirect(fallbackTarget));
//       }
//       if (!qty || qty <= 0) {
//         await t.rollback();
//         const msg = `Bulk Upload Failed! Row ${rowNumber} [Barcode: ${barcodeStr}]: Invalid quantity execution entry.`;
//         if (typeof req.flash === 'function') req.flash('error', msg);
//         else req.session.error = msg;
        
//         return req.session.save(() => res.redirect(fallbackTarget));
//       }

//       const product = await Product.findOne({
//         where: { barcode: barcodeStr },
//         transaction: t
//       });

//       if (!product) {
//         await t.rollback();
//         const msg = `Bulk Upload Failed! Row ${rowNumber}: Barcode signature "${barcodeStr}" is not registered in the system.`;
//         if (typeof req.flash === 'function') req.flash('error', msg);
//         else req.session.error = msg;
        
//         return req.session.save(() => res.redirect(fallbackTarget));
//       }

//       if (product.quantity_in_stock < qty) {
//         await t.rollback();
//         const msg = `Bulk Upload Failed! Row ${rowNumber}: Insufficient inventory for item "${product.name}". Requested: ${qty}, Available: ${product.quantity_in_stock}`;
//         if (typeof req.flash === 'function') req.flash('error', msg);
//         else req.session.error = msg;
        
//         return req.session.save(() => res.redirect(fallbackTarget));
//       }

//       const subtotal = product.sell_price * qty;
//       const profit = (product.sell_price - product.buy_price) * qty;

//       total += subtotal;
//       totalProfit += profit;

//       await OrderItem.create({
//         order_id: order.id,
//         product_id: product.id,
//         quantity: qty,
//         unit_price: product.sell_price,
//         subtotal
//       }, { transaction: t });

//       await product.update({
//         quantity_in_stock: product.quantity_in_stock - qty
//       }, { transaction: t });

//       rowNumber++;
//     }

//     await order.update({
//       total_amount: total,
//       profit_amount: totalProfit
//     }, { transaction: t });

//     await t.commit();
    
//     if (typeof req.flash === 'function') {
//       req.flash('success', 'Bulk orders imported successfully!');
//       res.redirect('/orders');
//     } else {
//       req.session.save(() => {
//         res.redirect('/orders');
//       });
//     }

//   } catch (err) {
//     if (!t.finished) await t.rollback();
//     console.error('Excel Multer Import Exception Logged:', err);
    
//     const catchMsg = `Bulk Upload Failed Unexpectedly! ${err.message}`;
//     if (typeof req.flash === 'function') {
//       req.flash('error', catchMsg);
//     } else {
//       req.session.error = catchMsg;
//     }
    
//     // ASYNC SAFE FORWARD GUARD
//     return req.session.save(() => {
//       res.redirect(fallbackTarget);
//     });
//   }
// };