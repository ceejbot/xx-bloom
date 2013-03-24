/*global describe:true, it:true, before:true, after:true */

var
	chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should(),
	CountingFilter = require('../lib/counting')
	;

describe('CountingFilter()', function()
{
});


function hasBitsSet(buffer)
{
	var isset = 0;
	for (var i = 0; i < buffer.length; i++)
		isset |= (buffer[i] !== 0);
	return isset;
}

describe('CountingFilter()', function()
{
	it('constructs a filter of the requested size', function()
	{
		var filter = new CountingFilter({ hashes: 4, bits: 32 });
		assert.equal(filter.seeds.length, 4);
		assert.equal(filter.bits, 32);
		filter.bits.should.equal(32);
		Buffer.isBuffer(filter.buffer).should.be.ok;
		filter.buffer.length.should.equal(filter.bits);
	});

	it('uses passed-in seeds if provided', function()
	{
		var filter = new CountingFilter({
			bits: 32,
			seeds: [ 1, 2, 3, 4, 5, 6, 7 ]
		});
		assert.equal(filter.hashes, 7);
		assert.equal(filter.seeds.length, 7);
		assert.equal(filter.seeds[0], 1);
		assert.equal(filter.seeds[6], 7);
	});

	it('zeroes out its storage buffer', function()
	{
		var filter = new CountingFilter();
		for (var i = 0; i < filter.buffer.length; i++)
			filter.buffer[i].should.equal(0);
	});

	describe('createOptimal()', function()
	{
		it('creates a filter with good defaults', function()
		{
			var filter = CountingFilter.createOptimal(95);
			filter.bits.should.equal(1048);
			filter.hashes.should.equal(8);
			filter.buffer.length.should.equal(filter.bits);
		});
	});

	describe('setbit()', function()
	{
		it('sets the requested bit', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.setbit(0);
			filter.buffer[0].should.equal(1);
		});

		it('increments when the same bit is set more than once', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.setbit(0);
			filter.buffer[0].should.equal(1);
			filter.setbit(0);
			filter.buffer[0].should.equal(2);
		});

		it('does not increment at overflow', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.buffer[3] = 255;
			filter.setbit(3);
			filter.buffer[3].should.equal(255);
		});

		it('tracks overflow count', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.overflow.should.equal(0);
			filter.buffer[3] = 255;
			filter.setbit(3);
			filter.overflow.should.equal(1);
			filter.buffer[10] = 255;
			filter.setbit(10);
			filter.overflow.should.equal(2);
		});

		it('hasOverflow() returns true when filter has overflowed', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.hasOverflowed().should.equal(false);
			filter.buffer[3] = 255;
			filter.setbit(3);
			filter.hasOverflowed().should.equal(true);
		});

	});

	describe('unsetbit()', function()
	{
		it('decrements the requested bit', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.setbit(7);
			filter.getbit(7).should.equal(true);
			filter.setbit(7);
			filter.getbit(7).should.equal(true);
			filter.unsetbit(7);
			filter.buffer[7].should.equal(1);
			filter.unsetbit(7);
			filter.buffer[7].should.equal(0);
			filter.unsetbit(7);
			filter.buffer[7].should.equal(0);
		});

		it('does not decrement at overflow', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.buffer[5] = 255;
			filter.unsetbit(5);
			filter.buffer[5].should.equal(255);
		});

	});

	describe('getbit()', function()
	{
		it('returns a boolean representing the state of the requested bit', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.setbit(0);
			filter.getbit(0).should.equal(true);
			filter.setbit(0);
			filter.getbit(0).should.equal(true);
		});
	});

	describe('add()', function()
	{
		it('can store a buffer', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.add(new Buffer('cat'));
			hasBitsSet(filter.buffer).should.equal(1);
		});

		it('can store a string', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.add('cat');
			hasBitsSet(filter.buffer).should.equal(1);
		});

		it('can store an array of strings', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.add(['cat', 'dog', 'wallaby']);
			hasBitsSet(filter.buffer).should.equal(1);
		});
	});

	describe('has()', function()
	{
		it('returns true for items in the map and false otherwise (mostly)', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 64 });
			filter.add(['cat', 'dog', 'wallaby']);
			filter.has('cat').should.equal(true);
			filter.has('aardvark').should.equal(false);
		});
	});

	describe('remove()', function()
	{
		it('removes an item from the filter', function()
		{
			var filter = new CountingFilter({ hashes: 4, bits: 128 });
			filter.add(['cat', 'dog', 'wallaby']);
			filter.has('cat').should.equal(true);
			filter.remove('cat');
			filter.has('cat').should.equal(false);
		});

		it('doesn\'t disturb other items when removing (mostly)', function()
		{
			var filter = new CountingFilter({ hashes: 4, bits: 128 });
			filter.add(['cat', 'dog', 'wallaby']);
			filter.remove('cat');
			filter.has('dog').should.equal(true);
			filter.has('wallaby').should.equal(true);
		});

		it('can add and then remove a hundred random items', function()
		{
			var alpha = '0123456789abcdefghijklmnopqrstuvwxyz';
			function randomWord(length)
			{
				length = length || Math.ceil(Math.random() * 20);
				var result = '';
				for (var i = 0; i < length; i++)
					result += alpha[Math.floor(Math.random() * alpha.length)];

				return result;
			}

			var filter = CountingFilter.createOptimal(100);
			var words = [];
			for (var i = 0; i < 100; i++)
			{
				var w = randomWord();
				words.push(w);
				filter.add(w);
			}

			for (i = 0; i < words.length; i++)
			{
				filter.has(words[i]).should.equal(true);
				filter.remove(words[i]);
			}

			for (i = 0; i < words.length; i++)
				filter.has(words[i]).should.equal(false);

			for (i = 0; i < filter.buffer.length; i++)
				filter.buffer[i].should.equal(0);
		});
	});

	describe('clear()', function()
	{
		it('clears the overflow counter', function()
		{
			var filter = new CountingFilter({ hashes: 3, bits: 16 });
			filter.buffer[3] = 255;
			filter.setbit(3);
			filter.buffer[10] = 255;
			filter.setbit(10);
			filter.overflow.should.equal(2);
			filter.clear();
			filter.overflow.should.equal(0);
			filter.hasOverflowed().should.equal(false);
		});
	});

});
