var express = require('express');
var router = express.Router();
var async = require('async');
var medios = require('/var/resources/medios');

var config, logger, mssql, opradb, operator, helper, params, utils;

router.post('/', (req, res, next) => {
    config = req.app.locals.config;
    logger = req.app.locals.logger;
    mssql = req.app.locals.mssql;
    opradb = req.app.locals.opradb;
    operator = req.app.locals.operator;
    utils = req.app.locals.utils;
    helper = req.app.locals.helper;
    params = req.body;

    var responseObj = {
        statusCode : -1,
        statusMsg : 'Error'
    };

    status = 200;

    if(!params.medioId || !params.msisdn || !params.paqueteId) {
        status = 400;
        responseObj.statusMsg = 'Missing Params.';
        logger.error('Modify Charging EXITING with ERROR - Missing params: ' + JSON.stringify(params));
        res.status(status).send(responseObj);
        res.end();
    } else {

        async.waterfall([
            (cb) => {
                var data = {
                    msisdn: params.msisdn,
                    medioid: medios[params.medioId].charge.MedioId,
                    paqueteid: params.paqueteId,
                    suscripcionid: null,
                    externalUserId: params.externalUserId || null,
                    paquetesCheck: operator.paquete[params.paqueteId].paquetesCheck,
                    aplicacionid: operator.paquete[params.paqueteId].aplicacionid,
                    success: 0,
                    isActive: 0
                };
                cb(null, data);
            },
            (data, cb) => {
                // isactive local
                opradb.getActiveSubscription(data, function(err, data){
                    if (!err){
                        data.isActive = 1;
                        cb(null, data);
                    } else {
                        if (data.externalUserId) {
                            cb(null, data);
                        } else {
                            cb(true, data);
                        }
                    }
                });
            },
            (data, cb) => {
                if (data.isActive) {
                    helper.getSubscriptionMap(data, (err, rs) => {
                        if (err) {
                            logger.debug('No ExternalUserId');
                            cb(true, data);
                        } else {
                            logger.debug('ExternalUserId: ' + rs.externalUserId);
                            cb(null, rs);
                        }
                    });
                } else {
                    logger.debug('No Internal Subscription - Will trigger remote unsubscription only');
                    cb(null, data);
                }
            },
            (data, cb) => {
                // unsubscribe voda
                if (data.externalUserId) {
                    logger.debug('Msisdn: ' + data.msisdn + ' | SubscriptionId: ' + data.suscripcionid + ' | ExternalUserId: ' + data.externalUserId + ' | trying to request unsubscription');
                    helper.requestModifyCharging(data, (err, rs) => {
                        if (err) {
                            cb(true, rs);
                        } else {
                            cb(null, rs);
                        }
                    });
                } else {
                    logger.debug('Msisdn: ' + data.msisdn + ' | SubscriptionId: ' + data.suscripcionid + ' | No ExternalUserId - Skipping External unsubscription request');
                    cb(true, data);
                }

            }],
            (err, rs) => {
                var logresult = 'Modify Charging | ';
                if (!err){
                    logresult += 'Msisdn: ' + rs.msisdn + ' | SubscriptionId: ' + rs.suscripcionid + ' | ExternalUserId: ' + rs.externalUserId + ' | ';
                    logresult += (rs.isActive) ? 'OK' : 'User not subscribed';
                    logger.info(logresult);
                    responseObj.statusCode = '0';
                    responseObj.statusMsg = 'Process successful';
                }else{
                    status = 500;
                    responseObj.statusMsg = 'Process error';
                    logger.error('Modify Charging EXITING with ERROR - Record: ' + JSON.stringify(rs));
                    // logger.info('Unsubscribe | Msisdn: ' + rs.msisdn + ' | SubscriptionId: ' + rs.suscripcionid + ' | ExternalUserId: ' + rs.externalUserId + ' | OK');
                    if (rs && typeof rs.msisdn != 'undefined') {
                        logresult += 'Msisdn: ' + rs.msisdn + ' | ';
                        if (typeof rs.isActive != 'undefined' && rs.isActive == 0) {
                            logresult += ' User not active | ';
                        }
                    }
                    logger.info(logresult + 'ERROR');

                }
                res.status(status).send(responseObj);
                res.end();
            }
        );
    }
});

module.exports = router;