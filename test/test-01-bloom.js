/*global describe:true, it:true, before:true, after:true */

var
	chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should(),
	BloomFilter = require('../lib/bloom')
	;

function hasBitsSet(buffer)
{
	var isset = 0;
	for (var i = 0; i < buffer.length; i++)
		isset |= (buffer[i] !== 0);
	return isset;
}

describe('BloomFilter()', function()
{
	it('constructs a filter of the requested size', function()
	{
		var filter = new BloomFilter({ hashes: 4, bits: 32 });
		assert.equal(filter.seeds.length, 4);
		assert.equal(filter.bits, 32);
		filter.bits.should.equal(32);
		Buffer.isBuffer(filter.buffer).should.be.ok;
	});

	it('zeroes out its storage buffer', function()
	{
		var filter = new BloomFilter({ hashes: 3, bits: 64 });
		for (var i = 0; i < filter.buffer.length; i++)
			filter.buffer[i].should.equal(0);
	});

	it('uses passed-in seeds if provided', function()
	{
		var filter = new BloomFilter({ bits: 256, seeds: [1, 2, 3, 4, 5]});
		filter.hashes.should.equal(5);
		filter.seeds.length.should.equal(5);
		filter.seeds[0].should.equal(1);
		filter.seeds[4].should.equal(5);
	});

	describe('createOptimal()', function()
	{
		it('creates a filter with good defaults', function()
		{
			var filter = BloomFilter.createOptimal(95);
			filter.bits.should.equal(1048);
			filter.hashes.should.equal(8);

			filter = BloomFilter.createOptimal(148);
			filter.bits.should.equal(1632);
			filter.hashes.should.equal(8);

			filter = BloomFilter.createOptimal(10);
			filter.bits.should.equal(110);
			filter.hashes.should.equal(8);
		});

		it('createOptimal() lets you specify an error rate', function()
		{
			var filter = BloomFilter.createOptimal(20000);
			filter.bits.should.equal(220555);
			var previous = filter.bits;

			filter = BloomFilter.createOptimal(20000, 0.2);
			assert.ok(filter.bits < previous, 'we used more bits for a higher error rate!');
		});
	});

	describe('setbit() and getbit()', function()
	{
		it('sets the specified bit', function()
		{
			var filter = new BloomFilter({ hashes: 3, bits: 16 });

			filter.setbit(0);
			var val = filter.getbit(0);
			val.should.equal(true);

			filter.setbit(1);
			val = filter.getbit(1);
			val.should.equal(true);

			val = filter.getbit(2);
			val.should.equal(false);

			filter.setbit(10);
			val = filter.getbit(10);
			val.should.equal(true);
		});

		it('can set all bits', function()
		{
			var i, value;

			var filter = new BloomFilter({ hashes: 3, bits: 16 });
			assert.equal(filter.buffer.length, 2);

			for (i = 0; i < 16; i++)
				filter.setbit(i);

			for (i = 0; i < 2; i++)
			{
				value = filter.buffer[i];
				assert.equal(value, 255);
			}
		});

		it('slides over into the next buffer slice when setting bits', function()
		{
			var val;
			var filter = new BloomFilter({ hashes: 3, bits: 64 });

			filter.setbit(8);
			val = filter.buffer[1];
			val.should.equal(1);

			filter.setbit(17);
			val = filter.buffer[2];
			val.should.equal(2);

			filter.setbit(34);
			val = filter.buffer[4];
			val.should.equal(4);
		});
	});

	describe('add()', function()
	{
		it('can store buffers', function()
		{
			var filter = new BloomFilter({ hashes: 4, bits: 128 });

			hasBitsSet(filter.buffer).should.equal(0);
			filter.add(new Buffer('cat'));
			hasBitsSet(filter.buffer).should.equal(1);
		});

		it('can store strings', function()
		{
			var filter = new BloomFilter({ hashes: 4, bits: 128 });
			filter.add('cat');

			hasBitsSet(filter.buffer).should.equal(1);
		});

		it('can store arrays of buffers or strings', function()
		{
			var filter = new BloomFilter({ hashes: 4, bits: 128 });
			filter.add(['cat', 'dog', 'wallaby']);

			hasBitsSet(filter.buffer).should.equal(1);
		});

		it('can add a hundred random items', function()
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

			var filter = BloomFilter.createOptimal(100);
			var words = [];
			for (var i = 0; i < 100; i++)
			{
				var w = randomWord();
				words.push(w);
				filter.add(w);
			}

			for (i = 0; i < words.length; i++)
				filter.has(words[i]).should.equal(true);
		});

	});


	describe('has()', function()
	{
		it('returns true when called on a stored item', function()
		{
			var filter = new BloomFilter({ hashes: 3, bits: 16 });
			filter.add('cat');

			hasBitsSet(filter.buffer).should.equal(1);
			filter.has('cat').should.be.ok;
		});

		it('returns false for items not in the set (mostly)', function()
		{
			var filter = new BloomFilter({ hashes: 4, bits: 50 });
			filter.add('cat');
			filter.has('dog').should.not.be.ok;
		});

		it('responds appropriately for arrays of added items', function()
		{
			var filter = new BloomFilter({ hashes: 3, bits: 128 });
			filter.add(['cat', 'dog', 'wallaby']);

			filter.has('cat').should.equal(true);
			filter.has('dog').should.equal(true);
			filter.has('wallaby').should.equal(true);
			filter.has('orange').should.equal(false);
		});
	});

	describe('clear()', function()
	{
		it('clears the filter', function()
		{
			var filter = new BloomFilter({ hashes: 3, bits: 128 });
			filter.add(['cat', 'dog', 'wallaby']);
			hasBitsSet(filter.buffer).should.equal(1);

			filter.clear();
			hasBitsSet(filter.buffer).should.equal(0);
		});
	});

});

