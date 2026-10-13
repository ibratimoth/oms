const { Order, Product, Expense, Debt, sequelize, OrderItem } = require('../models');
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
    const totalSales = await Order.sum('final_amount', {
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

    // NEW: Total Cost of All Registered Products (buy_price * quantity_in_stock)
    // We fetch all products for the business and sum up (buy_price * quantity_in_stock)
    const allProducts = await Product.findAll({
      where: businessFilter,
      attributes: ['buy_price', 'quantity_in_stock']
    });

    const totalRegisteredProductsCost = allProducts.reduce((sum, p) => {
      const buyPrice = p.buy_price || 0;
      const qty = p.quantity_in_stock || 0;
      return sum + (buyPrice * qty);
    }, 0);

    // NEW: Total Cost of All Sold Products (COGS)
    // We join OrderItems with completed Orders filtered by business
    const soldOrderItems = await OrderItem.findAll({
      include: [
        {
          model: Order,
          where: { ...businessFilter, status: 'completed' },
          attributes: []
        },
        {
          model: Product,
          attributes: ['buy_price']
        }
      ]
    });

    const totalSoldProductsCost = soldOrderItems.reduce((sum, item) => {
      const buyPrice = item.Product ? (item.Product.buy_price || 0) : 0;
      const quantitySold = item.quantity || 0;
      return sum + (buyPrice * quantitySold);
    }, 0);
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

      // NEW: Cost Metrics
      totalRegisteredProductsCost,
      totalSoldProductsCost,

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