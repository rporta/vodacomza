var async = require('async');
var express = require('express');
var router = express.Router();
var request = require('request');
var util = require('util');
var medios = require('/var/resources/medios');
// var xml2js = require('xml2js');
// var builder = require('xmlbuilder');
var xmlparser = require('express-xml-bodyparser');


var operator, logger, opradb, mssql, config, helper, body, params, utils, redis, partnerApi;

router.post('/', xmlparser({trim: false, explicitArray: false}), (req, res, next) => {
    config = req.app.locals.config;
    logger = req.app.locals.logger;
    mssql = req.app.locals.mssql;
    opradb = req.app.locals.opradb;
    operator = req.app.locals.operator;
    utils = req.app.locals.utils;
    redis = req.app.locals.redis;
    helper = req.app.locals.helper;
    partnerApi = req.app.locals.partnerApi;
    body = req.body;

    // logger.error("TRANS " + body['er-response']['$']['external-trans-id']);

    if (typeof body['er-response'] == 'undefined'
        || typeof body['er-response']['$'] == 'undefined'
        || typeof body['er-response']['$']['id'] == 'undefined'
        || typeof body['er-response']['$']['external-trans-id'] == 'undefined'
        || typeof body['er-response']['payload'] == 'undefined'
    ) {
        logger.error('Subscribe Notification EXITING with ERROR - Missing params: ' + JSON.stringify(body));
        res.status(400).send('Bad request');
        res.end();
    } else if (body['er-response']['$']['id'] != '100008'
        || typeof body['er-response']['payload']['usage-authorisation'] == 'undefined'
        || typeof body['er-response']['payload']['usage-authorisation']['is-success'] == 'undefined'
        || body['er-response']['payload']['usage-authorisation']['is-success'] != 'true'
    ) {
        logger.error('Subscribe Notification EXITING. Not success: ' + JSON.stringify(body));
        res.status(200).send('');
        res.end();
    } else {
        logger.debug('Subscribe Notification Received: ' + JSON.stringify(body));
        params = body['er-response']['payload'];
        res.status(200).send('');
        res.end();
        async.waterfall([
            (cb) => {
                redis.get(body['er-response']['$']['external-trans-id'], (data) => {
                    // logger.debug(data);
                    if (data) {
                        logger.debug(data);
                        data = JSON.parse(data);
                        // logger.debug(data.msisdn);
                        data.externalUserId = params['usage-authorisation']['package-subscription-id'];
                        cb(null, data);
                    } else {
                        logger.error('No redis object for key ' + body['er-response']['$']['external-trans-id']);
                        cb(true);
                    }
                });
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
            // innecesario. el mds ya lo tenemos en el obj de redis
            // (data, cb) => {
            //     // presuscripcion
            //     helper.getPresubscription(data, function(err, data){
            //         cb(null, data);
            //     });
            // },
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
                data.keyword = 'Auto-generado por ' + operator.serviceName + ' Alta (USSD)';
                data.estadoesid = 8;
                opradb.insertMO(data, {}, (err,datab) => {
                    if (err) {
                        // si falla insert mo seguimos adelante. no debe pasar bajo circunstancias normales!
                        cb(null, data);
                    } else {
                        cb(null, datab);
                    }
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
            },
            (data, cb) => {
                partnerApi.interactsWithPartnerApi(data, (err, data) => {
                    cb(null, data);
                });
            },
            (data, cb) => {
                if (data.interactsWithPartnerApi == 1) {
                    data.shortcode = medios[data.medioid].charge.Medio;
                    data.medioid = medios[data.medioid].charge.MedioId;
                    data.partnerApiPassword = partnerApi.generatePassword();
                    partnerApi.addUser(data, (err, data) => {
                        if (!err) {
                            cb(null, data);
                        } else {
                            logger.error('Error while adding partner API user: ' + JSON.stringify(data));
                            cb(null, data); // no levantamos error.
                        }
                    })
                } else {
                    cb(null, data);
                }
            },
            (data, cb) =>  {
                data.salidaid = null;
                if (typeof params['usage-authorisation']['payment-status'] != 'undefined'
                    && typeof params['usage-authorisation']['payment-status']['code'] != 'undefined'
                    && typeof params['usage-authorisation']['rate'] != 'undefined'
                    && params['usage-authorisation']['rate'] > 0
                ) {
                    data.shortcode = medios[data.medioid].charge.Medio;
                    data.medioid = medios[data.medioid].charge.MedioId;
                    data.contenido = 'Auto-generado por ' + operator.serviceName;
                    data.estadoesid = (params['usage-authorisation']['payment-status']['code'] == 'ACCEPTED') ? 3 : 18;

                    opradb.insertMT(data, (err, data) => {
                        if (!err){
                            logger.debug('MT inserted. SalidaId: ' + data.salidaid);
                            cb(null, data);
                        } else {
                            cb(true, data);
                        }
                    });
                } else {
                    cb(null, data);
                }
            },
            (data, cb) => {
                if (data.salidaid && data.estadoesid == 3) {
                    opradb.updateMT(data, (err, data) => {
                        cb(null, data);
                    });
                } else {
                    cb(null, data);
                }
            }
            /*(data, cb) => {
                if (data.salidaid && data.estadoesid == 24) {
                    logger.debug('Inserting SalidaMonto.');

                    data.monto = params['usage-authorisation']['rate'];
                    opradb.insertSalidaMonto(data, (err, data) => {
                        if (!err) {
                            cb(null, data);
                        } else {
                            logger.error('Unable to insert SalidaMonto: ' + JSON.stringify(data));
                            cb(null, data);
                        }
                    });
                } else {
                    cb(null, data);
                }

            }*/
            ],
            (err, rs) => {
                var statusMsg = 'Process successful';
                if (!err){
                    redis.del(rs.transId);
                    logger.debug('Subscribe Notification - Record: ' + JSON.stringify(rs));
                    logger.info('Subscribe Notification | Msisdn: ' + rs.msisdn + ' | SubscriptionId: ' + rs.suscripcionid + ' | ExternalUserId: ' + rs.externalUserId + ' | OK');
                }else{
                    status = 500;
                    statusMsg = 'Process error';
                    logger.debug('Subscribe Notification EXITING with ERROR - Record: ' + JSON.stringify(rs));
                    var errorlog = 'Subscribe Notification | ';
                    if (rs && typeof rs.msisdn != 'undefined') {
                        errorlog += 'Msisdn: ' + rs.msisdn + ' | ';
                        if (typeof rs.isActive != 'undefined' && rs.isActive == 1) {
                            errorlog += ' User already active | ';
                        }
                    }
                    logger.info(errorlog + 'ERROR');
                }
            }
        );
    }
});

router.get('/', (req, res, next) => {
    logger.error('Incoming notification request with WRONG method');
    res.status(405).send('');
    res.end();
});

module.exports = router;
