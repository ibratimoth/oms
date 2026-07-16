const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

  const StockMovement = sequelize.define(
    'StockMovement',
    {

      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
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
      business_id: {
        type: DataTypes.UUID,
        allowNull: true
      },
      created_by: {
        type: DataTypes.UUID,
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