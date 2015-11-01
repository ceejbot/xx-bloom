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

	if( !options ) {
		try {
			options = JSON.parse( fs.readFileSync( file + ".json", { encoding: "utf8" } ) );
		}
		catch( e ) {
			;
		}
	}

	options = options || {};

	this.bits = options.bits || 1024;
	this.bytes = Math.ceil( this.bits / 8 ); 

	var mode = "r";

	var fd = fs.openSync( file, mode );

	if ( fs.fstatSync( fd ).size !== this.bytes ) {
		fs.close( fd );
		throw new Error( "File of size " + String( this.bytes ) + " expected." );
	}

	if ( options.shared ) {
		this.buffer = mmap.map( this.bytes, mmap.PROT_READ, mmap.MAP_PRIVATE, fd );
		mmap.advise( this.buffer, mmap.MADV_RANDOM );
	}
	else {
		this.buffer = new Buffer( this.bytes );
		fs.readSync( fd, this.buffer, 0, this.bytes, 0 );
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

MMappedFilter.estimateItems = BloomFilter.estimateItems;

module.exports = MMappedFilter;