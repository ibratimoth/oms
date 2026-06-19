const { StockMovement, Product, OrderItem, Order, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.history = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const { from, to, date, search } = req.query;
    let dateFilter = {};

    if (date) {
      dateFilter.created_at = {
        [Op.between]: [
          new Date(date + " 00:00:00"),
          new Date(date + " 23:59:59")
        ]
      };
    } else if (from && to) {
      dateFilter.created_at = {
        [Op.between]: [
          new Date(from + " 00:00:00"),
          new Date(to + " 23:59:59")
        ]
      };
    } else {
      const today = new Date().toISOString().split('T')[0];
      dateFilter.created_at = {
        [Op.between]: [
          new Date(today + " 00:00:00"),
          new Date(today + " 23:59:59")
        ]
      };
    }

    let productWhereClause = {};
    if (search) {
      productWhereClause.name = {
        [Op.iLike]: `%${search}%` 
      };
    }

    const { rows: movements, count } = await StockMovement.findAndCountAll({
      where: {
        created_by: userId,
        ...dateFilter
      },
      include: [{
        model: Product,
        where: productWhereClause,
        required: search ? true : false 
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    const dailySummary = await StockMovement.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('StockMovement.created_at')), 'date'],
        'type',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']
      ],
      where: {
        created_by: userId,
        ...dateFilter
      },
      include: [{
        model: Product,
        where: productWhereClause,
        attributes: [], 
        required: search ? true : false
      }],
      group: [
        sequelize.fn('DATE', sequelize.col('StockMovement.created_at')),
        'StockMovement.type'
      ],
      order: [[sequelize.literal('date'), 'DESC']]
    });

    const totalSales = await Order.sum('total_amount', {
      where: {
        created_by: userId,
        status: 'completed',
        ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
      }
    });

    const totalProfit = await Order.sum('profit_amount', {
      where: {
        created_by: userId,
        status: 'completed',
        ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
      }
    });

    const totalPages = Math.ceil(count / limit);

    res.render('stock/history', {
      movements,
      dailySummary,
      totalSales: totalSales || 0,
      totalProfit: totalProfit || 0,
      currentPage: page,
      totalPages,
      from,
      to,
      date,
      search: search || ''
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Stock history matrix compilation error');
  }
};