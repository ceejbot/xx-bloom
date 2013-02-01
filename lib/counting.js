var
	assert = require('assert'),
	BloomFilter = require('./bloom'),
	crypto = require('crypto'),
	util = require('util'),
	Xxhash = require('xxhash')
	;


function CountingFilter(options)
{
	options = options || {};
	this.hashes = options.hashes || 1024;
	this.bits = options.bits || 8;
	this.seeds = options.seeds || [];
	this.overflow = 0;

	this.buffer = new Buffer(this.bits);
	this.clear();

	if (!this.seeds.length)
		this.generateSeeds();
}
util.inherits(CountingFilter, BloomFilter);


CountingFilter.createOptimal = function(itemcount, errorRate)
{
	var opts = BloomFilter.optimize(itemcount, errorRate);
	return new CountingFilter(opts);
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
