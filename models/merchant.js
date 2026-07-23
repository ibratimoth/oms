// models/Merchant.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Merchant = sequelize.define('Merchant', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING, // e.g., 'M-Pesa Lipa', 'NMB Lipa', 'CRDB Till'
      allowNull: false
    },
    account_number: {
      type: DataTypes.STRING, // e.g., '5432100' or Till / Lipa Number
      allowNull: true
    },
    provider: {
      type: DataTypes.STRING, // e.g., 'Vodacom', 'NMB', 'CRDB', 'Airtel'
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    business_id: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    tableName: 'merchants',
    timestamps: true,
    underscored: true
  });

  return Merchant;
};