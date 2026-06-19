// 'use strict';

// const fs = require('fs');
// const path = require('path');
// const Sequelize = require('sequelize');
// const process = require('process');
// const basename = path.basename(__filename);
// const env = process.env.NODE_ENV || 'development';
// const config = require(__dirname + '/../config/config.js')[env];
// const db = {};

// let sequelize;
// if (config.use_env_variable) {
//   sequelize = new Sequelize(process.env[config.use_env_variable], config);
// } else {
//   sequelize = new Sequelize(config.database, config.username, config.password, config);
// }

// fs
//   .readdirSync(__dirname)
//   .filter(file => {
//     return (
//       file.indexOf('.') !== 0 &&
//       file !== basename &&
//       file.slice(-3) === '.js' &&
//       file.indexOf('.test.js') === -1
//     );
//   })
//   .forEach(file => {
//     const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
//     db[model.name] = model;
//   });

// Object.keys(db).forEach(modelName => {
//   if (db[modelName].associate) {
//     db[modelName].associate(db);
//   }
// });

// db.sequelize = sequelize;
// db.Sequelize = Sequelize;

// module.exports = db;


const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

const User = require('./user')(sequelize);
const Product = require('./product')(sequelize);
const Order = require('./order')(sequelize);
const OrderItem = require('./orderItem')(sequelize);
const StockMovement = require('./StockMovement')(sequelize);

/* =========================
   RELATIONSHIPS
========================= */

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

module.exports = {
  sequelize,
  User,
  Product,
  Order,
  OrderItem,
  StockMovement
};