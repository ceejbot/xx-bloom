var
	assert = require('assert'),
	BloomFilter = require('./bloom'),
	util = require('util'),
	Xxhash = require('xxhash')
	;

function CountingFilter(options)
{
	options = options || {};

	if (options.seeds)
	{
		this.seeds = options.seeds;
		this.hashes = options.seeds.length;
	}
	else
	{
		this.hashes = options.hashes || 8;
		this.generateSeeds();
	}

	this.bits = options.bits || 1024;
	this.buffer = new Buffer(this.bits);

	this.clear();
}
util.inherits(CountingFilter, BloomFilter);

CountingFilter.createOptimal = function(itemcount, errorRate)
{
	var opts = BloomFilter.optimize(itemcount, errorRate);
	return new CountingFilter(opts);
};

CountingFilter.prototype.clear = function()
{
	this.buffer.fill(0);
	this.overflow = 0;
};

CountingFilter.prototype.setbit = function(bit)
{
	assert(bit < this.buffer.length);
	if (this.buffer[bit] === 255)
	{
		this.overflow++;
		return; // no-op at overflow
	}

	this.buffer[bit]++;
};

CountingFilter.prototype.unsetbit = function(bit)
{
	assert(bit < this.buffer.length);
	if ((this.buffer[bit] === 255) || (this.buffer[bit] === 0))
		return; // no-op at overflow

	this.buffer[bit]--;
};

CountingFilter.prototype.getbit = function(bit)
{
	assert(bit < this.buffer.length);
	return (this.buffer[bit] !== 0);
};

CountingFilter.prototype.hasOverflowed = function()
{
	return this.overflow > 0;
};

CountingFilter.prototype.remove = function(item)
{
	if (!Buffer.isBuffer(item))
		item = new Buffer(item);

	for (var i = 0; i < this.seeds.length; i++)
	{
		var hash = Xxhash.hash(item, this.seeds[i]);
		var bit = hash % this.bits;
		this.unsetbit(bit);
	}
};

module.exports = CountingFilter;
