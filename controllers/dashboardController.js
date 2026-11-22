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

    // Operating expenses reduce profit; restock entries are inventory replenishment
    const operatingExpenseWhere = {
      ...businessFilter,
      [Op.or]: [
        { affects_profit: true },
        { affects_profit: null, entry_type: { [Op.ne]: 'RESTOCK_INVENTORY' } }
      ]
    };

    const restockWhere = {
      ...businessFilter,
      [Op.or]: [
        { entry_type: 'RESTOCK_INVENTORY' },
        { affects_profit: false }
      ]
    };

    const [
      totalProducts,
      totalOrders,
      completedOrders,
      pendingOrders,
      rawGrossProfit,
      rawTotalSales,
      rawOperatingExpenses,
      rawRestockSpend,
      rawDebtsOwedToYou,
      rawSupplierDebts,
      rawCustomerCredits,
      lowStockProducts,
      recentOrders,
      dailySales,
      allProducts,
      soldOrderItems
    ] = await Promise.all([
      Product.count({ where: businessFilter }),
      Order.count({ where: businessFilter }),
      Order.count({ where: { ...businessFilter, status: 'completed' } }),
      Order.count({ where: { ...businessFilter, status: 'pending' } }),
      Order.sum('profit_amount', { where: { ...businessFilter, status: 'completed' } }),
      Order.sum('final_amount', { where: { ...businessFilter, status: 'completed' } }),
      Expense.sum('amount', { where: operatingExpenseWhere }),
      Expense.sum('amount', { where: restockWhere }),
      Debt.sum('amount', {
        where: { ...businessFilter, type: 'CUSTOMER_DEBT', status: 'PENDING' }
      }),
      Debt.sum('amount', {
        where: { ...businessFilter, type: 'SUPPLIER_DEBT', status: 'PENDING' }
      }),
      Debt.sum('amount', {
        where: { ...businessFilter, type: 'CUSTOMER_CREDIT', status: 'PENDING' }
      }),
      Product.findAll({
        where: { ...businessFilter, quantity_in_stock: { [Op.lte]: 5 } },
        order: [['quantity_in_stock', 'ASC']]
      }),
      Order.findAll({
        where: businessFilter,
        limit: 5,
        order: [['created_at', 'DESC']]
      }),
      Order.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
          [sequelize.fn('SUM', sequelize.col('total_amount')), 'sales']
        ],
        where: { ...businessFilter, status: 'completed' },
        group: [sequelize.literal('DATE(created_at)')],
        order: [[sequelize.literal('DATE(created_at)'), 'DESC']]
      }),
      Product.findAll({
        where: businessFilter,
        attributes: ['buy_price', 'quantity_in_stock']
      }),
      OrderItem.findAll({
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
      })
    ]);

    const totalProfit = Number(rawGrossProfit) || 0; // Gross profit from completed orders
    const totalSales = Number(rawTotalSales) || 0;
    const totalOperatingExpenses = Number(rawOperatingExpenses) || 0;
    const totalRestockSpend = Number(rawRestockSpend) || 0;
    const totalCashOutflow = totalOperatingExpenses + totalRestockSpend;

    // Backward-compatible alias for any view still reading totalExpenses as total cash outflow
    const totalExpenses = totalCashOutflow;

    // True Net Profit = Gross Profit minus operating expenses (excludes restock inventory)
    const netProfit = totalProfit - totalOperatingExpenses;
    const grossMarginPct = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
    const netProfitMarginPct = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const opExRatioPct = totalSales > 0 ? (totalOperatingExpenses / totalSales) * 100 : 0;

    const debtsOwedToYou = Number(rawDebtsOwedToYou) || 0;
    const supplierDebts = Number(rawSupplierDebts) || 0;
    const customerCredits = Number(rawCustomerCredits) || 0;
    const debtsYouOwe = supplierDebts + customerCredits;

    // Cash flow & position metrics
    const cashCollectedFromSales = totalSales - debtsOwedToYou;
    const cashInHand = cashCollectedFromSales - totalCashOutflow;

    // Cost of registered stock & sold goods
    const totalRegisteredProductsCost = allProducts.reduce((sum, p) => {
      const buyPrice = Number(p.buy_price) || 0;
      const qty = Number(p.quantity_in_stock) || 0;
      return sum + (buyPrice * qty);
    }, 0);

    const totalSoldProductsCost = soldOrderItems.reduce((sum, item) => {
      const buyPrice = item.Product ? (Number(item.Product.buy_price) || 0) : 0;
      const quantitySold = Number(item.quantity) || 0;
      return sum + (buyPrice * quantitySold);
    }, 0);

    // Liquid cash + receivables - liabilities
    const netFinancialPosition = (cashInHand + debtsOwedToYou) - debtsYouOwe;

    // Total current assets including shelf stock cost
    const totalCurrentAssets = cashInHand + totalRegisteredProductsCost + debtsOwedToYou;
    const netWorthWithStock = totalCurrentAssets - debtsYouOwe;

    logger.info('Dashboard metrics loaded', {
      userId,
      business_id,
      totalSales,
      totalProfit,
      totalOperatingExpenses,
      totalRestockSpend,
      netProfit,
      cashInHand,
      netFinancialPosition
    });

    return res.render('dashboard/index', {
      totalProducts,
      totalOrders,
      completedOrders,
      pendingOrders,

      // Profit & Margin Metrics
      totalProfit,
      totalOperatingExpenses,
      totalRestockSpend,
      totalCashOutflow,
      netProfit,
      grossMarginPct,
      netProfitMarginPct,
      opExRatioPct,

      // Financial Balance & Cash Metrics
      totalSales,
      totalExpenses,
      cashCollectedFromSales,
      debtsOwedToYou,
      supplierDebts,
      customerCredits,
      debtsYouOwe,
      cashInHand,
      netFinancialPosition,
      totalCurrentAssets,
      netWorthWithStock,

      // Inventory & COGS Metrics
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