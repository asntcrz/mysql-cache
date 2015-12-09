var mysql = require('mysql');
var NodeCache = require( "node-cache" );
var myCache = new NodeCache({ stdTTL: 0, checkperiod: 120 });
var colors = require('colors');
var crypto = require('crypto');
var md5sum = crypto.createHash('md5');

exports.init = function(config){
	if(!config.host){
		exports.log("error","No host value supplied in configuration");return;
	}
	if(!config.user){
		exports.log("error","No user value supplied in configuration");return;
	}
	if(!config.database){
		exports.log("error","No database value supplied in configuration");return;
	}
	if(!config.connectionLimit){
		exports.log("error","No connectionLimit value supplied in configuration");return;
	}
	if(!config.password){
		exports.log("warn","No password value supplied in configuration");
	}

	exports.pool = mysql.createPool({
		host     : config.host,
		user     : config.user,
		password : config.password,
		database : config.database,
		connectionLimit: config.connectionLimit,
		supportBigNumbers: true
	});
	exports.TTL = config.TTL;
	exports.verboseMode = config.verbose;
	exports.cacheMode = config.caching;
}

exports.TTL = 0;
exports.prefix = 'mysql-cache';
exports.ready = false;
exports.lastTrace = "";
exports.cacheShow = 0;
exports.poolConnections = 0;
exports.querys = 0;
exports.totalquerys = 0;
exports.QPM = 0;

exports.queryPerSec = function(){
	setInterval(function(){
		exports.QPM = exports.querys;
		exports.querys = 0;
	},1000);
}
exports.queryPerSec();

exports.flushAll = function(){
	myCache.flushAll();
	exports.log("success","Cache Flushed");
}

exports.stats = function(){
	console.log("-----------------------");
	console.log(colors.yellow(exports.prefix+": ")+" Statistics");
	console.log("Open Pool Connections: "+exports.poolConnections);
	console.log("Requests Per Second: "+exports.QPM);
	console.log("Hits: "+myCache.getStats().hits);
	console.log("Misses: "+myCache.getStats().misses);
	console.log("Keys: "+myCache.getStats().keys);
	console.log("Key Size: "+myCache.getStats().ksize);
	console.log("Value Size: "+myCache.getStats().vsize);
	if(exports.QPM>=100){
		console.log("**** "+colors.red("QUERRY PER SEC TOO HIGH"));
	}
	if(exports.poolConnections>=100){
		console.log("**** "+colors.red("MYSQL POOL CONNECTION LIMIT REACHED"));
	}
	console.log("-----------------------");
};

exports.query = function(sql,params,callback,data){

	exports.lastTrace = getStackTrace();
	cacheMode = exports.cacheMode;
	
	exports.querys++;
	
	if(typeof(params)=="function"){
		data = callback;
		callback = params;
		params = [];
		query = sql;
	}else{
		query = sql;
	}
	if(typeof(sql)=="object"){
		query = sql.sql;
	}
	var type = query.split(" ")[0];
	
	query = mysql.format(query,params);
	
	if(type == "SELECT"){
		var hash = crypto.createHash('md5').update(query).digest('hex');
		exports.getKey(hash,function(cache){
			if(!cacheMode) cache = false;
			if(data){
				if(data.cache == false){
					cache = false;
				}
			}
			if(cache){
				if(exports.verboseMode) console.log(colors.yellow(hash)+"-"+colors.green(query));
				callback(cache);
			}else{
				if(exports.verboseMode) console.log(colors.yellow(hash)+"-"+colors.red(query));
				getPool(function(connection){
					connection.query(sql,params, function(err, rows){
						endPool(connection,function(poolResult){
							if(!poolResult){
								exports.log("warn","A Connection was trying to be released while it already was!");
								exports.log("error",exports.lastTrace);
							}
						});
						if (err){
							endPool(connection,function(poolResult){
								if(!poolResult){
									exports.log("warn","A Connection was trying to be released while it already was!");
									exports.log("error",exports.lastTrace);
								}
							});
							callback(false,"DBERROR");
							throw err;
							return;
						}
						if(data){
							TTLSet = 0;
							if(data.TTL){
								TTLSet = data.TTL;
							}
						}else{
							TTLSet = exports.TTL;
						}
						exports.createKey(hash,rows,function(result){
							if(result){
								if(!callback) return;
								callback(rows);
							}else{
								log("error","CACHE KEY CREATE FAILED!");
								if(!callback) return;
								callback(false,"CACHEERROR");
							}
						},TTLSet);
					});
				});
			}
		});
	}else{
		getPool(function(connection){
			connection.query(sql,params, function(err, rows){
				endPool(connection,function(poolResult){
					if(!poolResult){
						exports.log("warn","A Connection was trying to be released while it already was!");
						exports.log("error",exports.lastTrace);
					}
				});
				if (err){
					callback(false,"DBERROR");return;
				}
				exports.log("warn",query);
				callback(rows);
			});
		});
	}
}

exports.delKey = function(id,params){
	id = mysql.format(id,params);
	var hash = crypto.createHash('md5').update(id).digest('hex');
	myCache.del(hash);
}

exports.getKey = function(id,callback){
	myCache.get(id, function(err, value){
		if(!err){
			if(value == undefined){
				callback(false);
				
			}else{
				callback(value);
			}
		}
	});
}

exports.createKey = function(id,val,callback,ttl){
	var oldTTL = exports.TTL;
	if(ttl) exports.TTL = ttl;
	myCache.set(id, val, exports.TTL, function(err, success){
		exports.TTL = oldTTL;
		if( !err && success ){
			callback(true);
		}else{
			callback(false);
		}
	});
}

exports.changeDB = function(data,callback){
	getPool(function(connection){
		connection.changeUser(data, function(err) {
			
			endPool(connection,function(){
				if (err){
					exports.log("warn","Could not change database connection settings.");
					callback(err);
					return;
				}
				exports.log("success","Successfully changed database connection settings");
				callback(false);
			});
		});
	});
}

var getStackTrace = function() {
  var obj = {};
  Error.captureStackTrace(obj, getStackTrace);
  return obj.stack;
};

function getPool(callback){
    exports.pool.getConnection(function(err, connection) {
		if (err) throw new Error(err);
		exports.poolConnections++;
		callback(connection);
	});
}

function endPool(connection,callback){
	if(exports.poolConnections==0){
		callback(false);
		
		return;
	}
	exports.poolConnections--;
	connection.release();
	callback(true);
}

exports.log = function(type,text){
	if(type=="success" && exports.verboseMode) console.log(colors.green(exports.prefix+": ")+text);
	if(type=="info" && exports.verboseMode) console.log(colors.yellow(exports.prefix+": ")+text);
	if(type=="warn") console.log(colors.red(exports.prefix+": ")+text);
	if(type=="error") throw new Error(text);
}

exports.testConnection = function(callback){
	exports.log("info","Connecting to DB");
    exports.pool.getConnection(function(err, connection) {
		if (err){
			exports.log("warn",err.code);
			exports.log("warn","Trying to reconnect in 3 seconds.");
			setTimeout(function(){
				testConnection();
			},3000);
			return;
		}
		endPool(connection,function(){
			exports.log("success","Connected to DB");
			exports.ready = true;
			callback();
		});
	});
}