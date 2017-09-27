var
	crypto = require('crypto'),
	Xxhash = require('xxhash')
	;

var BloomFilter = module.exports = function BloomFilter(options)
{
	if (Buffer.isBuffer(options))
	{
		this.fromBuffer(options);
		return;
	}

	options = options || {};

	if (options.seeds)
	{
		this.seeds = options.seeds;
	}
	else
	{
		this.seeds = [];
		this.generateSeeds(options.hashes || 8);
	}

	this.bits = parseInt(options.bits, 10) || 1024;
	this.buffer = Buffer.alloc(Math.ceil(this.bits / 8));
};

var LN2_SQUARED = Math.LN2 * Math.LN2;
BloomFilter.optimize = function optimize(itemcount, errorRate)
{
	errorRate = errorRate || 0.005;
	var bits = Math.round(-1 * itemcount * Math.log(errorRate) / LN2_SQUARED);
	var hashes = Math.round((bits / itemcount) * Math.LN2);
	return { bits, hashes };
};

BloomFilter.createOptimal = function createOptimal(itemcount, errorRate)
{
	var opts = BloomFilter.optimize(itemcount, errorRate);
	return new BloomFilter(opts);
};

BloomFilter.prototype.clear = function()
{
	this.buffer.fill(0);
};

BloomFilter.prototype.generateSeeds = function generateSeeds(count)
{
	var buf, j;
	if (!this.seeds)
		this.seeds = [];

	for (var i = 0; i < count; i++)
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

BloomFilter.prototype.setbit = function setbit(bit)
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

BloomFilter.prototype.getbit = function getbit(bit)
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

BloomFilter.prototype._addOne = function _addOne(buf)
{
	if (typeof buf === 'string')
		buf = new Buffer(buf);

	for (var i = 0; i < this.seeds.length; i++)
	{
		var hash = Xxhash.hash(buf, this.seeds[i]);
		var bit = hash % this.bits;
		this.setbit(bit);
	}
};

BloomFilter.prototype.add = function add(item)
{
	if (Array.isArray(item))
	{
		for (var i = 0; i < item.length; i++)
			this._addOne(item[i]);
	}
	else
		this._addOne(item);
};

BloomFilter.prototype.has = function has(item)
{
	if (typeof item === 'string')
		item = new Buffer(item);

	for (var i = 0; i < this.seeds.length; i++)
	{
		var hash = Xxhash.hash(item, this.seeds[i]);
		var bit = hash % this.bits;

		var isSet = this.getbit(bit);
		if (!isSet)
			return false;
	}

	return true;
};

BloomFilter.prototype.toBuffer = function toBuffer()
{
	// Wireline format is: a buffer structured in the following manner:
	// first 6 bytes: uint 16 containing # of bits
	// 7th byte: number of hash seeds, N (note lurking bug if ludicrous # of seeds)
	// followed by N x uint 32 LE seeds
	// remainder of buffer is the filter data
	// Note the fragility to change but also the brute-headed compactness.
	const buf = Buffer.alloc(6 + 1 + this.seeds.length * 4 + this.buffer.length);

	var ptr = 0;
	buf.writeUIntLE(this.bits, ptr, 6);
	ptr += 6;
	buf.writeUInt8(this.seeds.length, ptr++);
	for (var i = 0; i < this.seeds.length; i++, ptr += 4)
	{
		buf.writeUInt32LE(this.seeds[i], ptr);
	}

	this.buffer.copy(buf, ptr);
	return buf;
};

BloomFilter.prototype.fromBuffer = function fromBuffer(buf)
{
	var ptr = 0;
	this.bits = buf.readUIntLE(ptr, 6);
	ptr += 6;

	this.seeds = [];
	var seedcount = buf.readUInt8(ptr++);
	for (var i = 0; i < seedcount; i++, ptr += 4)
	{
		this.seeds[i] = buf.readUInt32LE(ptr);
	}

	this.buffer = Buffer.alloc(buf.length - 7 - (4 * seedcount));
	buf.copy(this.buffer, 0, ptr);
};
