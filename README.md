Yet another Bloom filter implementation for node.js. Everybody has to write one, as you know. Backed by [Xxhash](https://code.google.com/p/xxhash/) via [node-xxhash](https://github.com/mscdex/node-xxhash). Xxhash is a fast general-purpose hash, which is all a bloom filter needs. Three variations are provided: a straight Bloom filter, a counting filter (from which items can be removed), and a straight Bloom filter backed by redis. The first two have synchronous APIs. The redis one perforce requires callbacks.

To install: `npm install bloomxx`

[![on npm](https://img.shields.io/npm/v/bloomxx.svg?style=flat)](https://www.npmjs.com/package/bloomxx) [![Build Status](http://img.shields.io/travis/ceejbot/xx-bloom/master.svg?style=flat)](https://travis-ci.org/ceejbot/xx-bloom) [![Coverage Status](https://img.shields.io/coveralls/ceejbot/xx-bloom.svg?style=flat)](https://coveralls.io/github/ceejbot/xx-bloom?branch=master)

## Usage

### BloomFilter

To create a filter, pass an options hash to the constructor:

```javascript
var options =
{
	bits: 1024,
	hashes: 7,
	seeds: [1, 2, 3, 4, 5, 6, 7]
};
filter = new BloomFilter(options);
```

You can pass in seeds for the hash functions if you like, or they'll be randomly generated. Seeds must be integers.

### createOptimal()

To create a filter optimized for the number of items you'll be storing and a desired error rate:

`filter = BloomFilter.createOptimal(estimatedItemCount, errorRate);`

The error rate parameter is optional. It defaults to 0.005, or a 0.5% rate.

### add()

`filter.add('cat');`

Adds the given item to the filter. Can also accept buffers and arrays containing strings or buffers:

`filter.add(['cat', 'dog', 'coati', 'red panda']);`

### has()

To test for membership:

`filter.has('dog');`

### clear()

To clear the filter:

`filter.clear();`

### CountingFilter

Uses about 8 times as much space as the regular filter. Basic usage is exactly the same as the plain Bloom filter:

```javascript
filter = new CountingFilter({ hashes: 8, bits: 1024 });`
filter2 = CountingFilter.createOptimal(estimatedItemCount, optionalErrorRate);
```

Add a list, test for membership, then remove:

```javascript
filter.add(['cat', 'dog', 'coati', 'red panda']);
filter.has('cat'); // returns true
filter.remove('cat');
filter.has('cat'); // returns false most of the time
```

The counting filter tracks its overflow count in `filter.overflow`. Overflow will be non-zero if any bit has been set more than 255 times. Once the filter has overflowed, removing items is no longer reliable.

Check for overflow:

```javascript
filter.hasOverflowed(); // returns boolean
filter.overflow; // integer count of number of times overflow occurred
```

### RedisFilter

This is a plain vanilla bloom filter backed by redis. Its api is asychronous.

```javascript
RedisFilter.createOrRead({
		key: 'cats', // the key used to store data in redis; will also set 'cats:meta'
		bits: 1024,  // filter size in bits
		hashes: 8,   // number of hash functions
		redis: redis.createClient(port, host)  // redis client to use
	}, function(err, filter)
	{
		filter.add(['cat', 'jaguar', 'lion', 'tiger', 'leopard'], function(err)
		{
			filter.has('caracal', function(err, result)
			{
				assert(result === false);
			});
		});
	});
```

The options hash can also specify `host` and `port`, which will be used to create a redis client. `createOrRead()` will attempt to find a filter saved at the given key and create one if it isn't found.

### createOptimal(itemCount, errorRate, options)

Returns a filter sized for the given item count and desired error rate, with other options as specified in the `options` hash.

### clear(function(err) {})

Clear all bits.

### del(function(err) {})

Delete the filter from redis.

## Licence

MIT.
