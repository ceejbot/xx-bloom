/*global describe:true, it:true, before:true, after:true */

var
	chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should(),
	RedisFilter = require('../lib/redis'),
	redis = require('redis')
	;

describe('RedisFilter()', function()
{

	describe('createOrRead()', function()
	{
		it('responds with a filter with the specified options', function(done)
		{
			RedisFilter.createOrRead({
				key: 'test',
				bits: 1632,
				hashes: 8
			}, function(err, filter)
			{
				should.not.exist(err);
				filter.bits.should.equal(1632);
				filter.hashes.should.equal(8);
				filter.seeds.length.should.equal(8);
				filter.key.should.equal('test');
				done();
			});
		});

		it('can read the stored filter from redis', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.should.be.an('object');
				filter.bits.should.equal(1632);
				filter.hashes.should.equal(8);
				filter.seeds.length.should.equal(8);
				filter.key.should.equal('test');
				done();
			});
		});
	});

	describe('initialize()', function()
	{
		it('reads a stored filter from redis', function(done)
		{
			var filter = new RedisFilter({key: 'test'});
			filter.initialize(function(err, isNew)
			{
				should.not.exist(err);
				isNew.should.equal(false);
				filter.bits.should.equal(1632);
				filter.hashes.should.equal(8);
				filter.seeds.length.should.equal(8);
				filter.key.should.equal('test');
				done();
			});
		});

		it('writes metadata if it did not previously exist', function(done)
		{
			var filter = RedisFilter.createOptimal(400, 0.005, { key: 'bigtest'});
			filter.initialize(function(err, isNew)
			{
				should.not.exist(err);
				isNew.should.equal(true);
				filter.bits.should.equal(4411);
				filter.hashes.should.equal(8);
				filter.seeds.length.should.equal(8);
				filter.key.should.equal('bigtest');
				done();
			});
		});
	});

	describe('createOptimal()', function()
	{
		it('returns something of the right size', function()
		{
			var filter = RedisFilter.createOptimal(148, 0.005, { key: 'passthru'});
			filter.bits.should.equal(1632);
			filter.hashes.should.equal(8);
			filter.key.should.equal('passthru');
		});
	});

	describe('setbit() and getbit()', function()
	{
		it('sets the specified bit', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.should.be.an('object');
				filter.setbit(10, function(err)
				{
					should.not.exist(err);
					filter.getbit(10, function(err, val)
					{
						should.not.exist(err);
						val.should.equal(true);
						done();
					});
				});
			});
		});

		it('sets the specified bitlist', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.should.be.an('object');
				filter.setbits([4, 10, 65, 78], function(err)
				{
					should.not.exist(err);
					filter.getbits([4, 10, 65, 78, 5, 11, 77, 64], function(err, values)
					{
						should.not.exist(err);
						values[4].should.equal(true);
						values[10].should.equal(true);
						values[65].should.equal(true);
						values[78].should.equal(true);
						values[5].should.equal(false);
						values[11].should.equal(false);
						values[77].should.equal(false);
						values[64].should.equal(false);
						done();
					});
				});
			});
		});
	});

	describe('add()', function()
	{
		it('can store buffers', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				var buff = new Buffer('cat');
				filter.add(buff, function(err)
				{
					should.not.exist(err);
					filter.has(buff, function(err, has)
					{
						should.not.exist(err);
						has.should.be.ok;
						done();
					});
				});
			});
		});

		it('can store strings', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				filter.add('dog', function(err)
				{
					should.not.exist(err);
					filter.has('dog', function(err, has)
					{
						should.not.exist(err);
						has.should.be.ok;
						done();
					});
				});
			});
		});

		it('can store arrays of buffers or strings', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				filter.add(['mongoose', 'cow', new Buffer('wallaby')], function(err)
				{
					should.not.exist(err);
					filter.has('wallaby', function(err, has)
					{
						should.not.exist(err);
						has.should.be.ok;
						done();
					});
				});
			});
		});

		it('returns false (mostly) for items not in the filter', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.has('kumquat', function(err, found)
				{
					should.not.exist(err);
					found.should.equal(false);
					done();
				});
			});
		});

		it('can add a hundred random items', function(done)
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

			var wordlist = [];
			for (var i = 0; i < 100; i++)
				wordlist.push(randomWord());

			RedisFilter.createOrRead({ key: 'bigtest' }, function(err, filter)
			{
				filter.add(wordlist, function(err)
				{
					should.not.exist(err);

					filter.has(wordlist[50], function(err, has)
					{
						should.not.exist(err);
						has.should.be.ok;

						filter.has(wordlist[66], function(err, has)
						{
							should.not.exist(err);
							has.should.be.ok;

							done();
						});
					});
				});
			});
		});
	});

	describe('clear()', function()
	{
		it('clears all set bits', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.redis.hvals(filter.key, function(err, initial)
				{
					should.not.exist(err);
					filter.clear(function(err)
					{
						should.not.exist(err);
						filter.redis.hvals(filter.key, function(err, cleared)
						{
							should.not.exist(err);
							initial.should.not.equal(cleared);
							cleared[0].should.eql('0');
							done();
						});
					});
				});
			});
		});
	});

	describe('del()', function()
	{
		it('can delete a filter', function(done)
		{
			var filter = new RedisFilter({key: 'passthru'});
			filter.del(function(err)
			{
				should.not.exist(err);
				done();
			});
		});

		it('deletes the relevant keys in redis', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.del(function(err)
				{
					should.not.exist(err);
					filter.redis.exists('test', function(err, exists)
					{
						should.not.exist(err);
						exists.should.equal(0);
						filter.redis.exists('test:meta', function(err, exists)
						{
							should.not.exist(err);
							exists.should.equal(0);
							done();
						});
					});
				});
			});
		});
	});

	after(function(done)
	{
		var filter = new RedisFilter({key: 'bigtest'});
		filter.del(function(err)
		{
			should.not.exist(err);
			done();
		});
	});

});
