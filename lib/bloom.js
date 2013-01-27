var
	crypto = require('crypto'),
	util = require('util'),
	Xxhash = require('xxhash')
	;


function BloomFilter(hashes, bits, seeds)
{
	this.hashes = hashes;
	this.bits = bits;
	this.seeds = seeds || [];

	var octets = Math.ceil(this.bits / 8);
	this.buffer = new Buffer(octets);
	this.clear();

	if (!seeds)
		this.generateSeeds();
}


var LN2_SQUARED = Math.LN2 * Math.LN2;
BloomFilter.optimize = function(itemcount, errorRate)
{
	// var p = 0.005;
	// var bits = -1 * (itemcount * Math.log(p)) / Math.LN2 * Math.LN2

	errorRate = errorRate || 0.005;
	var bits = Math.round(-1 * itemcount * Math.log(errorRate) / LN2_SQUARED);
	var hashes = Math.round((bits / itemcount) * Math.LN2);
	return {
		bits: bits,
		hashes: hashes
	};
};

BloomFilter.optimalForSize = function(itemcount, errorRate)
{
	var sizes = BloomFilter.optimize(itemcount, errorRate);
	return new BloomFilter(sizes.hashes, sizes.bits);
};

BloomFilter.prototype.clear = function()
{
	for (var i = 0; i < this.buffer.length; i++)
		this.buffer[i] = 0;
};

BloomFilter.prototype.generateSeeds = function()
{
    var buf;
	for (var i = 0; i < this.hashes; i++)
	{
		buf = crypto.randomBytes(4);
		this.seeds[i] = buf.readUInt32LE(0);
	}
};

BloomFilter.prototype.setbit = function(bit)
{
	var pos = 0;
	var shift = bit;
	while (shift > 7)
	{
		pos++;
		shift -= 8;
	}

	var bitfield = this.buffer[pos];
	bitfield |= (0x1 << shift);
	this.buffer[pos] = bitfield;
};

BloomFilter.prototype.getbit = function(bit)
{
	var pos = 0;
	var shift = bit;
	while (shift > 7)
	{
		pos++;
		shift -= 8;
	}

	var bitfield = this.buffer[pos];
	return (bitfield & (0x1 << shift)) !== 0;
};

BloomFilter.prototype._addOne = function(buf)
{
	if (typeof buf === 'string')
		buf = new Buffer(buf);

	for (var i = 0; i < this.hashes; i++)
	{
		var hash = Xxhash.hash(buf, this.seeds[i]);
		var bit = hash % this.bits;
		this.setbit(bit);
	}
};

BloomFilter.prototype.add = function(item)
{
    if (Array.isArray(item))
    {
        for (var i = 0; i < item.length; i++)
            this._addOne(item[i]);
    }
    else
		this._addOne(item);
};

BloomFilter.prototype.has = function(item)
{
	if (typeof item === 'string')
		item = new Buffer(item);

	var comp = 0x0;

	for (var i = 0; i < this.hashes; i++)
	{
		var hash = Xxhash.hash(item, this.seeds[i]);
		var bit = hash % this.bits;

		var isSet = this.getbit(bit);
		if (!isSet)
			return false;
	}

	return true;
};



module.exports = BloomFilter;
