var
	crypto = require('crypto'),
	util = require('util'),
	Xxhash = require('xxhash')
	;


var LN2_SQUARED = Math.LN2 * Math.LN2;
function BloomFilter(options)
{
	options = options || {};

	this.bits = options.bits || 1024;

	this.hashbits = Math.ceil( Math.log( this.bits ) / Math.LN2 );
	this.hashbytes = Math.ceil( this.hashbits / 8 );
	this.hash128coverage = Math.floor( 128 / this.hashbytes / 8 );

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

	this.buffer = new Buffer(Math.ceil(this.bits / 8));
	this.clear();
}

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

BloomFilter.estimateItems = function( bits, errorRate )
{
	errorRate = errorRate || 0.005;
	bits = bits || 2 * 1024 * 1024 * 8; // 2 MB
	var itemcount = Math.round( LN2_SQUARED * bits / ( -1 * Math.log( errorRate ) ) );
	var hashes = Math.round((bits / itemcount) * Math.LN2);
	var hashbits = Math.ceil( Math.log( bits ) / Math.LN2 );
	var hashbytes = Math.ceil( hashbits / 8 );
	return {
		bits: bits,
		errorRate: errorRate,
		itemcount: itemcount,
		hashes: hashes,
		hashbits: hashbits,
		hashbytes: hashbytes,
		hash128coverage: Math.floor( 128 / hashbytes / 8 )
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

	for ( var i = 0, l = this.hashes; i < l; i++ )
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
		for ( var i = 0; i < item.length; i++)
			this._addOne(item[i]);
	}
	else
		this._addOne(item);
};

BloomFilter.prototype.getBits = function( item ) {

	if (typeof buf === 'string')
		buf = new Buffer(buf);

	var bits = [];
	for ( var i = 0, l = this.hashes, hash; i < l; i++ )
		hash = Xxhash.hash( buf, this.seeds[i]);
		bits.push( hash % this.bits ); }

	return bits;
};

BloomFilter.prototype.hasBits = function( bits ) {
	for (var i = 0, l = bits.length; i < l; i++) {
		if ( !this.getbit( bits[ i ] ) ) {
			return false;
		}
	}
	return true;
};

BloomFilter.prototype.addBits = function( bits ) {
	for ( var i = 0, l = bits.length; i < l; i++ )
	{
		this.setbit( bits[ i ] );
	}

};


BloomFilter.prototype.has = function(item)
{
	if (typeof item === 'string')
		item = new Buffer(item);

	for (var i = 0, l = this.hashes; i < l; i++)
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
