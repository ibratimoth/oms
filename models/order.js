const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
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
    discount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
      allowNull: false
    },
    final_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00,
      allowNull: false
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
    business_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    payment_method: {
      type: DataTypes.ENUM('CASH', 'LIPA_NUMBER', 'CREDIT'),
      defaultValue: 'CASH',
      allowNull: false
    },
    merchant_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'merchants',
        key: 'id'
      }
    }
  }, {
    tableName: 'orders',
    timestamps: true,
    underscored: true
  });

  return Order;
};