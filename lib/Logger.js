var mkdirp = require('mkdirp')
var path = require('path')
var fs = require('fs')
var console_enabled = null
var fd = null
var tl = null
var sl = null

//var console_enabled = false;
//var fs = false;

exports.start = function(logfile, _console_enabled, callback){
	
	console_enabled = _console_enabled
	
	// Check if logfile exists. If not, create it
	// Open a filestream to logfile
	if ( !fs.existsSync( logfile ) ){
		
		// Attempt to create directory
		if ( !fs.existsSync( path.dirname( logfile ) ) ){
			try {
				var opts = {
					"mode": "0775"
				}
				
				mkdirp.sync( path.dirname(logfile), opts )
				console.log( "Log directory " + path.dirname(logfile) + " does not exist, creating...\n" )
			}
			catch( err ){
				console.error( "Can't create directory for logfile: " + logfile + ": " + err + "\n")
				process.exit()
			}
		}
	}
	
	// Open logfile
	openLogFile( logfile, "main" )
}

exports.stop = function(){
	fs.close( fd, ( err ) => {
		if ( err ){
			console.error( "Can't close filestream: " + err + "\n" )
		}
	})
}

exports.write = function( msg, level, callback ){
	
	if ( !level )
		level = "INFO"
			
	log_levels = {
		"OFF": 0,
		"INFO": 1,
		"WARN": 2,
		"ERROR": 3,
		"DEBUG": 4,
	}
	
	var date = new Date( Date.now() )
	log_prefix = date.toLocaleDateString( "en-us" ) + " " + date.toLocaleTimeString( "en-us" ) + " [" + level + "] "
	logfile_msg = log_prefix + "  " + msg + "\n"
			
	if ( fd ){
		fs.write( fd, logfile_msg, ( err ) => {
			if ( err )
				console.error( "Can't write to logfile: " + err + "\n" )
		})
	}

	if ( console_enabled )
		console.log( msg )
		
	callback = true
}

exports.write_transaction = function( params, callback ){
	
	var logfile_msg = this.getDate() + "," + params.usd + "," + params.coins + "," + params.price + "," + params.type + "," + params.side + "\n"
			
	if ( fd ){
		fs.write( tl, logfile_msg, ( err ) => {
			if ( err )
				console.error( "Can't write to logfile: " + err + "\n" )
		})
	}

	if ( console_enabled )
		console.log( msg )
		
	callback( true )
}

exports.write_stat = function( params, callback ){
	
	var status
	if ( params.side == "sell" ){
		status = " | " + params.status
	}
	else {
		status = ""
	}
	
	var logfile_msg = "" +
	this.getDate() + status + "\n" +
	"---------------------------------------------\n" +
	"| " + params.side.toString() + "\n" +
	"---------------------------------------------\n" +
	"       1MIN SLOPE: " + params.oneMin_slope_rate + "\n" +
	"       5MIN SLOPE: " + params.fiveMin_slope_rate + "\n" +
	"      15MIN SLOPE: " + params.tactical_slope_rate + "\n" +
	"      30MIN SLOPE: " + params.halfHr_slope_rate + "\n" +
	"        1HR SLOPE: " + params.oneHr_slope_rate + "\n" +
	"        2HR SLOPE: " + params.twoHr_slope_rate + "\n" +
	"        3HR SLOPE: " + params.threeHr_slope_rate + "\n" +
	"        4HR SLOPE: " + params.fourHr_slope_rate + "\n" +
	"    1HR AVG SLOPE: " + params.oneHr_slope_avg + "\n" +
	"    2HR AVG SLOPE: " + params.twoHr_slope_avg + "\n" +
	"    3HR AVG SLOPE: " + params.threeHr_slope_avg + "\n" +
	"    4HR AVG SLOPE: " + params.fourHr_slope_avg + "\n\n" +
	"     TICKER PRICE: " + params.price + "\n" +
	"           PROFIT: " + params.earnings + "\n" +
	"        BUY_PRICE: " + params.price + "\n" +
	"       PRICE DIFF: " + params.price_diff + "\n" +
	"        SINK RATE: " + params.sink_rate + "\n" +
	"       PEAK PRICE: " + params.peak_price + "\n" +
	"     BOTTOM PRICE: " + params.bottom_price + "\n" +
	"       SELL COUNT: " + params.consecutive_sell + "\n" +
	"  PRICE CHANGE UP: " + params.upchange_total + "\n" +
	"PRICE CHANGE DOWN: " + params.downchange_total + "\n" +
	"       BUY REASON: " + params.buy_reason + "\n" +
	"      SELL REASON: " + params.sell_reason + "\n" + 
	"---------------------------------------------\n\n\n\n"
	
	if ( sl ){
		fs.write( sl, logfile_msg, ( err ) => {
			if ( err )
				console.error( "Can't write to logfile: " + err + "\n" )
		})
	}
		
	callback( true )
}

exports.start_transaction_log = function(logfile, callback){
	
	// Check if logfile exists. If not, create it
	// Open a filestream to logfile
	if ( !fs.existsSync( logfile ) ){
		
		// Attempt to create directory
		if ( !fs.existsSync( path.dirname( logfile ) ) ){
			try {
				var opts = {
					"mode": "0775"
				}
				
				mkdirp.sync( path.dirname(logfile), opts )
				console.log( "Log directory " + path.dirname(logfile) + " does not exist, creating...\n" )
			}
			catch( err ){
				console.error( "Can't create directory for logfile: " + logfile + ": " + err + "\n")
				process.exit()
			}
		}
	}
	
	// Open logfile
	openLogFile( logfile, "transaction" )
	
	var out = "BUY/SELL REPORT FOR " + this.getDate() + ",,,,,\nDate/Time,USD,COINS,PRICE,COIN,SIDE"
	
	if ( tl ){
		fs.write( tl, out, ( err ) => {
			if ( err )
				console.error( "Can't write to logfile: " + err + "\n" )
		})
	}
}

exports.start_stats_log = function(logfile, callback){
	
	// Check if logfile exists. If not, create it
	// Open a filestream to logfile
	if ( !fs.existsSync( logfile ) ){
		
		// Attempt to create directory
		if ( !fs.existsSync( path.dirname( logfile ) ) ){
			try {
				var opts = {
					"mode": "0775"
				}
				
				mkdirp.sync( path.dirname(logfile), opts )
				console.log( "Log directory " + path.dirname(logfile) + " does not exist, creating...\n" )
			}
			catch( err ){
				console.error( "Can't create directory for logfile: " + logfile + ": " + err + "\n")
				process.exit()
			}
		}
	}
	
	// Open logfile
	openLogFile( logfile, "stats" )
}

function openLogFile( logfile, type ){
	// Open filestream
	try {
		if ( type == "main" ){
			fd = fs.openSync( logfile, "a+", "0664" )
		}
		else if ( type == "transaction" ){
			tl = fs.openSync( logfile, "a+", "0664" )
		}
		else if ( type == "stats" ){
			sl = fs.openSync( logfile, "a+", "0664" )
		}
	}
	catch( err ){
		if ( err ){
			console.error( "Can't create logfile: " + err + "\n" )
			process.exit
		}	
	}
}

exports.getDate = function(){
	var date = new Date( Date.now() )
	return date.toLocaleDateString( "en-us" ) + " " + date.toLocaleTimeString( "en-us" )
}



