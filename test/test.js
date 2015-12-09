var db = require('../app.js');
var assert = require('assert');
var assert = require('assert-plus');

describe("Internal", function(){
	it('Call Init', function(){
		assert.doesNotThrow(function(){
			db.init({
				host: '127.0.0.1',
				user: 'root',
				password: '',
				database: 'mysqlcache',
				TTL: 0, // Time To Live for a cache key in seconds (0 = infinite)
				connectionLimit: 100, // Mysql connection pool limit (increase value if you are having problems)
				verbose: true, // Do you want info and success messages about what the program is doing?
				caching: true // Do you want to enable caching?
			});
		}, Error);
	});
	it('Show stats', function(){
		db.stats();
	});
	it('Call a query', function(done){
		this.timeout(15000);
		db.query("SELECT ? + ? AS solution",[1,5],function(resultMysql){ // the SQL contains a SELECT which means it will be cached for future use.
			assert.equal(resultMysql[0].solution,6);
			done();
		});
	});
	it('Flush all cache', function(){
		assert.doesNotThrow(function(){
			db.flushAll();
		}, Error);
	});
	
	it('Change DB', function(){
		db.changeDB({user:"root",pass:"",database:"mysql-cache",charset:"utf8"}, function(err){  // Change database connection settings on the fly.
			assert.doesNotThrow(function(){
				if(err) throw err;
			}, Error);
		})
	});
});
return;

db.init({
	host: '127.0.0.1',
	user: 'root',
	password: '',
	database: 'mysql-cache',
	TTL: 0, // Time To Live for a cache key in seconds (0 = infinite)
	connectionLimit: 100, // Mysql connection pool limit (increase value if you are having problems)
	verbose: true, // Do you want info and success messages about what the program is doing?
	caching: true // Do you want to enable caching?
});

db.TTL = 60; // Change amount of Time To Live in seconds for a cache key in realtime.

// Start executing SQL like you are used to using node-mysql
db.query("SELECT ? + ? AS solution",[1,5],function(resultMysql){ // the SQL contains a SELECT which means it will be cached for future use.
	db.query("SELECT ? + ? AS solution",[1,5],function(resultCached){ // This exact SQL has been executed before and will be retrieved from cache.
		db.delKey("SELECT ? + ? AS solution",[1,5]); // Delete this SQL cache key.
		db.query("SELECT ? + ? AS solution",[1,5],function(resultRemoved){ // This SQL will be executed on the database because the sql cache key was deleted.
			console.log("Result from mysql is: "+resultMysql[0].solution);
			console.log("Result cached is: "+resultCached[0].solution);
			console.log("Result after cache key is deleted: "+resultRemoved[0].solution);
			
			db.changeDB({user:"testusername",pass:"keepo",database:"kappa",charset:"utf8"}, function(err){  // Change database connection settings on the fly.
				if(err) throw err;
			})
		});
	},{cache:false}); // Do not cache this query.
},{TTL:600}); // Set TTL to 600 only for this query.



db.flushAll(); // Flush the cache.

