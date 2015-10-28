var
	assert = require('assert'),
	BloomFilter = require('./bloom'),
	crypto = require('crypto'),
	util = require('util'),
	Xxhash = require('xxhash'),
	mmap = require('mmap-io'),
	fs = require( 'fs' )
	;

function MMappedFilter( file, options )
{
	options = options || {};

	this.bits = options.bits || 1024;
	this.bytes = Math.ceil( this.bits / 8 ); 

	var mode = "r";
	if ( options.create ) {
		mode = "w+";
	}
	var fd = fs.openSync( file, mode );

	if ( options.create ) {
		var b = new Buffer( [ 0 ] );
		fs.writeSync( fd, b, 0, 1, this.bytes - 1 );
	}

	if ( fs.fstatSync( fd ).size !== this.bytes ) {
		fs.close( fd );
		throw new Error( "File of size " + String( this.bytes ) + " expected." );
	}

	this.buffer = mmap.map( this.bytes, mmap.PROT_READ | mmap.PROT_WRITE, mmap.MAP_SHARED, fd );
	mmap.advise( this.buffer, mmap.MADV_RANDOM );

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

	fs.close( fd );
}
util.inherits( MMappedFilter, BloomFilter );

MMappedFilter.prototype.sync = function() {
	mmap.sync( this.buffer );
};

MMappedFilter.prototype.clear = function() {
	this.buffer.fill(0, 0, this.buffer.length );
	this.sync();
};

MMappedFilter.estimateItems = BloomFilter.estimateItems;

MMappedFilter.createOptimal = function( file, itemcount, errorRate ) {
	var opts = BloomFilter.optimize(itemcount, errorRate);
	opts.create = true;
	return new MMappedFilter(file, opts);
};

module.exports = MMappedFilter;