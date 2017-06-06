const winston = require('winston');
const config = require('../configuration/config');

const logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
    	  colorize: true,
    	  level: config.logLevel
       })
       /*,
      new (winston.transports.File)({
    	  filename: config.logFile 
       })*/
    ]
});

module.exports = logger;