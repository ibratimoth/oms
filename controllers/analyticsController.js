const { Product, OrderItem, Order, sequelize } = require('../models');
const logger = require('../utils/logger');

exports.index = async (req, res) => {
  const username = req.session.user?.full_name || 'User';

  try {
    const business_id = req.session.user?.business_id;
    const businessFilter = business_id ? { business_id } : {};

    const [products, soldAggregates, topProducts] = await Promise.all([
      Product.findAll({
        where: businessFilter,
        attributes: ['id', 'name', 'buy_price', 'quantity_in_stock', 'reorder_level'],
        order: [['name', 'ASC']]
      }),
      OrderItem.findAll({
        attributes: [
          'product_id',
          [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'total_sold']
        ],
        include: [
          {
            model: Order,
            required: true,
            attributes: [],
            where: {
              ...businessFilter,
              status: 'completed'
            }
          }
        ],
        group: ['OrderItem.product_id'],
        raw: true
      }),
      OrderItem.findAll({
        attributes: [
          'product_id',
          [sequelize.fn('SUM', sequelize.col('OrderItem.quantity')), 'total_sold']
        ],
        include: [
          {
            model: Product,
            required: true,
            where: businessFilter,
            attributes: ['id', 'name', 'buy_price']
          },
          {
            model: Order,
            required: true,
            attributes: [],
            where: {
              ...businessFilter,
              status: 'completed'
            }
          }
        ],
        group: ['OrderItem.product_id', 'Product.id'],
        order: [[sequelize.literal('total_sold'), 'DESC']],
        limit: 10
      })
    ]);

    const soldByProductId = new Map(
      soldAggregates.map((row) => [String(row.product_id), Number(row.total_sold) || 0])
    );

    let totalSoldCost = 0;

    const stockData = products.map((p) => {
      const sold = soldByProductId.get(String(p.id)) || 0;
      const remaining = Number(p.quantity_in_stock) || 0;
      const buyPrice = Number(p.buy_price) || 0;
      const soldCost = sold * buyPrice;
      totalSoldCost += soldCost;

      return {
        id: p.id,
        name: p.name,
        buy_price: buyPrice,
        stock: remaining + sold,
        sold,
        sold_cost: soldCost,
        remaining,
        reorder_level: Number(p.reorder_level) || 0
      };
    });

    return res.render('analytics/index', {
      stockData,
      topProducts,
      totalSoldCost,
      username,
      userRole: req.session.user?.role
    });
  } catch (err) {
    logger.error('Failed to open analytics panel:', err);
    return res.status(500).render('error', {
      message: 'Failed to open analytics panel.',
      username,
      userRole: req.session.user?.role
    });
  }
};