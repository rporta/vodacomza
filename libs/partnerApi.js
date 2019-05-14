var http = require('http');

partnerApi = {
    setLogger: (logger) => {
        this.logger = logger;
    },
    setConfig: (config) => {
        this.config = config;
    },

    generatePassword: () => { //no arrow
        return Math.floor(100000 + Math.random() * 900000);
    },

    interactsWithPartnerApi: (data, callback) => {
        var self = this;
        if (typeof this.config.partnerApi[data.aplicacionid] !== 'undefined' && this.config.partnerApi[data.aplicacionid].enabled == 1) {
            self.logger.debug('Interacting with PartnerApi: MedioId: ' + data.medioid + ' | AplicacionId: ' + data.aplicacionid);
            data.interactsWithPartnerApi = 1;
        }
        callback(null, data);
    },

    addUser: (data, callback) => {
        var self = this;
        var requestData = 'msisdn=' + data.msisdn + '&sponsorId=' + this.config.sponsorId + '&paqueteId=' + data.paqueteid + '&aplicacionId=' + data.aplicacionid + '&pass=' + data.partnerApiPassword;

        this.logger.debug(requestData);

        var postRequest = {
            host: this.config.partnerApi.common.apiUrl,
            port: this.config.partnerApi.common.apiPort,
            path: this.config.partnerApi.common.apiPath,
            method: "POST",
            headers: {
                'Authorization': 'Bearer ' + this.config.partnerApi.common.apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        try {
            var req = http.request(postRequest, (rs) => {
                var buffer = '';
                var result = '';
                rs.on( "data", (rsData) => { buffer += rsData; } );
                rs.on( "end", (rsData) => {
                    if (buffer !== false) {
                        callback(null, data);
                    } else {
                        self.logger.error('Partner API Response Error.');
                        callback(true, data);
                    }
                });
            });
            req.write(requestData);
            req.end();
        } catch(err) {
            self.logger.error('Exception trying to call partnerApi: ' + err);
            callback(true, data);
        }
    },

    deactivateUser: (data, callback) => {
        var self = this;
        var requestData = 'msisdn=' + data.msisdn + '&sponsorId=' + this.config.sponsorId + '&paqueteId=' + data.paqueteid + '&aplicacionId=' + data.aplicacionid;

        this.logger.debug(requestData);

        var putRequest = {
            host: this.config.partnerApi.common.apiUrl,
            port: this.config.partnerApi.common.apiPort,
            path: this.config.partnerApi.common.apiDeactivatePath,
            method: "PUT",
            headers: {
                'Authorization': 'Bearer ' + this.config.partnerApi.common.apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        try {
            var req = http.request(putRequest, (rs) => {
                var buffer = '';
                var result = '';
                rs.on( "data", (rsData) => { buffer += rsData; } );
                rs.on( "end", (rsData) => {
                    if (buffer !== false) {
                        callback(null, data);
                    } else {
                        self.logger.error('Partner API Response Error.');
                        callback(true, data);
                    }
                });
            });
            req.write(requestData);
            req.end();
        } catch(err) {
            self.logger.error('Exception trying to call partnerApi: ' + err);
            callback(true, data);
        }
    }
}

module.exports = partnerApi;