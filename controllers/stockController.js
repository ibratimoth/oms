const { StockMovement, Product, OrderItem, Order, Expense, Debt, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

function getEatDayString(offsetDays = 0) {
  const now = new Date(Date.now() + offsetDays * 86400000);
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Dar_es_Salaam' });
}

exports.history = async (req, res) => {
  const username = req.session.user?.full_name;
  const userRole = req.session.user?.role;

  try {
    const business_id = req.session.user.business_id;

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const { from, to, date, search } = req.query;
    const dateFilter = {};
    let expenseDateWhere = {};

    // Standardize Date Boundaries (EAT = UTC+3)
    if (date) {
      dateFilter.created_at = {
        [Op.between]: [
          new Date(`${date}T00:00:00.000+03:00`),
          new Date(`${date}T23:59:59.999+03:00`)
        ]
      };
      expenseDateWhere = { expense_date: date };
    } else if (from && to) {
      dateFilter.created_at = {
        [Op.between]: [
          new Date(`${from}T00:00:00.000+03:00`),
          new Date(`${to}T23:59:59.999+03:00`)
        ]
      };
      expenseDateWhere = { expense_date: { [Op.between]: [from, to] } };
    } else {
      const today = getEatDayString(0);
      dateFilter.created_at = {
        [Op.between]: [
          new Date(`${today}T00:00:00.000+03:00`),
          new Date(`${today}T23:59:59.999+03:00`)
        ]
      };
      expenseDateWhere = { expense_date: today };
    }

    // Product search filter
    const productWhereClause = {};
    if (search) {
      const likeOperator = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
      productWhereClause.name = {
        [likeOperator]: `%${search.trim()}%`
      };
    }

    const orderBaseWhere = {
      business_id,
      status: 'completed',
      ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
    };

    const operatingExpenseWhere = {
      business_id,
      ...expenseDateWhere,
      [Op.or]: [
        { affects_profit: true },
        { affects_profit: null, entry_type: { [Op.ne]: 'RESTOCK_INVENTORY' } }
      ]
    };

    const restockExpenseWhere = {
      business_id,
      ...expenseDateWhere,
      [Op.or]: [
        { entry_type: 'RESTOCK_INVENTORY' },
        { affects_profit: false }
      ]
    };

    const [
      { rows: movements, count },
      dailySummary,
      salesSummary,
      cashSalesRaw,
      nonCashSalesRaw,
      rawOperatingExpenses,
      rawRestockSpend,
      rawDebtsOwedToYou,
      rawDebtsYouOwe,
      allProducts,
      soldOrderItems
    ] = await Promise.all([
      StockMovement.findAndCountAll({
        where: {
          business_id,
          ...dateFilter
        },
        include: [{
          model: Product,
          where: productWhereClause,
          required: !!search
        }],
        order: [['created_at', 'DESC']],
        limit,
        offset
      }),
      StockMovement.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('StockMovement.created_at')), 'date'],
          'type',
          [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']
        ],
        where: {
          business_id,
          ...dateFilter
        },
        include: [{
          model: Product,
          where: productWhereClause,
          attributes: [],
          required: !!search
        }],
        group: [
          sequelize.fn('DATE', sequelize.col('StockMovement.created_at')),
          'StockMovement.type'
        ],
        order: [[sequelize.literal('date'), 'DESC']]
      }),
      Order.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('final_amount')), 'totalSales'],
          [sequelize.fn('SUM', sequelize.col('profit_amount')), 'totalProfit']
        ],
        where: orderBaseWhere,
        raw: true
      }),
      Order.sum('final_amount', {
        where: {
          ...orderBaseWhere,
          payment_method: 'CASH'
        }
      }),
      Order.sum('final_amount', {
        where: {
          ...orderBaseWhere,
          payment_method: { [Op.ne]: 'CASH' }
        }
      }),
      Expense.sum('amount', { where: operatingExpenseWhere }),
      Expense.sum('amount', { where: restockExpenseWhere }),
      Debt
        ? Debt.sum('amount', {
            where: {
              business_id,
              type: 'CUSTOMER_DEBT',
              status: 'PENDING',
              ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
            }
          })
        : Promise.resolve(0),
      Debt
        ? Debt.sum('amount', {
            where: {
              business_id,
              type: 'SUPPLIER_DEBT',
              status: 'PENDING',
              ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
            }
          })
        : Promise.resolve(0),
      Product.findAll({
        where: { business_id },
        attributes: ['buy_price', 'quantity_in_stock']
      }),
      OrderItem.findAll({
        include: [
          {
            model: Order,
            where: orderBaseWhere,
            attributes: []
          },
          {
            model: Product,
            attributes: ['buy_price']
          }
        ]
      })
    ]);

    const totalSales = Number(salesSummary[0]?.totalSales) || 0;
    const totalProfit = Number(salesSummary[0]?.totalProfit) || 0;
    const cashSales = Number(cashSalesRaw) || 0;
    const nonCashSales = Number(nonCashSalesRaw) || 0;

    const totalOperatingExpenses = Number(rawOperatingExpenses) || 0;
    const totalRestockSpend = Number(rawRestockSpend) || 0;
    const totalCashOutflow = totalOperatingExpenses + totalRestockSpend;
    const totalExpenses = totalCashOutflow; // Backward-compatible alias for total cash outflow
    const netProfit = totalProfit - totalOperatingExpenses;

    const debtsOwedToYou = Number(rawDebtsOwedToYou) || 0;
    const debtsYouOwe = Number(rawDebtsYouOwe) || 0;

    const totalRegisteredProductsCost = allProducts.reduce((sum, p) => {
      return sum + ((Number(p.buy_price) || 0) * (Number(p.quantity_in_stock) || 0));
    }, 0);

    const totalSoldProductsCost = soldOrderItems.reduce((sum, item) => {
      const buyPrice = item.Product ? (Number(item.Product.buy_price) || 0) : 0;
      const quantitySold = Number(item.quantity) || 0;
      return sum + (buyPrice * quantitySold);
    }, 0);

    const cashInHand = (cashSales + nonCashSales) - totalCashOutflow;
    const netFinancialPosition = (totalSales - totalCashOutflow + debtsOwedToYou) - debtsYouOwe;

    const totalPages = Math.ceil(count / limit);

    return res.render('stock/history', {
      movements,
      dailySummary,
      totalSales,
      cashSales,
      nonCashSales,
      totalProfit,
      totalOperatingExpenses,
      totalRestockSpend,
      totalCashOutflow,
      netProfit,
      totalExpenses,
      debtsOwedToYou,
      debtsYouOwe,
      totalRegisteredProductsCost,
      totalSoldProductsCost,
      cashInHand,
      netFinancialPosition,
      currentPage: page,
      totalPages,
      from,
      to,
      date,
      search: search || '',
      username,
      userRole
    });
  } catch (err) {
    logger.error('Stock history controller error:', err);
    return res.status(500).render('error', {
      message: 'Stock history matrix compilation error',
      username,
      userRole
    });
  }
};