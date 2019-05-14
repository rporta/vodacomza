var client = require("redis").createClient();

myRedis = {
	setLogger: function(logger){ this.logger = logger },
	setConfig: function(config){ this.config = config; },
	init: function() {
		db = this.config.redis.db;
		var _this = this;
		client.select(db, function() {
			_this.logger.info('Connected to DB: ' + db);

		});
		this.client = client;
	},
	keys: function(pattern, callback){
		client.keys(pattern, function(err, keys){
			callback(err, keys);
		});
	},
	set: function(key, value, expire) {
		var _this = this;
		client.set(key, value, function() {
			if (expire){
				_this.expire(key, expire);
			}
			_this.logger.info('Setting key: ' + key + ' | Value: ' + value);
		});
	},
	get: function(key, callback) {
		var _this = this;
		client.get(key, function (err, reply) {
			if (reply != null) {
				_this.logger.info('Getting value: ' + reply.toString() + ' | From Key: ' + key);
				if (callback) {
					callback(reply.toString());
				}
			}else{
				_this.logger.info('Key: ' + key + ' not found');
				if (err){
					_this.logger.error('Error getting Key: ' + key + ' | Detail: ' + err);
				}
				callback(false);
			}
		});
	},
	del: function(key) {
		var _this = this;
		client.del(key, function(err) {
			if (err){
				_this.logger.error('Error deleting Key: ' + key + ' | Detail: ' + err);
			}else{
				_this.logger.info('Removing key: ' + key);
			}
		});
	},
	expire: function(key, expire) {
		client.expire(key, (expire * 60));
	},
	ttl: function(key, callback) {
		var _this = this;
		client.ttl(key, function(err, ttl){
			if (err) _this.logger.error('Error trying to get TTL: ' + err);
			if (callback){
				callback(ttl);
			}
		});
	}
}

module.exports = myRedis;
