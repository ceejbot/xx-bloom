var
	BloomFilter = require('./bloom'),
	assert = require('assert'),
	redis = require('redis'),
	util = require('util'),
	Xxhash = require('xxhash')
	;

function RedisFilter(options)
{
	if (options.redis)
		this.redis = options.redis;
	else
		this.redis = redis.createClient(options.port, options.host);

	this.key = options.key || 'bloom';
	this.bits = options.bits || 1024;
	this.hashes = options.hashes || 8;
	this.seeds = options.seeds || [];
}
util.inherits(RedisFilter, BloomFilter);

RedisFilter.createOptimal = function(itemcount, errorRate, options)
{
	var sizes = BloomFilter.optimize(itemcount, errorRate);
	options = options || {};
	options.bits = sizes.bits;
	options.hashes = sizes.hashes;
	return new RedisFilter(options);
};

RedisFilter.createOrRead = function(options, callback)
{
	assert(options.key);
	var filter = new RedisFilter(options);
	filter.initialize(function(err, isNew)
	{
		callback(err, filter);
	});
};

RedisFilter.prototype.initialize = function(callback)
{
	// try to read the named filter from redis
	var self = this;
	self.read(function(err, done)
	{
		if (err || done)
			return callback(err, false);

		if (self.seeds.length === 0)
			self.generateSeeds();

		self.write(function(err)
		{
			return callback(err, true);
		});
	});
};

RedisFilter.prototype.read = function(callback)
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

RedisFilter.prototype.write = function(callback)
{
	var self = this;
	var payload = {
		seeds: JSON.stringify(this.seeds),
		bits: this.bits.toString(),
		hashes: this.hashes.toString()
	};

	self.redis.hmset(this.key + ':meta', payload, function(err, reply)
	{
		return callback(err);
	});
};

function findShift(bit)
{
	var pos = 0;
	var shift = bit;
	while (shift > 62)
	{
		pos++;
		shift -= 63; // redis hash vals are 64 bit signed ints
	}
	return { pos: pos, shift: shift };
}

RedisFilter.prototype.setbit = function(bit, callback)
{
	var self = this;
	var posShift = findShift(bit);

	self.redis.hget(self.key, posShift.pos, function(err, bitfield)
	{
		if (err) return callback(err);
		bitfield |= (0x1 << posShift.shift);

		self.redis.hset(self.key, posShift.pos, bitfield.toString(), function(err, reply)
		{
			callback(err);
		});
	});
};

RedisFilter.prototype.setbits = function(bitlist, callback)
{
	var self = this;
	var shifts = {};

	for (var i = 0; i < bitlist.length; i++)
	{
		var move = findShift(bitlist[i]);
		if (!shifts[move.pos])
			shifts[move.pos] = 0x1 << move.shift;
		else
			shifts[move.pos] |= (0x1 << move.shift);
	}

	var keys = Object.keys(shifts);

	self.redis.hmget(self.key, keys, function(err, values)
	{
		if (err) return callback(err);

		var setter = {};
		for (var i = 0; i < keys.length; i++)
		{
			var curr = keys[i];
			var val = parseInt(values[i], 10);
			setter[curr] = (val |= shifts[curr]).toString();
		}

		self.redis.hmset(self.key, setter, function(err, reply)
		{
			callback(err);
		});
	});
};

RedisFilter.prototype.getbit = function(bit, callback)
{
	var self = this;
	var posShift = findShift(bit);

	self.redis.hget(self.key, posShift.pos, function(err, bitfield)
	{
		callback(err, (bitfield & (0x1 << posShift.shift)) !== 0);
	});
};

RedisFilter.prototype.getbits = function(bitlist, callback)
{
	var self = this;
	var chain = this.redis.multi();
	var shifts = [],
		posShift;

	for (var i = 0; i < bitlist.length; i++)
	{
		posShift = findShift(bitlist[i]);
		shifts.push(posShift.shift);
		chain.hget(self.key, posShift.pos);
	}

	chain.exec(function(err, bitfields)
	{
		if (err) return callback(err);
		var result = {};
		for (var i = 0; i < bitfields.length; i++)
		{
			var num = parseInt(bitfields[i], 10);
			result[bitlist[i]] = (num & (0x1 << shifts[i])) !== 0;
		}

		callback(null, result);
	});
};

RedisFilter.prototype._addOne = function(buf, callback)
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

RedisFilter.prototype.add = function(item, callback)
{
	if (!Array.isArray(item))
		return this._addOne(item, callback);

	var self = this;
	var ptr = 0;

	function continuer(err, reply)
	{
		if (err) return callback(err);

		ptr++;
		if (ptr >= item.length)
			return callback();

		self._addOne(item[ptr], continuer);
	}

	self._addOne(item[ptr], continuer);
};

RedisFilter.prototype.has = function(item, callback)
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

		for (var i = 0; i < bitsToGet.length; i++)
		{
			var item = String(bitsToGet[i]);
			if (!vals[item])
				return callback(null, false);
		}

		callback(null, true);
	});
};

RedisFilter.prototype.clear = function(callback)
{
	var self = this;
	self.redis.hkeys(self.key, function(err, keys)
	{
		if (err) return callback(err);
		var clear = {};
		for (var i = 0; i < keys.length; i++)
			clear[keys[i]] = '0';
		self.redis.hmset(self.key, clear, function(err, reply)
		{
			callback(err);
		});
	});
};

RedisFilter.prototype.del = function(callback)
{
	this.redis.del([this.key, this.key + ':meta'], function(err, replies)
	{
		return callback(err);
	});
};

module.exports = RedisFilter;
