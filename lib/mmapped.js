var
	assert = require('assert'),
	BloomFilter = require('./bloom'),
	crypto = require('crypto'),
	util = require('util'),
	Xxhash = require('xxhash'),
	mmap = require('mmap-io'),
	fs = require( 'fs' )
	;

function merge( lhs, rhs ) {
	for( var p in rhs ) {
		lhs[ p ] = rhs[ p ];
	}
	return lhs;
}
function MMappedFilter( file, options )
{

	options = options || {};

	try {
		options = merge( options, JSON.parse( fs.readFileSync( file + ".json", { encoding: "utf8" } ) ) );
	}
	catch( e ) {
		;
	}

	this.bits = options.bits || 1024;
	this.bytes = Math.ceil( this.bits / 8 ); 

	this.chunk = options.chunk || this.bytes;

	var mode = "r";

	var fd = fs.openSync( file, mode );

	if ( fs.fstatSync( fd ).size !== this.bytes ) {
		fs.close( fd );
		throw new Error( "File of size " + String( this.bytes ) + " expected." );
	}

	this.buffer = null;
	this.buffers = [ ];

	var bytes = this.bytes, offset = 0, chunkSize, buffer;
	while( bytes > 0 ) {
		chunkSize = Math.min( bytes, this.chunk );
		if ( !options.private ) {
			buffer = mmap.map( chunkSize, mmap.PROT_READ, mmap.MAP_PRIVATE, fd, offset );
			mmap.advise( buffer, mmap.MADV_RANDOM );
		}
		else {
			buffer = new Buffer( chunkSize );
			fs.readSync( fd, buffer, 0, chunkSize, offset );
		}

		offset += this.chunk;
		bytes -= this.chunk;
		this.buffers.push( buffer );
	}

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

var unsupported = function() {
	return new Error( "Memory mapped filters can only ge read from. To create memmapped file, prepare the filter with a BloomFilter instance and then call sync to obtain a filter file copy." );
}

MMappedFilter.prototype.sync = function() {
	throw unsupported();
};

MMappedFilter.prototype.clear = function() {
	throw unsupported();
};

MMappedFilter.prototype.setbit = function() {
	throw unsupported();
};

MMappedFilter.prototype.addBits = function() {
	throw unsupported();
};

MMappedFilter.prototype._addOne = function() {
	throw unsupported();
};

MMappedFilter.prototype.add = function() {
	throw unsupported();
};

MMappedFilter.prototype.getbit = function( bit )
{
	if ( bit > this.bits ) {
		return false;
	}

	var pos = bit >> 3;
	var shift = bit - ( pos << 3 );

	var bitfield = this.buffers[ Math.floor( pos / this.chunk ) ][ pos % this.chunk ];
	return (bitfield & (0x1 << shift)) !== 0;
};

MMappedFilter.estimateItems = BloomFilter.estimateItems;

module.exports = MMappedFilter;