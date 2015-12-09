var db = require('../app.js');
var assert = require('assert');
var assert = require('assert-plus');

it('Call Init', function(){
	this.timeout(15000);
	assert.doesNotThrow(function(){
		db.init({
			host: '127.0.0.1',
			user: 'root',
			password: '',
			database: 'mysqlcache',
			TTL: 0,
			connectionLimit: 100,
			verbose: true, 
			caching: true
		});
	}, Error);
});

it('Test connection', function(done){
	db.testConnection(function(){
		done();
	});
});

it('Show stats', function(){
	db.stats();
});

it('Call a query', function(done){
	this.timeout(15000);
	db.query("SELECT ? + ? AS solution",[1,5],function(resultMysql){
		assert.equal(resultMysql[0].solution,6);
		done();
	});
});

it('Test cache', function(done){
	db.query("SELECT ? + ? AS solution",[1,5],function(resultMysql){
		assert.equal(resultMysql[0].solution,6);
		done();
	});
});

it('Delete a key', function(){
	db.delKey("SELECT ? + ? AS solution",[1,5]);
});

it('One time setting per query', function(done){
	db.query("SELECT ? + ? AS solution",[10,5],function(resultMysql){
		assert.equal(resultMysql[0].solution,15);
		done();
	},{cache:false,TTL:600});
});

it('Non select statement', function(done){
	var post = {};
	db.query("insert into test SET ?",post,function(resultMysql){
		done();
	});
});

it('Flush all cache', function(){
	assert.doesNotThrow(function(){
		db.flushAll();
	}, Error);
});

it('Change DB', function(done){
	db.changeDB({user:"root",pass:"",database:"mysqlcache",charset:"utf8"}, function(err){
		assert.doesNotThrow(function(){
			if(err) throw err;
			done();
		}, Error);
	})
});

it('Change TTL', function(){
	assert.doesNotThrow(function(){
		db.TTL = 60;
	}, Error);
});

it('Change DB to a wrong host', function(done){
	db.changeDB({user:"root",pass:"",database:"mysqlcache",charset:"utf8"}, function(err){
		assert.throws(function(){
			if(err) throw err;
			done();
		}, Error);
	})
});

