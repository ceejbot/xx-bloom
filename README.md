Yet another Bloom filter implementation for node.js. Backed by [Xxhash](https://code.google.com/p/xxhash/) via [node-xxhash](https://github.com/mscdex/node-xxhash). Xxhash is a fast general-purpose hash, which is all a bloom filter needs. Three variations are provided: a straight Bloom filter, a counting filter (from which items can be removed), and a straight Bloom filter backed by redis. The first two have synchronous APIs. The redis one perforce requires callbacks.

Not published on npm yet because I'm not yet satisfied with the cleanliness of the API.

## Usage

### BloomFilter

To create a filter:

`filter = new BloomFilter(hashCount, size, optional-hash-seeds);`

You can pass in seeds for the hash functions if you like, or they'll be randomly generated.

To create a filter optimized for the number of items you'll be storing and a given error rate:

`filter = BloomFilter.optimalForSize(estimatedItemCount, optionalErrorRate);`

The error rate defaults to 0.005 or 0.5%.

`filter.add('cat');`

Adds the given item to the filter. Can also accept buffers and arrays containing strings or buffers:

`filter.add(['cat', 'dog', 'coati', 'red panda']);`

To test for membership:

`filter.has('dog');`

To clear the filter:

`filter.clear();`

### CountingFilter

Uses about 8 times as much space as the regular filter. Basic usage is exactly the same as the plain Bloom filter:

`filter = new CountingFilter(hashCount, size, optional-hash-seeds);`
`filter = CountingFilter.optimalForSize(estimatedItemCount, optionalErrorRate);`

Add a list, test for membership, then remove:

```javascript
filter.add(['cat', 'dog', 'coati', 'red panda']);
filter.has('cat'); // returns true
filter.remove('cat');
filter.has('cat'); // returns false
```

### StorableFilter

```javascript
StorableFilter.createOrRead({
		key: 'test',
		bits: 1024,
		hashes: 8,
		redis: redis.createClient(port, host) 
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

## TODO

* A convenient way to make an optimally-sized storable filter.
* Clean up constructors & the name of the optimal-sizer thingie.

## Licence 

BSD.
