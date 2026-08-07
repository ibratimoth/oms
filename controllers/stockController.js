const { StockMovement, Product, OrderItem, Order, Expense, Debt, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.history = async (req, res) => {
  const username = req.session.user?.full_name;
  const userRole = req.session.user?.role;

  try {
    const userId = req.session.user.id;
    const business_id = req.session.user.business_id;

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const { from, to, date, search } = req.query;
    let dateFilter = {};

    // Standardize Date Boundaries
    if (date) {
      dateFilter.created_at = {
        [Op.between]: [
          new Date(`${date}T00:00:00.000Z`),
          new Date(`${date}T23:59:59.999Z`)
        ]
      };
    } else if (from && to) {
      dateFilter.created_at = {
        [Op.between]: [
          new Date(`${from}T00:00:00.000Z`),
          new Date(`${to}T23:59:59.999Z`)
        ]
      };
    } else {
      const today = new Date().toISOString().split('T')[0];
      dateFilter.created_at = {
        [Op.between]: [
          new Date(`${today}T00:00:00.000Z`),
          new Date(`${today}T23:59:59.999Z`)
        ]
      };
    }

    // Product search filter
    let productWhereClause = {};
    if (search) {
      const likeOperator = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
      productWhereClause.name = {
        [likeOperator]: `%${search}%`
      };
    }

    // 1. Stock Movements List
    const { rows: movements, count } = await StockMovement.findAndCountAll({
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
    });

    // 2. Daily Summary Aggregates
    const dailySummary = await StockMovement.findAll({
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
    });

    // 3. Total Sales & Profit Aggregation
    const salesSummary = await Order.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('final_amount')), 'totalSales'],
        [sequelize.fn('SUM', sequelize.col('profit_amount')), 'totalProfit']
      ],
      where: {
        business_id,
        status: 'completed',
        ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
      },
      raw: true
    });

    const totalSales = Number(salesSummary[0]?.totalSales) || 0;
    const totalProfit = Number(salesSummary[0]?.totalProfit) || 0;

    // 4. CASH Sales Aggregation
    const cashSalesRaw = await Order.sum('final_amount', {
      where: {
        business_id,
        status: 'completed',
        payment_method: 'CASH',
        ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
      }
    });
    const cashSales = Number(cashSalesRaw) || 0;

    // 5. NON-CASH Sales Aggregation (LIPA_NUMBER, CREDIT, etc.)
    const nonCashSalesRaw = await Order.sum('final_amount', {
      where: {
        business_id,
        status: 'completed',
        payment_method: {
          [Op.ne]: 'CASH'
        },
        ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
      }
    });
    const nonCashSales = Number(nonCashSalesRaw) || 0;

    // 6. Total Expenses
    const totalExpensesRaw = await Expense.sum('amount', {
      where: {
        business_id,
        ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
      }
    });
    const totalExpenses = Number(totalExpensesRaw) || 0;

    // 7. Debts Owed to You (Customer Receivables)
    let debtsOwedToYou = 0;
    if (Debt) {
      debtsOwedToYou = await Debt.sum('amount', {
        where: {
          business_id,
          type: 'CUSTOMER_DEBT',
          status: 'PENDING',
          ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
        }
      }) || 0;
    }

    // 8. Debts You Owe (Vendor/Supplier Payables)
    let debtsYouOwe = 0;
    if (Debt) {
      debtsYouOwe = await Debt.sum('amount', {
        where: {
          business_id,
          type: 'SUPPLIER_DEBT',
          status: 'PENDING',
          ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
        }
      }) || 0;
    }

    // 9. Calculated Cash Balances
    // Actual Cash in Hand is strictly Cash Sales minus Expenses
    const cashInHand = (cashSales + nonCashSales) - totalExpenses;
    const netFinancialPosition = (totalSales - totalExpenses + Number(debtsOwedToYou)) - Number(debtsYouOwe);

    const totalPages = Math.ceil(count / limit);

    // 10. Render Response
    return res.render('stock/history', {
      movements,
      dailySummary,
      totalSales,
      cashSales,
      nonCashSales,
      totalProfit,
      totalExpenses,
      debtsOwedToYou: Number(debtsOwedToYou),
      debtsYouOwe: Number(debtsYouOwe),
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
    console.error('Stock history controller error:', err);
    return res.status(500).render('error', {
      message: 'Stock history matrix compilation error',
      username,
      userRole
    });
  }
};