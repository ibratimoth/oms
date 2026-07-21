// const { StockMovement, Product, OrderItem, Order, sequelize } = require('../models');
// const { Op } = require('sequelize');

// exports.history = async (req, res) => {
//   try {
//     const userId = req.session.user.id;
//     const username = req.session.user.full_name;
//     const business_id = req.session.user.business_id;

//     const page = parseInt(req.query.page) || 1;
//     const limit = 20;
//     const offset = (page - 1) * limit;

//     const { from, to, date, search } = req.query;
//     let dateFilter = {};

//     if (date) {
//       dateFilter.created_at = {
//         [Op.between]: [
//           new Date(date + " 00:00:00"),
//           new Date(date + " 23:59:59")
//         ]
//       };
//     } else if (from && to) {
//       dateFilter.created_at = {
//         [Op.between]: [
//           new Date(from + " 00:00:00"),
//           new Date(to + " 23:59:59")
//         ]
//       };
//     } else {
//       const today = new Date().toISOString().split('T')[0];
//       dateFilter.created_at = {
//         [Op.between]: [
//           new Date(today + " 00:00:00"),
//           new Date(today + " 23:59:59")
//         ]
//       };
//     }

//     let productWhereClause = {};
//     if (search) {
//       productWhereClause.name = {
//         [Op.iLike]: `%${search}%`
//       };
//     }

//     const { rows: movements, count } = await StockMovement.findAndCountAll({
//       where: {
//         business_id: business_id,
//         ...dateFilter
//       },
//       include: [{
//         model: Product,
//         where: productWhereClause,
//         required: search ? true : false
//       }],
//       order: [['createdAt', 'DESC']],
//       limit,
//       offset
//     });

//     const dailySummary = await StockMovement.findAll({
//       attributes: [
//         [sequelize.fn('DATE', sequelize.col('StockMovement.created_at')), 'date'],
//         'type',
//         [sequelize.fn('SUM', sequelize.col('quantity')), 'total_quantity']
//       ],
//       where: {
//         business_id: business_id,
//         ...dateFilter
//       },
//       include: [{
//         model: Product,
//         where: productWhereClause,
//         attributes: [],
//         required: search ? true : false
//       }],
//       group: [
//         sequelize.fn('DATE', sequelize.col('StockMovement.created_at')),
//         'StockMovement.type'
//       ],
//       order: [[sequelize.literal('date'), 'DESC']]
//     });

//     const totalSales = await Order.sum('total_amount', {
//       where: {
//         business_id: business_id,
//         status: 'completed',
//         ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
//       }
//     });

//     const totalProfit = await Order.sum('profit_amount', {
//       where: {
//         business_id: business_id,
//         status: 'completed',
//         ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
//       }
//     });

//     const totalPages = Math.ceil(count / limit);

//     res.render('stock/history', {
//       movements,
//       dailySummary,
//       totalSales: totalSales || 0,
//       totalProfit: totalProfit || 0,
//       currentPage: page,
//       totalPages,
//       from,
//       to,
//       date,
//       search: search || '',
//       username,
//       userRole: req.session.user?.role
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).render('error', {
//       message: 'Stock history matrix compilation error',
//       username,
//       userRole: req.session.user?.role
//     });
//   }
// };

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

    // 3. Total Completed Sales & Gross Profit
    const salesSummary = await Order.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'totalSales'],
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
    const collectedSales = totalSales;

    // 4. Total Expenses
    const totalExpensesRaw = await Expense.sum('amount', {
      where: {
        business_id,
        ...(dateFilter.created_at ? { created_at: dateFilter.created_at } : {})
      }
    });
    const totalExpenses = Number(totalExpensesRaw) || 0;

    // 5. Debts Owed to You (Customer Receivables)
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

    // 6. Debts You Owe (Vendor/Supplier Payables)
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

    // 7. Derived Balances
    const cashInHand = collectedSales - totalExpenses;
    const netFinancialPosition = (cashInHand + Number(debtsOwedToYou)) - Number(debtsYouOwe);

    const totalPages = Math.ceil(count / limit);

    // 8. Render Response
    return res.render('stock/history', {
      movements,
      dailySummary,
      totalSales,
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