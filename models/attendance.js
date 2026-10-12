const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Attendance = sequelize.define('Attendance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    business_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    sign_in: {
      type: DataTypes.DATE,
      allowNull: false
    },
    sign_out: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'Attendances',
    timestamps: true,
    underscored: true
  });

  return Attendance;
};