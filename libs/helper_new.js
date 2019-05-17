var util = require('util');
var xml2js = require('xml2js');
var builder = require('xmlbuilder');
var https = require('https');
var utils = require('../../libs/utils');

helper = {
        setConfig: (config) => {
            this.config = config;
        },
        setOperator: (operator) => {
            this.operator = operator;
        },
        setDB: (db) => {
            this.db = db;
        },
        setRedis: (redis) => {
            this.redis = redis;
        },
        setLogger: (logger) => {
            this.logger = logger;
        },
        requestAuth: (data, callback) => {
            var xml = builder.create('er-request', {
                    encoding: 'UTF-8'
                })
                .att({
                    'client-application-id': this.operator.mw.user,
                    'client-domain': this.operator.mw.user,
                    'domain-translator-context': "none",
                    'id': "100017",
                    'language_locale': "en_ZA",
                    'purchase_locale': "en_ZA"
                })
                .ele('payload')
                .ele('usage-auth-rate')
                .ele('charging-id', {
                    'type': 'msisdn'
                }, data.msisdn).up()
                .ele('service-id', data.serviceid).up()
                // .ele('usage-attributes', {}).up()
                .ele('rating-attributes')
                .ele('content-name', data.contentName).up()
                .ele('partner-id', this.operator.mw.user).up()
                .end();

            this.logger.debug('Usage-Auth-Rate Request: ' + xml);

            var postRequest = {
                host: this.operator.mw.host,
                port: this.operator.mw.port,
                path: this.operator.mw.path,
                timeout: this.operator.mw.timeoutMsec,
                auth: this.operator.mw.user + ':' + this.operator.mw.password,
                method: "POST",
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Length': Buffer.byteLength(xml)
                }
            }
            try {

                this.logger.debug('HEADERS REQ: ' + JSON.stringify(postRequest));

                var req = https.request(postRequest, (rs) => {
                    var buffer = '';
                    var result = '';
                    this.logger.debug('STATUS: ' + rs.statusCode);
                    this.logger.debug('HEADERS: ' + JSON.stringify(rs.headers));
                    rs.on("data", (rsData) => {
                        buffer += rsData;
                    });
                    rs.on("end", (rsData) => {
                        this.logger.debug('Response Data: ' + JSON.stringify(buffer));
                        if (buffer) {
                            var parser = new xml2js.Parser();
                            var isActive = false;
                            parser.parseString(buffer, (err, result) => {
                                if (err) {
                                    this.logger.error('Err: ' + err);
                                    callback(true, data);
                                } else {
                                    if (result) {
                                        this.logger.debug('Result: ');
                                        this.logger.debug(result);
                                        // console.log('Parse: ');

                                        if (typeof result['er-response'] != 'undefined' &&
                                            typeof result['er-response']['payload'] != 'undefined' &&
                                            typeof result['er-response']['payload'][0] != 'undefined'
                                        ) {
                                            if (typeof result['er-response']['payload'][0]['usage-authorisation'] != 'undefined') {
                                                data.isActive = true;
                                                data.externalUserId = result['er-response']['payload'][0]['usage-authorisation'][0]['package-subscription-id'][0];
                                                data.packageid = result['er-response']['payload'][0]['usage-authorisation'][0]['package'][0]['id'][0];
                                                // no utilizamos aca usage-authorisation[0]rate[0] porque en este caso, a diferencia de la notificacion ussd, viene en 0
                                                data.monto = result['er-response']['payload'][0]['usage-authorisation'][0]['package'][0]['rate'][0];
                                                this.logger.debug('User already externally subscribed');
                                                callback(null, data);
                                            } else {
                                                if (typeof result['er-response']['payload'][0]['error'] != 'undefined') {
                                                    this.logger.error('Auth rate: Response with error');
                                                    callback(true, data);
                                                } else {
                                                    for (var i in result['er-response']['payload'][0]['purchase-options'][0]['packages'][0]['package']) {
                                                        if (result['er-response']['payload'][0]['purchase-options'][0]['packages'][0]['package'][i]['simple-package-id'][0] == data.simplePackageId) {
                                                            if (data.paquetes.indexOf(result['er-response']['payload'][0]['purchase-options'][0]['packages'][0]['package'][i]['id'][0]) >= 0) {
                                                                data.defaultPackageId = result['er-response']['payload'][0]['purchase-options'][0]['packages'][0]['package'][i]['id'][0];
                                                            }
                                                            if (data.fallback && data.fallbackPaquetes.indexOf(result['er-response']['payload'][0]['purchase-options'][0]['packages'][0]['package'][i]['id'][0]) >= 0) {
                                                                data.fallbackPackageId = result['er-response']['payload'][0]['purchase-options'][0]['packages'][0]['package'][i]['id'][0];
                                                            }
                                                        }
                                                    }
                                                    callback(null, data);
                                                }
                                            }
                                        } else {
                                            this.logger.error('Auth rate: Response with no er-response:');
                                            this.logger.error(result);
                                            callback(true, data);
                                        }

                                        // console.log(result['er-response']['payload'][0]['purchase-options'][0]['reason-code'][0]['code'][0]);
                                    } else {
                                        this.logger.error('Auth rate: No parsed result');
                                        callback(true, data);
                                    }
                                }
                            });
                        } else {
                            this.logger.error('No buffer response');
                            callback(true, data);
                        }
                    });
                });
                req.write(xml);
                req.end();
            } catch (err) {
                this.logger.error('Exception trying to connect to request auth rate: ' + err);
                callback(true, data);
            }

            req.on('error', (e) => {
                this.logger.error('Error on request: ' + e.message);
                callback(true, data);
            });
        },

        requestSubscription: (data, callback) => {
            var xml = builder.create('er-request', {
                    encoding: 'UTF-8'
                })
                .att({
                    'client-application-id': this.operator.mw.user,
                    // 'client-domain': this.operator.mw.user,
                    // 'domain-translator-context': "none",
                    'id': "100004",
                    'language_locale': "en_ZA",
                    'purchase_locale': "en_ZA"
                })
                .ele('payload')
                .ele('purchase')
                .ele('charging-id', {
                    'type': 'msisdn'
                }, data.msisdn).up()
                .ele('package-id', data.packageid).up()
                .ele('rating-attributes')
                .ele('asset-id', data.assetId).up()
                .ele('content-name', data.contentName).up()
                .ele('external-trans-id', data.transId).up()
                .ele('partner-id', this.operator.mw.user).up()
                // .ele('purchase-attributes')
                // .ele('start-date', utils.moment.utc().format()).up()
                .end();

            this.logger.debug('Purchase Request: ' + xml);

            var postRequest = {
                host: this.operator.mw.host,
                port: this.operator.mw.port,
                path: this.operator.mw.path,
                timeout: this.operator.mw.timeoutMsec,
                auth: this.operator.mw.user + ':' + this.operator.mw.password,
                method: "POST",
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Length': Buffer.byteLength(xml)
                }
            }
            try {
                this.logger.debug('HEADERS REQ: ' + JSON.stringify(postRequest));
                var req = https.request(postRequest, (rs) => {
                    var buffer = '';
                    var result = '';
                    this.logger.debug('STATUS: ' + rs.statusCode);
                    this.logger.debug('HEADERS: ' + JSON.stringify(rs.headers));
                    rs.on("data", (rsData) => {
                        buffer += rsData;
                    });
                    rs.on("end", (rsData) => {
                        this.logger.debug('Response Data: ' + JSON.stringify(buffer));
                        if (buffer) {
                            var parser = new xml2js.Parser();
                            var isActive = false;
                            parser.parseString(buffer, (err, result) => {
                                if (err) {
                                    this.logger.error('Err: ' + err);
                                    callback(true, data);
                                } else {
                                    if (result) {
                                        this.logger.debug('Result: ');
                                        this.logger.debug(result);
                                        if (
                                            typeof result['er-response'] != 'undefined' &&
                                            typeof result['er-response']['payload'] != 'undefined' &&
                                            typeof result['er-response']['payload'][0] != 'undefined'
                                        ) {
                                            if (typeof result['er-response']['payload'][0]['usage-authorisation'] != 'undefined' &&
                                                typeof result['er-response']['payload'][0]['usage-authorisation'][0] != 'undefined' &&
                                                typeof result['er-response']['payload'][0]['usage-authorisation'][0]['is-success'] != 'undefined' &&
                                                typeof result['er-response']['payload'][0]['usage-authorisation'][0]['is-success'][0] != 'undefined'
                                            ) {
                                                data.success = result['er-response']['payload'][0]['usage-authorisation'][0]['is-success'][0];
                                            }
                                            data.pendingConsent = (typeof result['er-response']['payload'][0]['ussd-consent'] != 'undefined');
                                            this.logger.debug('Request Subscription result: ' + data.success);
                                            if (data.pendingConsent) {
                                                this.redis.set(data.transId, JSON.stringify(data), this.config.redis.setExpire);
                                            }
                                            if (data.success == 'true') {
                                                data.externalUserId = result['er-response']['payload'][0]['usage-authorisation'][0]['package-subscription-id'][0];
                                            }
                                            if (data.success == 'true' || data.pendingConsent) {
                                                callback(null, data);
                                            } else {
                                                data.success = -1;
                                                callback(true, data);
                                            }
                                        } else {
                                            data.success = -1;
                                            callback(true, data);
                                        }

                                        // console.log(result['er-response']['payload'][0]['purchase-options'][0]['reason-code'][0]['code'][0]);
                                    } else {
                                        this.logger.error('Request Subscription: No parsed result');
                                        callback(true, data);
                                    }
                                }
                            });
                        } else {
                            this.logger.error('No buffer response');
                            callback(true, data);
                        }
                    });
                });
                req.write(xml);
                req.end();
            } catch (err) {
                this.logger.error('Exception trying to connect to request subscription: ' + err);
                callback(true, data);
            }

            req.on('error', (e) => {
                this.logger.error('Error on request: ' + e.message);
                callback(true, data);
            });
        },

        requestSelfCare: (data, callback) => {
            var xml = builder.create('er-request', {
                    encoding: 'UTF-8'
                })
                .att({
                    'client-application-id': this.operator.mw.user,
                    'id': "100005",
                    'language_locale': "en_ZA",
                    'purchase_locale': "en_ZA"
                })
                .ele('payload')
                .ele('selfcare-subscriptions-request')
                .ele('charging-id', {
                    'type': 'msisdn'
                }, data.msisdn).up()
                .ele('subscription-filter')
                .ele('transactions-not-required', 'yes').up()
                .ele('add-services', 'true').up()
                .ele('package-id', data.packageid).up()
                .ele('partner-id', this.operator.mw.user).up()
                .end();

            this.logger.debug('SelfCare Request: ' + xml);

            var postRequest = {
                host: this.operator.mw.host,
                port: this.operator.mw.port,
                path: this.operator.mw.path,
                timeout: this.operator.mw.timeoutMsec,
                auth: this.operator.mw.user + ':' + this.operator.mw.password,
                method: "POST",
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Length': Buffer.byteLength(xml)
                }
            }
            try {
                var req = https.request(postRequest, (rs) => {
                    var buffer = '';
                    var result = '';
                    this.logger.debug('STATUS: ' + rs.statusCode);
                    this.logger.debug('HEADERS: ' + JSON.stringify(rs.headers));
                    rs.on("data", (rsData) => {
                        buffer += rsData;
                    });
                    rs.on("end", (rsData) => {
                        this.logger.debug('Response Data: ' + JSON.stringify(buffer));
                        if (buffer) {
                            var parser = new xml2js.Parser();
                            var isActive = false;
                            parser.parseString(buffer, (err, result) => {
                                if (err) {
                                    this.logger.error('Err: ' + err);
                                    callback(true, data);
                                } else {
                                    if (result) {
                                        this.logger.debug('Result: ');
                                        this.logger.debug(result);
                                        callback(true, data);
                                        // if (
                                        //     typeof result['er-response'] != 'undefined'
                                        //     && typeof result['er-response']['payload'] != 'undefined'
                                        //     && typeof result['er-response']['payload'][0] != 'undefined'
                                        // ) {
                                        //     if (typeof result['er-response']['payload'][0]['usage-authorisation'] != 'undefined'
                                        //         && typeof result['er-response']['payload'][0]['usage-authorisation'][0] != 'undefined'
                                        //         && typeof result['er-response']['payload'][0]['usage-authorisation'][0]['is-success'] != 'undefined'
                                        //         && typeof result['er-response']['payload'][0]['usage-authorisation'][0]['is-success'][0] != 'undefined'
                                        //     ) {
                                        //         data.success = result['er-response']['payload'][0]['usage-authorisation'][0]['is-success'][0];
                                        //     }
                                        //     data.pendingConsent = (typeof result['er-response']['payload'][0]['ussd-consent'] != 'undefined');
                                        //     this.logger.debug('Request Subscription result: ' + data.success);
                                        //     if (data.pendingConsent) {
                                        //         this.redis.set(data.transId, JSON.stringify(data), this.config.redis.setExpire);
                                        //     }
                                        //     if (data.success == 'true') {
                                        //         data.externalUserId = result['er-response']['payload'][0]['usage-authorisation'][0]['package-subscription-id'][0];
                                        //     }
                                        //     if (data.success == 'true' || data.pendingConsent) {
                                        //         callback(null, data);
                                        //     } else {
                                        //         data.success = -1;
                                        //         callback(true, data);
                                        //     }
                                        // } else {
                                        //     data.success = -1;
                                        //     callback(true, data);
                                        // }

                                        // console.log(result['er-response']['payload'][0]['purchase-options'][0]['reason-code'][0]['code'][0]);
                                    } else {
                                        this.logger.error('Request SelfCare: No parsed result');
                                        callback(true, data);
                                    }
                                }
                            });
                        } else {
                            this.logger.error('No buffer response');
                            callback(true, data);
                        }
                    });
                });
                req.write(xml);
                req.end();
            } catch (err) {
                this.logger.error('Exception trying to connect to request subscription: ' + err);
                callback(true, data);
            }

            req.on('error', (e) => {
                this.logger.error('Error on request: ' + e.message);
                callback(true, data);
            });
        },

        requestUnsubscription: (data, callback) => {
            var xml = builder.create('er-request', {
                    encoding: 'UTF-8'
                })
                .att({
                    'client-application-id': this.operator.mw.user,
                    'client-domain': this.operator.mw.user,
                    'domain-translator-context': "none",
                    'id': "100002",
                    'language_locale': "en_ZA",
                    'purchase_locale': "en_ZA"
                })
                .ele('payload')
                .ele('inactivate-subscription')
                .ele('charging-id', {
                    'type': 'msisdn'
                }, data.msisdn).up()
                .ele('subscription-id', data.externalUserId).up()
                .end();

            this.logger.debug('Inactivate-Subscription Request: ' + xml);

            var postRequest = {
                host: this.operator.mw.host,
                port: this.operator.mw.port,
                path: this.operator.mw.path,
                timeout: this.operator.mw.timeoutMsec,
                auth: this.operator.mw.user + ':' + this.operator.mw.password,
                method: "POST",
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Length': Buffer.byteLength(xml)
                }
            }
            try {
                var req = https.request(postRequest, (rs) => {
                    var buffer = '';
                    var result = '';
                    this.logger.debug('STATUS: ' + rs.statusCode);
                    this.logger.debug('HEADERS: ' + JSON.stringify(rs.headers));
                    rs.on("data", (rsData) => {
                        buffer += rsData;
                    });
                    rs.on("end", (rsData) => {
                        this.logger.debug('Response Data: ' + JSON.stringify(buffer));
                        if (buffer) {
                            var parser = new xml2js.Parser();
                            var isActive = false;
                            parser.parseString(buffer, (err, result) => {
                                if (err) {
                                    this.logger.error('Err: ' + err);
                                    callback(true, data);
                                } else {
                                    if (result) {
                                        this.logger.debug('Result: ');
                                        this.logger.debug(result);
                                        if (
                                            typeof result['er-response'] != 'undefined' &&
                                            typeof result['er-response']['payload'] != 'undefined' &&
                                            typeof result['er-response']['payload'][0] != 'undefined' &&
                                            typeof result['er-response']['payload'][0]['inactivate-subscription-response'] != 'undefined' &&
                                            typeof result['er-response']['payload'][0]['inactivate-subscription-response'][0] != 'undefined' &&
                                            typeof result['er-response']['payload'][0]['inactivate-subscription-response'][0]['success'] != 'undefined' &&
                                            typeof result['er-response']['payload'][0]['inactivate-subscription-response'][0]['success'][0] != 'undefined'
                                        ) {
                                            data.success = result['er-response']['payload'][0]['inactivate-subscription-response'][0]['success'][0];
                                            this.logger.debug('Request Unsubscription result: ' + data.success);
                                            if (data.success) {
                                                callback(null, data);
                                            } else {
                                                callback(true, data);
                                            }
                                        } else {
                                            callback(true, data);
                                        }

                                        // console.log(result['er-response']['payload'][0]['purchase-options'][0]['reason-code'][0]['code'][0]);
                                    } else {
                                        this.logger.error('Request Unsubscription: No parsed result');
                                        callback(true, data);
                                    }
                                }
                            });
                        } else {
                            this.logger.error('Request Unsubscription: No buffer response');
                            callback(true, data);
                        }
                    });
                });
                req.write(xml);
                req.end();
            } catch (err) {
                this.logger.error('Exception trying to connect to request unsubscription: ' + err);
                callback(true, data);
            }

            req.on('error', (e) => {
                this.logger.error('Error on request: ' + e.message);
                callback(true, data);
            });
        },

        requestModifyCharging: (data, callback) => {
            var xml = builder.create('er-request', {
                    encoding: 'UTF-8'
                })
                .att({
                    'client-application-id': this.operator.mw.user,
                    'client-domain': this.operator.mw.user,
                    'domain-translator-context': "none",
                    'id': "100003",
                    'language_locale': "en_ZA",
                    'purchase_locale': "en_ZA"
                })
                .ele('payload')
                .ele('modify-subscription-charging-method')
                .ele('charging-id', {
                    'type': 'msisdn'
                }, data.msisdn).up()
                .ele('subscription-id', data.externalUserId).up()
                .ele('charging-method', 2).up()
                .end();

            this.logger.debug('Modify-subscription-charging-method Request: ' + xml);

            var postRequest = {
                host: this.operator.mw.host,
                port: this.operator.mw.port,
                path: this.operator.mw.path,
                timeout: this.operator.mw.timeoutMsec,
                auth: this.operator.mw.user + ':' + this.operator.mw.password,
                method: "POST",
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Length': Buffer.byteLength(xml)
                }
            }
            try {
                var req = https.request(postRequest, (rs) => {
                    var buffer = '';
                    var result = '';
                    this.logger.debug('STATUS: ' + rs.statusCode);
                    this.logger.debug('HEADERS: ' + JSON.stringify(rs.headers));
                    rs.on("data", (rsData) => {
                        buffer += rsData;
                    });
                    rs.on("end", (rsData) => {
                        this.logger.debug('Response Data: ' + JSON.stringify(buffer));
                        if (buffer) {
                            var parser = new xml2js.Parser();
                            var isActive = false;
                            parser.parseString(buffer, (err, result) => {
                                if (err) {
                                    this.logger.error('Err: ' + err);
                                    callback(true, data);
                                } else {
                                    if (result) {
                                        this.logger.debug('Result: ');
                                        this.logger.debug(result);
                                        if (
                                            typeof result['er-response'] != 'undefined' &&
                                            typeof result['er-response']['payload'] != 'undefined' &&
                                            typeof result['er-response']['payload'][0] != 'undefined' &&
                                            typeof result['er-response']['payload'][0]['modify-subscription-charging-method-response'] != 'undefined' &&
                                            typeof result['er-response']['payload'][0]['modify-subscription-charging-method-response'][0] != 'undefined' &&
                                            typeof result['er-response']['payload'][0]['modify-subscription-charging-method-response'][0]['success'] != 'undefined' &&
                                            typeof result['er-response']['payload'][0]['modify-subscription-charging-method-response'][0]['success'][0] != 'undefined'
                                        ) {
                                            data.success = result['er-response']['payload'][0]['modify-subscription-charging-method-response'][0]['success'][0];
                                            this.logger.debug('Request Modify-subscription-charging-method result: ' + data.success);
                                            if (data.success) {
                                                callback(null, data);
                                            } else {
                                                callback(true, data);
                                            }
                                        } else {
                                            callback(true, data);
                                        }

                                    } else {
                                        this.logger.error('Request Modify-subscription-charging-method: No parsed result');
                                        callback(true, data);
                                    }
                                }
                            });
                        } else {
                            this.logger.error('Request Modify-subscription-charging-method: No buffer response');
                            callback(true, data);
                        }
                    });
                });
                req.write(xml);
                req.end();
            } catch (err) {
                this.logger.error('Exception trying to connect to request Modify-subscription-charging-method: ' + err);
                callback(true, data);
            }

            req.on('error', (e) => {
                this.logger.error('Error on request: ' + e.message);
                callback(true, data);
            });
        },

        insertPresubscription: (data, callback) => {
            var params = {
                Origen: data.msisdn,
                MedioId: data.medioid,
                PaqueteId: data.paqueteid,
                SponsorId: this.operator.sponsorId,
                MedioSuscripcionId: data.mds,
                AdNetwork: data.adNetworkId,
                Pixel: data.pixel,
                Pub: data.pub,
                Portal: data.portal
            }
            var self = this;
            this.db.execute(this.operator.db.setPresubscription, params, (rs) => {
                if (rs) {
                    self.logger.debug('Presubscription insertion result: ' + JSON.stringify(rs));
                } else {
                    self.logger.error('Error inserting presubscription: ' + JSON.stringify(params));
                }
                callback(null, data);
            });
        },

        insertSubscriptionMap: (data, callback) => {
            var params = {
                SuscripcionId: data.suscripcionid,
                ExternalUserId: data.externalUserId,
                SponsorId: this.operator.sponsorId
            }
            this.logger.debug('Inserting SubscriptionMap: ' + JSON.stringify(params));
            var self = this;
            this.db.execute(this.operator.db.setSubscriptionMap, params, (rs) => {
                if (rs) {
                    self.logger.debug('SubscriptionMap insertion result: ' + JSON.stringify(rs));
                } else {
                    self.logger.error('Error inserting SubscriptionMap: ' + JSON.stringify(params));
                }
                callback(null, data);
            });
        },

        getSubscriptionMap: (data, callback) => {
            var self = this;
            var query = util.format("select externalUserId from OpratelInfo.dbo.subscriptionMap where suscripcionId = %d and sponsorId = %d", data.suscripcionid, this.operator.sponsorId);
            this.db.query(query, (rs) => {
                if (rs && rs.length > 0) {
                    self.logger.debug('SubscriptionMap select result: ' + JSON.stringify(rs));
                    data.externalUserId = rs[0].externalUserId;
                    callback(null, data);
                } else {
                    self.logger.error('Error selecting SubscriptionMap: ' + JSON.stringify(data));
                    callback(true, data);
                }
            });
        },

        deleteSubscriptionMap: (data, callback) => {
            var self = this;
            var query = util.format("delete from OpratelInfo.dbo.subscriptionMap where suscripcionId = %d and externalUserId = %s and sponsorId = %d", data.suscripcionid, data.externalUserId, this.operator.sponsorId);
            self.logger.debug('Deleting subscriptionMap | suscripcionId: ' + data.suscripcionid + '  | externalUserId: ' + data.externalUserId);
            this.db.query(query);
            callback(null, data);
        },

        getPresubscription: (data, callback) => {
            var self = this;
            var params = {
                Origen: data.msisdn,
                MedioId: data.medioid,
                PaqueteId: data.paqueteid,
                SponsorId: this.operator.sponsorId
            };
            this.db.execute(this.operator.db.getPresubscription, params, (rs) => {
                if (rs) {
                    self.logger.debug('getPresubscription result: ' + JSON.stringify(rs));
                    data.mds = rs[0].MedioSuscripcionId;
                    callback(null, data);
                } else {
                    self.logger.error('getPresubscription Error - No presubscription: ' + JSON.stringify(params));
                    callback(null, data);
                }
            });
        },

        getServiceOffers: (data, callback) => {
            //@client-application-id 
            //@service-id

            var contentXML = {
                "er-request": {
                    "@id": "120054",
                    "@client-application-id": "DCM_MX",
                    "@purchase_locate": "en_ZA",
                    "@language_locate": "en_ZA",
                    "payload": {
                        "get-service-offers": {
                            "charging-id": {
                                "@type": "msisdn",
                                "#text": data.msisdn
                            },
                            "service-ids": {
                                "#text": "vc-mx-num-wwekings-01"
                            }

                        }
                    }
                }
            };
            var xml = builder.create(contentXML, {
                encoding: 'UTF-8'
            }).end();

            this.logger.debug('getServiceOffers Request: ' + xml);

            //preparo opciones de configuracion para enviar a la api mw
            var postRequest = {
                host: this.operator.mw.host,
                port: this.operator.mw.port,
                path: this.operator.mw.path,
                timeout: this.operator.mw.timeoutMsec,
                auth: this.operator.mw.user + ':' + this.operator.mw.password,
                method: "POST",
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Length': Buffer.byteLength(xml)
                }
            };
            try {
                var req = https.request(postRequest, (rs) => {
                    var buffer = '';
                    var result = '';
                    this.logger.debug('STATUS: ' + rs.statusCode);
                    this.logger.debug('HEADERS: ' + JSON.stringify(rs.headers));
                    rs.on("data", (rsData) => {
                        buffer += rsData;
                    });
                    rs.on("end", (rsData) => {
                        this.logger.debug('Response Data: ' + JSON.stringify(buffer));
                        if (buffer) {
                            var parser = new xml2js.Parser();
                            parser.parseString(buffer, (err, result) => {
                                if (err) {
                                    this.logger.error('Err: ' + err);
                                    callback(true, data);
                                } else {
                                    if (result) {
                                        //Aca result puede tener xmlRs || xmlErr
                                        //xmlRs : El suscriptor ha sido suscrito. Suscripción activa o suspendida devuelta.
                                        //xmlErr : El suscriptor no ha sido suscrito todavía. Se devuelven las opciones de compra.
                                        if (
                                            typeof result['er-response'] != 'undefined' &&
                                            typeof result['er-response']['payload'] != 'undefined' &&
                                            typeof result['er-response']['payload']['get-service-offers-response'] != 'undefined' &&
                                            typeof result['er-response']['payload']['get-service-offers-response']['service'] != 'undefined' &&
                                            typeof result['er-response']['payload']['get-service-offers-response']['service']['subscription'] != 'undefined' &&
                                            typeof result['er-response']['payload']['get-service-offers-response']['service']['subscription']['$']['status'] == 1

                                        ) {
                                            this.logger.error('Request getServiceOffers: xmlRs');
                                            callback(null, result);
                                        } else {
                                            this.logger.error('Request getServiceOffers: xmlErr');
                                            callback(true, data);
                                        }

                                    } else {
                                        this.logger.error('Request getServiceOffers: No parsed result');
                                        callback(true, data);
                                    }
                                }
                            });
                        } else {
                            this.logger.error('Request getServiceOffers: No buffer response');
                            callback(true, data);
                        }
                    });
                });
                req.write(xml);
                req.end();
            } catch (err) {
                this.logger.error('Exception trying to connect to request getServiceOffers: ' + err);
                callback(true, data);
            }
        }

        module.exports = helper;