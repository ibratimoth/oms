const { Order, OrderItem, Product, sequelize, StockMovement } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const logger = require('./../utils/logger');

exports.list = async (req, res) => {
  try {
    const userId = req.session.user.id;
    
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
      totalCount: count
    });

  } catch (error) {
    console.error('Error generating consolidated orders profile collection:', error);
    res.status(500).send('Internal Server Error while computing transaction logs.');
  }
};

exports.createPage = async (req, res) => {
  const products = await Product.findAll();
  res.render('orders/create', { products });
};

exports.create = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { items } = req.body;
    const userId = req.session.user.id;

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

  try {
    const order = await Order.findByPk(req.params.id, {
      include: OrderItem
    });

    for (let item of order.OrderItems) {

      const product = await Product.findByPk(item.product_id);

      product.quantity_in_stock -= item.quantity;

      await product.save({ transaction: t });

      // 📦 STOCK MOVEMENT (IMPORTANT ADDITION)
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
  const order = await Order.findByPk(req.params.id, {
    include: OrderItem
  });

  res.render('orders/invoice', { order });
};

exports.view = async (req, res) => {

  const userId = req.session.user.id;

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
  res.render('orders/view', { order });
};

exports.editForm = async (req, res) => {

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
    products
  });
};

exports.update = async (req, res) => {

  const t = await sequelize.transaction();

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