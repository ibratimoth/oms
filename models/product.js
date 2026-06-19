const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    buy_price: {
      type: DataTypes.FLOAT
    },
    sell_price: {
      type: DataTypes.FLOAT
    },
    quantity_in_stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    reorder_level: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },
    // The database trigger handles this if it's sent as null or an empty string
    barcode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'products',
    timestamps: true,
    underscored: true // Maps camelCase queries to snake_case database columns seamlessly
  });

  return Product;
};