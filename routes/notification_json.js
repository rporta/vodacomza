var async = require('async');
var express = require('express');
var router = express.Router();
var request = require('request');
var util = require('util');
var medios = require('/var/resources/medios');

var operator, logger, opradb, mssql, config, helper, body, params, utils;

router.post('/', function(req, res, next) {
    config = req.app.locals.config;
    logger = req.app.locals.logger;
    mssql = req.app.locals.mssql;
    opradb = req.app.locals.opradb;
    operator = req.app.locals.operator;
    utils = req.app.locals.utils;
    helper = req.app.locals.helper;
    body = req.body;

    // var responseObj = {
    //     statusCode : -1,
    //     statusMsg : 'Error'
    // };

    status = 200;

    if (typeof body.username == 'undefined'
        || body.username != operator.callback.user
        || typeof body.password == 'undefined'
        || body.password != operator.callback.password
    ) {
        logger.error('Subscribe Callback EXITING with ERROR - Wrong credentials: ' + JSON.stringify(body));
        res.status(403).send('Unauthorized');
        res.end();
    } else if (typeof body.results == 'undefined'
        || !body.results
        || typeof body.results.purchaseResponse == 'undefined'
        || !body.results.purchaseResponse
        || typeof body.results.purchaseResponse.msisdn == 'undefined'
        || !body.results.purchaseResponse.msisdn
        || typeof body.results.purchaseResponse.packageid == 'undefined'
        || !body.results.purchaseResponse.packageid
        || typeof body.results.purchaseResponse.errorCode == 'undefined'
        || !body.results.purchaseResponse.errorCode
    ) {
        // partimos del supuesto de que recibiremos msisdn, package y un status
        // cuando confirmen la estructura de purchaseResponse se actualizará
        logger.error('Subscribe Callback EXITING with ERROR - Missing params: ' + JSON.stringify(body));
        res.status(400).send('Bad request');
        res.end();
    } else if (body.results.purchaseResponse.errorCode != 'success') { // de la manera que lo envíen
        logger.error('Subscribe Callback EXITING. Not success: ' + JSON.stringify(body));
        res.status(200).send('');
        res.end();
    } else {
        params = body.results.purchaseResponse;
        async.waterfall([
            (cb) => {
                params.paqueteId = operator.paquete.reverse[params.packageid];
                if (typeof operator.paquete[params.paqueteId] != 'undefined') {
                    var data = {
                        msisdn: params.msisdn,
                        isActive: false,
                        paqueteid: params.paqueteId,
                        medioid: operator.paquete[params.paqueteId].medioid,
                        sponsorid: operator.sponsorId,
                        mds: params.medioSuscripcionId || null,
                        adNetworkId: params.adNetwork || null,
                        pixel: params.pixel || null,
                        pub: params.pub || null,
                        portal: params.portal || null,
                        aplicacionid: operator.paquete[params.paqueteId].aplicacionid,
                        // serviceid: operator.paquete[params.paqueteId].serviceid,
                        // paquetes: operator.paquete[params.paqueteId].packages,
                        // paquetesCheck: operator.paquete[params.paqueteId].paquetesCheck,
                        // simplePackageId: operator.paquete[params.paqueteId].simplepackageid,
                        packageid: params.packageid,
                        // defaultPackageId: null,
                        // fallback: operator.paquete[params.paqueteId].fallback,
                        // fallbackPaquetes: null,
                        // fallbackPackageId: null,
                        externalUserId: params.packagesubscriptionid,
                        success: 0
                    };

                    cb(null, data);
                } else {
                    logger.error('Error getting internal package values from config for paqueteId ' + params.paqueteId);
                    cb(true, data);
                }
            },
            (data, cb) => {
                // isactive local
                opradb.getActiveSubscriptions(data, function(err, data){
                    if (!err && typeof data.subscriptions !== 'undefined' && data.subscriptions.length > 0) {
                        for (var i in data.subscriptions) {
                            if (data.paquetesCheck.indexOf(data.subscriptions[i].PaqueteId) >= 0) {
                                logger.error('User already active: paqueteId ' + data.subscriptions[i].PaqueteId);
                                data.isActive = 1;
                                data.suscripcionid = data.subscriptions[i].SuscripcionId;
                            }
                        }
                        if (data.isActive) {
                            cb(true, data);
                        } else {
                            cb(null, data);
                        }
                    } else {
                        cb(null, data);
                    }
                });
            },
            (data, cb) => {
                // presuscripcion
                helper.getPresubscription(data, function(err, data){
                    cb(null, data);
                });
            },
            (data, cb) => {
                // subscribe local
                data.shortcode = medios[data.medioid].charge.Medio;
                opradb.insertSubscription(data, (err, datab) => {
                    if (!err) {
                        cb(null, datab);
                    }else{
                        logger.error('Unable to process subscription: ' + JSON.stringify(data));
                        cb(true, data);
                    }
                });
            },
            (data, cb) => {
                data.shortcode = medios[data.medioid].free.Medio;
                data.medioid = medios[data.medioid].free.MedioId;
                data.keyword = 'Auto-generado por ' + operator.serviceName;
                data.estadoesid = 8;
                opradb.insertMO(data, {}, (err,datab) => {
                    cb(null, data);
                });
            },
            (data, cb) => {
                // map subscription
                if (data.suscripcionid > 0) {
                    helper.insertSubscriptionMap(data, (err, data) => {
                        if (!err) {
                            cb(null, data);
                        } else {
                            cb(true, data);
                        }
                    });
                } else {
                    cb(true, data);
                }
            }],
            (err, rs) => {
                var statusMsg = 'Process successful';
                if (!err){
                    logger.info('Subscription inserted. Msisdn: ' + rs.msisdn + ' | SubscriptionId: ' + rs.suscripcionid + ' | ExternalUserId: ' + rs.externalUserId);
                    logger.debug('Subscribe Callback - Record: ' + JSON.stringify(rs));
                }else{
                    status = 500;
                    statusMsg = 'Process error';
                    logger.error('Subscribe Callback EXITING with ERROR - Record: ' + JSON.stringify(rs));
                }
                // logger.info(response);
                res.status(status).send(statusMsg);
                res.end();
            }
        );
    }
});

module.exports = router;
