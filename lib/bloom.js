var
	crypto = require('crypto'),
	Xxhash = require('xxhash')
	;

var BloomFilter = module.exports = function BloomFilter(options)
{
	options = options || {};

	if (options.seeds)
	{
		this.seeds = options.seeds;
		this.hashes = options.seeds.length;
	}
	else
	{
		this.seeds = [];
		this.hashes = options.hashes || 8;
		this.generateSeeds();
	}

	this.bits = options.bits || 1024;
	this.buffer = new Buffer(Math.ceil(this.bits / 8));
	this.clear();
};

var LN2_SQUARED = Math.LN2 * Math.LN2;
BloomFilter.optimize = function(itemcount, errorRate)
{
	errorRate = errorRate || 0.005;
	var bits = Math.round(-1 * itemcount * Math.log(errorRate) / LN2_SQUARED);
	var hashes = Math.round((bits / itemcount) * Math.LN2);
	return {
		bits: bits,
		hashes: hashes
	};
};

BloomFilter.createOptimal = function(itemcount, errorRate)
{
	var opts = BloomFilter.optimize(itemcount, errorRate);
	return new BloomFilter(opts);
};

BloomFilter.prototype.clear = function()
{
	this.buffer.fill(0);
};

BloomFilter.prototype.generateSeeds = function()
{
	var buf, j;
	if (!this.seeds)
		this.seeds = [];

	for (var i = 0; i < this.hashes; i++)
	{
		buf = crypto.randomBytes(4);
		this.seeds[i] = buf.readUInt32LE(0);

		// Make sure we don't end up with two identical seeds,
		// which is unlikely but possible.
		for (j = 0; j < i; j++)
		{
			if (this.seeds[i] === this.seeds[j])
			{
				i--;
				break;
			}
		}
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
