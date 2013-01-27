// TODO redis-backed filter

var
	BloomFilter = require('./bloom'),
	redis = require('redis'),
	util = require('util'),
	Xxhash = require('xxhash')
	;

function StorableFilter(options)
{
	if (options.redis)
		this.redis = options.redis;
	else
		this.redis = redis.createClient(options.port, options.host);

	this.key = options.key || 'bloom';
	this.bits = options.bits;
	this.hashes = options.hashes;
	this.seeds = [];
}
util.inherits(StorableFilter, BloomFilter);

StorableFilter.optimalForSize = function(itemcount, errorRate, options)
{
	var sizes = BloomFilter.optimize(itemcount, errorRate);
	options = options || {};
	options.bits = sizes.bits;
	options.hashes = sizes.hashes;
	return new StorableFilter(options);
};

StorableFilter.createOrRead = function(options, callback)
{
	// try to read the named filter from redis
	// if not found, initialize with given options
	var filter = new StorableFilter(options);

	filter.read(function(err, done)
	{
		if (err || done)
			return callback(err, filter);

		if (options.seeds)
			filter.seeds = options.seeds;
		else
			filter.generateSeeds();

		filter.write(function(err)
		{
			return callback(err, filter);
		});
	});
};

StorableFilter.prototype.read = function(callback)
{
	var self = this;
	var key = self.key + ':meta';

	self.redis.exists(key, function(err, exists)
	{
		if (err) return callback(err);
		if (!exists) return callback(null, false);

		self.redis.hgetall(key, function(err, keyvals)
		{
			if (err) return callback(err);
			self.seeds = JSON.parse(keyvals.seeds);
			self.bits = parseInt(keyvals.bits, 10);
			self.hashes = parseInt(keyvals.hashes, 10);
			callback(null, true);
		});
	});
};

StorableFilter.prototype.write = function(callback)
{
	var self = this;
	var payload = {
		seeds: JSON.stringify(this.seeds),
		bits: this.bits,
		hashes: this.hashes
	};

	self.redis.hmset(this.key + ':meta', payload, function(err, reply)
	{
		return callback(err);
	});
};


StorableFilter.prototype.setbit = function(bit, callback)
{
	var self = this;
	self.redis.setbit(self.key, bit, 1, function(err, prev)
	{
		if (callback)
			return callback(err);
	});
};

StorableFilter.prototype.setbits = function(bitlist, callback)
{
	var self = this;
	var chain = this.redis.multi();

	for (var i = 0; i < bitlist.length; i++)
		chain.setbit(self.key, bitlist[i], 1);

	chain.exec(function(err, replies)
	{
		callback(err);
	});
};

StorableFilter.prototype.getbit = function(bit, callback)
{
	var self = this;
	self.redis.getbit(self.key, bit, function(err, val)
	{
		callback(err, val === 1);
	});
};

StorableFilter.prototype.getbits = function(bitlist, callback)
{
	var self = this;
	var chain = this.redis.multi();

	for (var i = 0; i < bitlist.length; i++)
		chain.getbit(self.key, bitlist[i]);

	chain.exec(function(err, replies)
	{
		if (err) return callback(err);
		var result = {};
		for (var i = 0; i < bitlist.length; i++)
			result[bitlist[i]] = (replies[i] === 1);
		callback(null, result);
	});
};

StorableFilter.prototype._addOne = function(buf, callback)
{
	if (typeof buf === 'string')
		buf = new Buffer(buf);

	var bitsToSet = [];

	for (var i = 0; i < this.hashes; i++)
	{
		var hash = Xxhash.hash(buf, this.seeds[i]);
		var bit = hash % this.bits;
		bitsToSet.push(bit);
	}

	this.setbits(bitsToSet, callback);
};

StorableFilter.prototype.add = function(item, callback)
{
	if (!Array.isArray(item))
		return this._addOne(item, callback);

	var self = this;
	var ptr = 0;

	function continuer(err)
	{
		if (err)
			return callback(err);
		ptr++;
		if (ptr >= item.length)
			return callback();

		self._addOne(item[ptr], continuer);
	}
	self._addOne(item[ptr], continuer);
};

StorableFilter.prototype.has = function(item, callback)
{
	if (typeof item === 'string')
		item = new Buffer(item);

	var bitsToGet = [];

	for (var i = 0; i < this.hashes; i++)
	{
		var hash = Xxhash.hash(item, this.seeds[i]);
		var bit = hash % this.bits;
		bitsToGet.push(bit);
	}

	this.getbits(bitsToGet, function(err, vals)
	{
		if (err) return callback(err);

		for (var i = 0; i < vals.length; i++)
		{
			if (!vals[i])
				return callback(null, false);
		}

		callback(null, true);
	});

	return true;
};

StorableFilter.prototype.clear = function(callback)
{
	this.redis.set(this.key, 0, callback);
};



StorableFilter.prototype.del = function(callback)
{
	this.redis.del([this.key, this.key + ':meta'], function(err, replies)
	{
		return callback(err);
	});
};


module.exports = StorableFilter;
