const { Sequelize } = require('sequelize');
const path = require('path');

// This creates a simple file named 'database.sqlite' in your backend folder
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'), 
    logging: false // Set to console.log to see raw SQL queries
});

module.exports = sequelize;