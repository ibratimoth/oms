const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

  const StockMovement = sequelize.define(
    'StockMovement',
    {

      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

      type: {
        type: DataTypes.ENUM('IN', 'OUT'),
        allowNull: false
      },

      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

      reference: {
        type: DataTypes.STRING
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      tableName: 'stock_movements',
      timestamps: true,
      underscored: true
    }
  );

  return StockMovement;
};