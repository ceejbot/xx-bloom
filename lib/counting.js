var
	assert = require('assert'),
	BloomFilter = require('./bloom'),
	crypto = require('crypto'),
	util = require('util'),
	Xxhash = require('xxhash')
	;


function CountingFilter(hashes, bits, seeds)
{
	this.hashes = hashes || 8;
	this.bits = bits || 1024;
	this.seeds = seeds || [];

	this.buffer = new Buffer(this.bits);
	this.clear();

	if (!seeds)
		this.generateSeeds();
}
util.inherits(CountingFilter, BloomFilter);


CountingFilter.optimalForSize = function(itemcount, errorRate)
{
	var sizes = BloomFilter.optimize(itemcount, errorRate);
	return new CountingFilter(sizes.hashes, sizes.bits);
};


CountingFilter.prototype.setbit = function(bit)
{
	assert(bit < this.buffer.length);
	if (this.buffer[bit] === 255)
		return; // no-op at overflow

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
