var async = require('async');
var express = require('express');
var router = express.Router();
var request = require('request');
var util = require('util');


var operator, logger, opradb, mssql;

router.get('/', function(req, res, next) {
    operator = req.app.locals.operator;
    logger = req.app.locals.logger;
    opradb = req.app.locals.opradb;
    mssql = req.app.locals.mssql;

    if (typeof req.query != 'undefined'
        && typeof req.query.msisdn != 'undefined'
        && typeof req.query.paquetes == 'object'
        && typeof req.query.medioId != 'undefined'
    ) {
        var data = {
            msisdn: req.query.msisdn,
            medioid: req.query.medioId,
            paqueteid: req.query.paquetes[0]
        };

        try{
            opradb.isActive(data, function (error, result){
                logger.info('isActive | Msisdn: ' + data.msisdn + ' | MedioId: ' + data.medioid + ' | PaqueteId: ' + data.paqueteid + ' | Subscribed: ' + result);
                if (!error){
                    res.status(200).json({ statusCode: 0, data: { subscribed: result } });
                } else {
                    res.status(200).json({ statusCode: 0, data: { subscribed: 0 } });
                }
            });

        }catch(err){
            logger.error('Exception trying to validate subscription: ' + err);
            res.status(200).json({ statusCode: -1000 });
        }

    } else {
        logger.error('Request isActive con datos obligatorios faltantes. Params: ' + JSON.stringify(req.query));
        res.status(200).json({ statusCode: -100 });
    }
});

module.exports = router;
