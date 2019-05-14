var express = require('express');
var router = express.Router();
var async = require('async');
var medios = require('/var/resources/medios');

var config, logger, mssql, opradb, operator, helper, params;

router.post('/', function(req, res, next) {
    config = req.app.locals.config;
    logger = req.app.locals.logger;
    mssql = req.app.locals.mssql;
    opradb = req.app.locals.opradb;
    operator = req.app.locals.operator;
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
        logger.error('Subscribe EXITING with ERROR - Missing params: ' + JSON.stringify(params));
        res.status(status).send(responseObj);
        res.end();
    } else {

        async.waterfall([
            (cb) => {
                if (typeof operator.paquete[params.paqueteId] != 'undefined') {
                    var data = {
                        msisdn: params.msisdn,
                        isActive: false,
                        paqueteid: params.paqueteId,
                        medioid: params.medioId,
                        sponsorid: operator.sponsorId,
                        mds: params.medioSuscripcionId || null,
                        adNetworkId: params.adNetwork || null,
                        pixel: params.pixel || null,
                        pub: params.pub || null,
                        portal: params.portal || null,
                        aplicacionid: operator.paquete[params.paqueteId].aplicacionid,
                        serviceid: operator.paquete[params.paqueteId].serviceid,
                        paquetes: operator.paquete[params.paqueteId].packages,
                        paquetesCheck: operator.paquete[params.paqueteId].paquetesCheck,
                        simplePackageId: operator.paquete[params.paqueteId].simplepackageid,
                        packageid: null,
                        defaultPackageId: null,
                        fallback: operator.paquete[params.paqueteId].fallback,
                        fallbackPaquetes: null,
                        fallbackPackageId: null,
                        externalUserId: null,
                        success: 0
                    };
                    if (data.fallback) {
                        data.fallbackPaquetes = operator.paquete[data.fallback].packages

                    }
                    logger.info('[subscriptionwithoutussdjs][LOG-DATA] : '+JSON.stringify(data));
                    
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
                helper.requestAuth(data, (err, rs) => {
                    if (err) {
                        cb(true, rs);
                    } else {
                        cb(null, rs);
                    }
                });
            },
            (data, cb) => {
                // subscribe voda
                // auth rate dio suscrito. evitamos el subscribe externo, pero suscribimos local
                if (!data.isActive) {
                    data.packageid = data.defaultPackageId;
                    logger.info('Msisdn: ' + data.msisdn + ' | trying to request subscription on paqueteid: ' + data.paqueteid);
                    helper.requestSubscription(data, (err, rs) => {
                        if (err) {
                            if (data.success == -1 && data.fallback) {
                                // falló la suscripción y hay fallback, intentamos...
                                data.packageid = data.fallbackPackageId;
                                data.paqueteid = fallback;
                                data.aplicacionid = operator.paquete[data.paqueteid].aplicacionid;
                                logger.debug('Msisdn: ' + data.msisdn + ' | trying to request subscription on fallback paqueteid: ' + fallback)
                                helper.requestSubscription(data, (err, rs) => {
                                    if (err) {
                                        cb(true, rs);
                                    } else {
                                        cb(null, rs);
                                    }
                                });

                            } else {
                                cb(true, rs);
                            }
                        } else {
                            cb(null, rs);
                        }
                    });
                } else {
                    if (data.paqueteid != operator.paquete.reverse[data.packageid]) {
                        data.paqueteid = operator.paquete.reverse[data.packageid];
                        data.aplicacionid = operator.paquete[data.paqueteid].aplicacionid;
                    }
                    cb(null, data);
                }
            },
            (data, cb) => {
                // si llegamos aca con isActive 1 es porque dio en el auth rate, pero localmente no lo tenemos. no se presuscribe
                logger.info('[subscriptionwithoutussdjs][enter to insertPresubscription ] data.adNetworkId: '+data.adNetworkId+' | data.pixel: '+data.pixel);
                if (!data.isActive && typeof data.adNetworkId != 'undefined' && typeof data.pixel != 'undefined' && data.adNetworkId && data.pixel) {
                    var logText = 'Presubscription | Portal: ' + data.portal + ' | AdNetwork: ' + data.adNetworkId + ' | pixel: ' + data.pixel;
                    if (typeof data.pub != 'undefined' && data.pub) {
                        logText = logText + ' | Pub: ' + data.pub;
                    }
                    logger.debug(logText);
                    helper.insertPresubscription(data, (err, data) => {
                        if (err) {
                            logger.error('Insert Presubscription Error. Data: ' + JSON.stringify(data));
                        }
                    });
                }
                cb(null, data);
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
                if (!err){
                    logger.info('Subscription inserted. Msisdn: ' + rs.msisdn + ' | SubscriptionId: ' + rs.suscripcionid + ' | ExternalUserId: ' + rs.externalUserId);
                    logger.debug('Subscribe - Record: ' + JSON.stringify(rs));
                    responseObj.statusCode = '0';
                    responseObj.statusMsg = 'Process successful';
                }else{
                    if (typeof rs.isActive != 'undefined' && rs.isActive) {
                        responseObj.statusCode = '101';
                        responseObj.statusMsg = 'User already active';
                        logger.info('Subscription already active. Msisdn: ' + rs.msisdn + ' | SubscriptionId: ' + rs.suscripcionid);
                    } else {
                        status = 500;
                        responseObj.statusMsg = 'Process error';
                    }
                    logger.error('Subscribe EXITING with ERROR - Record: ' + JSON.stringify(rs));
                }
                // logger.info(response);
                res.status(status).send(responseObj);
                res.end();
            }
        );
    }
});

module.exports = router;
