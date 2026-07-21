const { Order, Product, Expense, Debt, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('./../utils/logger');

exports.index = async (req, res) => {
  const username = req.session.user?.full_name || 'User';

  try {
    const userId = req.session.user.id;
    const business_id = req.session.user.business_id;

    // Filter condition for business multi-tenancy
    const businessFilter = business_id ? { business_id } : {};

    // 1. Existing Product & Order Metrics
    const totalProducts = await Product.count({ where: businessFilter });
    const totalOrders = await Order.count({ where: businessFilter });

    const completedOrders = await Order.count({
      where: { ...businessFilter, status: 'completed' }
    });

    const pendingOrders = await Order.count({
      where: { ...businessFilter, status: 'pending' }
    });

    const totalProfit = await Order.sum('profit_amount', {
      where: { ...businessFilter, status: 'completed' }
    }) || 0;

    // 2. Financial Metrics (Sales, Expenses & Debts)
    
    // Total Sales Revenue (from completed orders)
    const totalSales = await Order.sum('total_amount', {
      where: { ...businessFilter, status: 'completed' }
    }) || 0;

    // Total Operational Expenses
    const totalExpenses = await Expense.sum('amount', {
      where: businessFilter
    }) || 0;

    // Debts Owed to You (Unpaid Customer Debts)
    const debtsOwedToYou = await Debt.sum('amount', {
      where: {
        ...businessFilter,
        type: 'CUSTOMER_DEBT',
        status: 'PENDING'
      }
    }) || 0;

    // Debts You Owe Suppliers
    const supplierDebts = await Debt.sum('amount', {
      where: {
        ...businessFilter,
        type: 'SUPPLIER_DEBT',
        status: 'PENDING'
      }
    }) || 0;

    // Unsettled Customer Prepayments/Credits
    const customerCredits = await Debt.sum('amount', {
      where: {
        ...businessFilter,
        type: 'CUSTOMER_CREDIT',
        status: 'PENDING'
      }
    }) || 0;

    // Total Liabilities (Supplier Debts + Customer Credits)
    const debtsYouOwe = supplierDebts + customerCredits;

    // 3. Calculated Position Indicators
    // Actual Cash collected from sales (Total Completed Sales - Sales given on credit)
    const cashCollectedFromSales = totalSales - debtsOwedToYou;

    // Liquid Cash in Hand (Actual collected cash minus operational expenses paid)
    const cashInHand = cashCollectedFromSales - totalExpenses;

    // Net Financial Position (True overall financial balance)
    const netFinancialPosition = (cashInHand + debtsOwedToYou) - debtsYouOwe;

    // 4. Inventory, Recent Activity & Charts
    const lowStockProducts = await Product.findAll({
      where: {
        ...businessFilter,
        quantity_in_stock: { [Op.lte]: 5 }
      }
    });

    const recentOrders = await Order.findAll({
      where: businessFilter,
      limit: 5,
      order: [['created_at', 'DESC']]
    });

    const dailySales = await Order.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'sales']
      ],
      where: {
        ...businessFilter,
        status: 'completed'
      },
      group: [sequelize.literal('DATE(created_at)')],
      order: [[sequelize.literal('DATE(created_at)'), 'DESC']]
    });

    // 5. Render View with All Financial Data
    return res.render('dashboard/index', {
      totalProducts,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalProfit,
      
      // New Financial Balance Metrics
      totalSales,
      totalExpenses,
      debtsOwedToYou,
      debtsYouOwe,
      cashInHand,
      netFinancialPosition,

      lowStockProducts,
      recentOrders,
      dailySales,
      username,
      userRole: req.session.user?.role
    });

  } catch (error) {
    logger.error('Failed to load user dashboard:', error);
    return res.status(500).render('error', {
      message: 'Failed to open user dashboard panel.',
      username,
      userRole: req.session.user?.role
    });
  }
};