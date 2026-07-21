const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Debt = sequelize.define('Debt', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    person_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('CUSTOMER_DEBT', 'SUPPLIER_DEBT', 'CUSTOMER_CREDIT'),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'CLEARED'),
      defaultValue: 'PENDING'
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true
    },
    order_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    business_id: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'debts',
    timestamps: true,
    underscored: true
  });

  return Debt;
};