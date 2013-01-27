/*global describe:true, it:true, before:true, after:true */

var
	chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should(),
	StorableFilter = require('../lib/redis'),
	redis = require('redis')
	;

describe('StorableFilter()', function()
{

	describe('createOrRead()', function()
	{
		it('responds with a filter with the specified options', function(done)
		{
			StorableFilter.createOrRead({
				key: 'test',
				bits: 128,
				hashes: 4
			}, function(err, filter)
			{
				should.not.exist(err);
				filter.bits.should.equal(128);
				filter.hashes.should.equal(4);
				filter.seeds.length.should.equal(4);
				filter.key.should.equal('test');
				done();
			});
		});

		it('can read the stored filter from redis', function(done)
		{
			StorableFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.should.be.an('object');
				filter.bits.should.equal(128);
				filter.hashes.should.equal(4);
				filter.seeds.length.should.equal(4);
				filter.key.should.equal('test');
				done();
			});
		});
	});

	describe('setbit() and getbit()', function()
	{
		it('sets the specified bit', function(done)
		{
			StorableFilter.createOrRead({ key: 'test' }, function(err, filter)
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
			StorableFilter.createOrRead({ key: 'test' }, function(err, filter)
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

	describe('clear()', function()
	{
		it('clears all set bits', function(done)
		{
			StorableFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.redis.get(filter.key, function(err, initial)
				{
					should.not.exist(err);
					filter.clear(function(err)
					{
						should.not.exist(err);
						filter.redis.get(filter.key, function(err, cleared)
						{
							should.not.exist(err);
							initial.should.not.equal(cleared);
							cleared.should.eql('0');
							done();
						});
					});
				});
			});
		});
	});

	describe('add()', function()
	{
		it('can store buffers', function(done)
		{
			StorableFilter.createOrRead({ key: 'test' }, function(err, filter)
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
			StorableFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				filter.add('cat', function(err)
				{
					should.not.exist(err);
					filter.has('cat', function(err, has)
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
			StorableFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				filter.add(['cat', 'dog', 'wallaby'], function(err)
				{
					should.not.exist(err);
					filter.has('cat', function(err, has)
					{
						should.not.exist(err);
						has.should.be.ok;
						done();
					});
				});
			});
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
		});

	});

	describe('clear()', function()
	{
		it('clears the filter', function()
		{
		});
	});


	describe('del()', function()
	{
		it('deletes the relevant keys in redis', function(done)
		{
			StorableFilter.createOrRead({ key: 'test' }, function(err, filter)
			{
				should.not.exist(err);
				filter.del(function(err)
				{
					should.not.exist(err);
					done();
				});
			});
		});
	});


});
