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

StorableFilter.createOptimal = function(itemcount, errorRate, options)
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


StorableFilter.prototype.setbit = function(bit, callback)
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

StorableFilter.prototype.setbits = function(bitlist, callback)
{
	var self = this;
	var chain = this.redis.multi();
	var shifts = [];
	var keys = [];

	for (var i = 0; i < bitlist.length; i++)
	{
		var move = findShift(bitlist[i]);
		shifts.push(0x1 << move.shift);
		keys.push(move.pos);
	}

	self.redis.hmget(self.key, keys, function(err, values)
	{
		if (err) return callback(err);

		var setter = {};
		for (var i = 0; i < keys.length; i++)
			setter[keys[i]] = (values |= shifts[i]).toString();

		self.redis.hmset(self.key, setter, function(err, reply)
		{
			callback(err);
		});
	});
};

StorableFilter.prototype.getbit = function(bit, callback)
{
	var self = this;
	var posShift = findShift(bit);

	self.redis.hget(self.key, posShift.pos, function(err, bitfield)
	{
		callback(err, (bitfield & (0x1 << posShift.shift)) !== 0);
	});
};

StorableFilter.prototype.getbits = function(bitlist, callback)
{
	var self = this;
	var chain = this.redis.multi();
	var shifts = [], posShift;

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
		for (var i = 0; i < bitlist.length; i++)
			result[bitlist[i]] = (bitfields[i] & (0x1 << shifts[i])) !== 0;
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

StorableFilter.prototype.del = function(callback)
{
	this.redis.del([this.key, this.key + ':meta'], function(err, replies)
	{
		return callback(err);
	});
};


module.exports = StorableFilter;
