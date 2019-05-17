var express = require('express');
var app = express();
// var http = require('http').Server(app);
var https = require('https');
var fs = require("fs");
var winston = require('winston');
var mssql = require('../libs/mssql');
var utils = require('../libs/utils');
var opradb = require('../libs/opradb');
var redis = require('./libs/redis');
var ipfilter = require('express-ipfilter');
var heartbeats = require('../libs/heartbeats');
var bodyParser = require('body-parser');
var config = require('./config/config');
var helper = require('./libs/helper');
var partnerApi = require('./libs/partnerApi');


var args = process.argv.slice(2);
var operatorName = (typeof args[0] != 'undefined') ? args[0] : false;
if (!operatorName) {
    console.log('Debe especificar operador');
    process.exit();
}

if (typeof config.operator[operatorName] == 'undefined') {
    console.log('Operador invalido');
    process.exit();
} else {
    var operator = require(__dirname + '/config/' + config.operator[operatorName]);
}

var logger = new(winston.Logger)({
    transports: [
        //new (winston.transports.Console)({ timestamp: function() { return utils.now(); }, level: 'debug'}),
        new(winston.transports.File)({
            timestamp: function() {
                return utils.now();
            },
            filename: 'logs/' + operatorName + '_access.log',
            json: false
        })
    ]
});
var mssqlLogger = new(winston.Logger)({
    transports: [new(winston.transports.File)({
        timestamp: function() {
            return utils.now();
        },
        filename: 'logs/' + operatorName + '_mssql_access.log',
        json: false
    })]
});
var redisLogger = new(winston.Logger)({
    transports: [
        //new (winston.transports.Console)({ timestamp: function() { return utils.now(); }, colorize: true, level: 'debug'}),
        new(winston.transports.File)({
            timestamp: function() {
                return utils.now();
            },
            filename: 'logs/' + operatorName + '_server_redis_access.log',
            json: false
        })
    ]
});

/*** Start ***/
mssql.setConfig(config.mssql);
mssql.setLogger(mssqlLogger);
mssql.init();

heartbeats.setLogger(mssqlLogger);
heartbeats.setDB(mssql);
heartbeats.init(operator.serviceName, config.heartBeatInterval);

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
// app.use(xmlparser());

//IPs permititas!
app.use(ipfilter(config.server.whitelist, {
    mode: 'allow'
}));


const options = {
    key: fs.readFileSync("/var/node/vodacomza/certs/CertMultiDomain.key"),
    cert: fs.readFileSync("/var/node/vodacomza/certs/CertMultiDomainCHAIN_Nginx_new.crt")
};
https.createServer(options, app).listen(operator.port, function() {
    logger.info('Web Service started on port ' + operator.port);
});

redis.setConfig(config);
redis.setLogger(redisLogger);
redis.init();

opradb.setOperator(operator);
opradb.setDB(mssql);
opradb.setRedis(redis);
opradb.setLogger(logger);

helper.setConfig(config);
helper.setOperator(operator);
helper.setDB(mssql);
helper.setRedis(redis);
helper.setLogger(logger);

partnerApi.setConfig(operator);
partnerApi.setLogger(logger);

app.locals.config = config;
app.locals.logger = logger;
app.locals.mssql = mssql;
app.locals.opradb = opradb;
app.locals.operator = operator;
app.locals.utils = utils;
app.locals.redis = redis;
app.locals.helper = helper;
app.locals.partnerApi = partnerApi;

// var auth = require('./routes/authrate');
// app.use('/authrate/', auth);

var subscribe = require('./routes/subscribe');
app.use('/subscribe/', subscribe);

var subscribe_ni = require('./routes/subscribe_ni');
app.use('/subscribe_ni/', subscribe_ni);

var unsubscribe = require('./routes/unsubscribe');
app.use('/unsubscribe/', unsubscribe);

var modifycharging = require('./routes/modifycharging');
app.use('/modifycharging/', modifycharging);

var notification = require('./routes/notification');
app.use('/notification/', notification);

app.use(function(req, res, next) {
    res.status(404).send('404: Page not Found');
});

process.on('SIGINT', function() {
    doExit();
});
process.on('uncaughtException', function(err) {
    logger.debug('Uncaught Exception: ' + err);
    doExit();
});

function doExit() {
    logger.error('Server shutdown unexpectedly');
    process.exit();
}