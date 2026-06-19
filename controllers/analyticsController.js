const { Product, OrderItem, sequelize } = require('../models');

exports.index = async (req, res) => {

  try {

    const products = await Product.findAll();

    const stockData = await Promise.all(products.map(async (p) => {

      const sold = await OrderItem.sum('quantity', {
        where: { product_id: p.id }
      });

      return {
        id: p.id,
        name: p.name,
        stock: p.quantity_in_stock + (sold || 0),
        sold: sold || 0,
        remaining: p.quantity_in_stock,
        reorder_level: p.reorder_level
      };
    }));

    const topProducts = await OrderItem.findAll({
      attributes: [
        'product_id',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'total_sold']
      ],
      include: [{
        model: Product,
        required: true
      }],
      group: ['product_id', 'Product.id'],
      order: [[sequelize.literal('total_sold'), 'DESC']],
      limit: 10
    });

    res.render('analytics/index', {
      stockData,
      topProducts
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Analytics error');
  }
};