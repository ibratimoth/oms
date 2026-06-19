const { Order, Product, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.index = async (req, res) => {

  try {

    const userId = req.session.user.id;

    const userFilter = {
      created_by: userId 
    };

    const orderFilter = {
      created_by: userId
    };

    const totalProducts = await Product.count({
      where: userFilter
    });

    const totalOrders = await Order.count({
      where: orderFilter
    });

    const completedOrders = await Order.count({
      where: {
        ...orderFilter,
        status: 'completed'
      }
    });

    const pendingOrders = await Order.count({
      where: {
        ...orderFilter,
        status: 'pending'
      }
    });

    const totalProfit = await Order.sum('profit_amount', {
      where: {
        ...orderFilter,
        status: 'completed'
      }
    });

    const lowStockProducts = await Product.findAll({
      where: {
        quantity_in_stock: {
          [Op.lte]: 5
        }
      }
    });

    const recentOrders = await Order.findAll({
      where: orderFilter,
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    const dailySales = await Order.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'sales']
      ],
      where: {
        ...orderFilter,
        status: 'completed'
      },
      group: [sequelize.literal('DATE(created_at)')],
      order: [[sequelize.literal('DATE(created_at)'), 'DESC']]
    });

    res.render('dashboard/index', {
      totalProducts,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalProfit: totalProfit || 0,
      lowStockProducts,
      recentOrders,
      dailySales
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Dashboard error');
  }
};