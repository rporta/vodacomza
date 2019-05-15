var express = require('express');
var router = express.Router();
var async = require('async');

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
        statusCode: -1,
        statusMsg: 'Error'
    };

    var status = 200;

    if (!params.msisdn) {
        status = 400;
        responseObj.statusMsg = 'Missing Params.';
        logger.error('Subscribe NI EXITING with ERROR - Missing params: ' + JSON.stringify(params));
        res.status(status).send(responseObj);
        res.end();
    } else {
        var data = new Object();
        async.waterfall(
            [
                (cb) => {
                    //step 1 preparo parametros para helpers.getServiceOffers()
                    data.paramsGetServiceOffers = new Object();
                    data.paramsGetServiceOffers.msisdn = params.msisdn;

                },
                (data, cb) => {
                    //step 2 ejecuto helpers.getServiceOffers()
                    helpers.getServiceOffers(data.paramsGetServiceOffers, function(err, rs) {
                        if (!err) {
                            data.rsGetServiceOffers = rs;
                            cb(null, data);
                        } else {
                            cb(true, data);
                        }
                    });
                },
                (data, cb) => {

                    //step 3 preparo parametros para helpers.chargeRequestWhitEncriptedMsisdn()
                    data.paramsChargeRequestWhitEncriptedMsisdn = new Object();
                    data.paramsChargeRequestWhitEncriptedMsisdn.partnerId = "";
                    data.paramsChargeRequestWhitEncriptedMsisdn.token = "";
                    data.paramsChargeRequestWhitEncriptedMsisdn.packageId = data.rsGetServiceOffers['er-response']['payload']['get-service-offers-response']['service']['subscription']['package-id']['_'];
                    data.paramsChargeRequestWhitEncriptedMsisdn.clientTxnId = "";
                    data.paramsChargeRequestWhitEncriptedMsisdn.partnerRedirectUrl = "";
                },
                (data, cb) => {
                    //step 4 ejecuto helpers.chargeRequestWhitEncriptedMsisdn()
                    helpers.chargeRequestWhitEncriptedMsisdn(data.paramsChargeRequestWhitEncriptedMsisdn, function(err, rs) {
                        if (!err) {
                            cb(null, data);
                        } else {
                            cb(true, data);
                        }
                    });
                }
            ],
            (err, rs) => {
                //step 5 envio respuesta a tulandia_sandbox json( rs | err ) 
                if (!err) {
                    logger.info('Subscription NI inserted. Msisdn: ' + rs.msisdn + ' | SubscriptionId: ' + rs.suscripcionid + ' | ExternalUserId: ' + rs.externalUserId);
                    logger.debug('Subscribe - Record: ' + JSON.stringify(rs));
                    responseObj.statusCode = '0';
                    responseObj.statusMsg = 'Process successful';
                } else {
                    if (typeof rs.isActive != 'undefined' && rs.isActive) {
                        responseObj.statusCode = '101';
                        responseObj.statusMsg = 'User already active';
                        logger.info('Subscription NI already active. Msisdn: ' + rs.msisdn + ' | SubscriptionId: ' + rs.suscripcionid);
                    } else {
                        status = 500;
                        responseObj.statusMsg = 'Process error';
                    }
                    logger.error('Subscribe NI EXITING with ERROR - Record: ' + JSON.stringify(rs));
                }
                res.status(status).send(responseObj);
                res.end();
            }
        );
    }
});

module.exports = router;