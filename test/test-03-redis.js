/*global describe:true, it:true, before:true, after:true */

var
	demand = require('must'),
	RedisFilter = require('../lib/redis')
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
				demand(err).not.exist();
				filter.bits.must.equal(1632);
				filter.hashes.must.equal(8);
				filter.seeds.length.must.equal(8);
				filter.key.must.equal('test');
				done();
			});
		});

		it('can read the stored filter from redis', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				demand(err).not.exist();
				filter.must.be.an.object();
				filter.bits.must.equal(1632);
				filter.hashes.must.equal(8);
				filter.seeds.length.must.equal(8);
				filter.key.must.equal('test');
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
				demand(err).not.exist();
				isNew.must.equal(false);
				filter.bits.must.equal(1632);
				filter.hashes.must.equal(8);
				filter.seeds.length.must.equal(8);
				filter.key.must.equal('test');
				done();
			});
		});

		it('writes metadata if it did not previously exist', function(done)
		{
			var filter = RedisFilter.createOptimal(400, 0.005, { key: 'bigtest'});
			filter.initialize(function(err, isNew)
			{
				demand(err).not.exist();
				isNew.must.equal(true);
				filter.bits.must.equal(4411);
				filter.hashes.must.equal(8);
				filter.seeds.length.must.equal(8);
				filter.key.must.equal('bigtest');
				done();
			});
		});
	});

	describe('createOptimal()', function()
	{
		it('returns something of the right size', function()
		{
			var filter = RedisFilter.createOptimal(148, 0.005, { key: 'passthru'});
			filter.bits.must.equal(1632);
			filter.hashes.must.equal(8);
			filter.key.must.equal('passthru');
		});
	});

	describe('setbit() and getbit()', function()
	{
		it('sets the specified bit', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				demand(err).not.exist();
				filter.must.be.an.object();
				filter.setbit(10, function(err)
				{
					demand(err).not.exist();
					filter.getbit(10, function(err, val)
					{
						demand(err).not.exist();
						val.must.equal(true);
						done();
					});
				});
			});
		});

		it('sets the specified bitlist', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				demand(err).not.exist();
				filter.must.be.an.object();
				filter.setbits([4, 10, 65, 78], function(err)
				{
					demand(err).not.exist();
					filter.getbits([4, 10, 65, 78, 5, 11, 77, 64], function(err, values)
					{
						demand(err).not.exist();
						values[4].must.equal(true);
						values[10].must.equal(true);
						values[65].must.equal(true);
						values[78].must.equal(true);
						values[5].must.equal(false);
						values[11].must.equal(false);
						values[77].must.equal(false);
						values[64].must.equal(false);
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
				demand(err).not.exist();
				var buff = new Buffer('cat');
				filter.add(buff, function(err)
				{
					demand(err).not.exist();
					filter.has(buff, function(err, has)
					{
						demand(err).not.exist();
						has.must.be.ok;
						done();
					});
				});
			});
		});

		it('can store strings', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				demand(err).not.exist();
				filter.add('dog', function(err)
				{
					demand(err).not.exist();
					filter.has('dog', function(err, has)
					{
						demand(err).not.exist();
						has.must.be.ok;
						done();
					});
				});
			});
		});

		it('can store arrays of buffers or strings', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				demand(err).not.exist();
				filter.add(['mongoose', 'cow', new Buffer('wallaby')], function(err)
				{
					demand(err).not.exist();
					filter.has('wallaby', function(err, has)
					{
						demand(err).not.exist();
						has.must.be.ok;
						done();
					});
				});
			});
		});

		it('returns false (mostly) for items not in the filter', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				demand(err).not.exist();
				filter.has('kumquat', function(err, found)
				{
					demand(err).not.exist();
					found.must.equal(false);
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
				demand(err).not.exist();
				filter.add(wordlist, function(err)
				{
					demand(err).not.exist();

					filter.has(wordlist[50], function(err, has)
					{
						demand(err).not.exist();
						has.must.be.ok;

						filter.has(wordlist[66], function(err, has)
						{
							demand(err).not.exist();
							has.must.be.ok;

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
				demand(err).not.exist();
				filter.redis.hvals(filter.key, function(err, initial)
				{
					demand(err).not.exist();
					filter.clear(function(err)
					{
						demand(err).not.exist();
						filter.redis.hvals(filter.key, function(err, cleared)
						{
							demand(err).not.exist();
							initial.must.not.equal(cleared);
							cleared[0].must.eql('0');
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
				demand(err).not.exist();
				done();
			});
		});

		it('deletes the relevant keys in redis', function(done)
		{
			RedisFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				demand(err).not.exist();
				filter.del(function(err)
				{
					demand(err).not.exist();
					filter.redis.exists('test', function(err, exists)
					{
						demand(err).not.exist();
						exists.must.equal(0);
						filter.redis.exists('test:meta', function(err, exists)
						{
							demand(err).not.exist();
							exists.must.equal(0);
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
			demand(err).not.exist();
			done();
		});
	});

});
