'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Expense = sequelize.define('Expense', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    entry_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'OPERATING_EXPENSE', // 'OPERATING_EXPENSE' | 'RESTOCK_INVENTORY'
      validate: {
        isIn: [['OPERATING_EXPENSE', 'RESTOCK_INVENTORY']]
      }
    },
    affects_profit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    expense_date: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW
    },
    business_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'expenses',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeValidate(expense) {
        // Keep affects_profit consistent with entry_type when not explicitly overridden
        if (expense.entry_type === 'RESTOCK_INVENTORY' && expense.changed('entry_type') && !expense.changed('affects_profit')) {
          expense.affects_profit = false;
        } else if (expense.entry_type === 'OPERATING_EXPENSE' && expense.changed('entry_type') && !expense.changed('affects_profit')) {
          expense.affects_profit = true;
        }
      }
    }
  });

  return Expense;
};