const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    order_number: {
      type: DataTypes.STRING,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    total_amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    profit_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    customer_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    customer_phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    underscored: true
  });

  return Order;
};