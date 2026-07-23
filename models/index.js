const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

const User = require('./user')(sequelize);
const Product = require('./product')(sequelize);
const Order = require('./order')(sequelize);
const OrderItem = require('./orderItem')(sequelize);
const StockMovement = require('./stockMovement')(sequelize);
const Business = require('./business')(sequelize);
const Expense = require('./expense')(sequelize);
const Debt = require('./debt')(sequelize);
const Merchant = require('./merchant')(sequelize);

/* =========================
   RELATIONSHIPS
========================= */
Business.hasMany(User, { foreignKey: 'business_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
User.belongsTo(Business, { foreignKey: 'business_id' });

Business.hasMany(Product, { foreignKey: 'business_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Product.belongsTo(Business, { foreignKey: 'business_id' });

Business.hasMany(Order, { foreignKey: 'business_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Order.belongsTo(Business, { foreignKey: 'business_id' });

Business.hasMany(StockMovement, { foreignKey: 'business_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
StockMovement.belongsTo(Business, { foreignKey: 'business_id' });

// User → Orders
User.hasMany(Order, { foreignKey: 'created_by' });
Order.belongsTo(User, { foreignKey: 'created_by' });

// Order → OrderItems
Order.hasMany(OrderItem, { foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

// Product → OrderItems
Product.hasMany(OrderItem, { foreignKey: 'product_id' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id' });

Product.hasMany(StockMovement, {
  foreignKey: 'product_id'
});

StockMovement.belongsTo(Product, {
  foreignKey: 'product_id'
});

Product.belongsTo(User, {
  foreignKey: 'created_by'
});

User.hasMany(Product, {
  foreignKey: 'created_by'
});

// ==========================================
// EXPENSE RELATIONSHIPS
// ==========================================
Business.hasMany(Expense, { foreignKey: 'business_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Expense.belongsTo(Business, { foreignKey: 'business_id' });

User.hasMany(Expense, { foreignKey: 'created_by', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Expense.belongsTo(User, { foreignKey: 'created_by' });

// ==========================================
// DEBT RELATIONSHIPS
// ==========================================
Business.hasMany(Debt, { foreignKey: 'business_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Debt.belongsTo(Business, { foreignKey: 'business_id' });

Order.hasMany(Debt, { foreignKey: 'order_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Debt.belongsTo(Order, { foreignKey: 'order_id' });

// Order <-> Merchant Association
Order.belongsTo(Merchant, { foreignKey: 'merchant_id'});
Merchant.hasMany(Order, { foreignKey: 'merchant_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

module.exports = {
  sequelize,
  User,
  Product,
  Order,
  OrderItem,
  StockMovement,
  Business,
  Expense,
  Debt,
  Merchant
};