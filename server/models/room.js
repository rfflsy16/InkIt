  'use strict';
  const {
    Model
  } = require('sequelize');
  module.exports = (sequelize, DataTypes) => {
    class Room extends Model {
      /**
       * Helper method for defining associations.
       * This method is not a part of Sequelize lifecycle.
       * The `models/index` file will call this method automatically.
       */
      static associate(models) {
        Room.belongsTo(models.Category, { foreignKey: 'CategoryId' })
      }
    }
    Room.init({
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Name is required"
          }
        }
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "waiting",
        validate: {
          notEmpty: {
            msg: "Status is required"
          }
        }
      },
      CategoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      maxPlayer: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 4
      },
      game: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Game is required"
          }
        }
      }
    }, {
      sequelize,
      modelName: 'Room',
      hooks: {
        beforeCreate: (room, options) => {
          room.status = "waiting"
        }
      }
    });
    return Room;
  };