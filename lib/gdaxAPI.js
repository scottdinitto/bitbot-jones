const ds = require( './DataStructures.js' ).data
const d = require( './DataStructures.js' )
const log = require( "../bitbot.js" ).log
const Gdax = require('gdax')
const crypto = require('crypto')
const db = require('./Db.js')
const f = require('./Formulas.js')
const fs = require('fs')


var config = require( "../bitbot.js" ).config
if ( config.bot.dynamic_config ){
	// Add a timeout so we're not reading the fs every millisecond
	setInterval( function(){
		config = require( "../bitbot.js" ).config
	}, 500 )
}


var authedClient = null
var authedClient = null
var products = null
var buy_amount = null

// GDAX response object contains:
// _readableState,readable,domain,_events,_eventsCount,_maxListeners,socket,connection,
// httpVersionMajor,httpVersionMinor,httpVersion,complete,headers,rawHeaders,trailers,
// rawTrailers,upgrade,url,method,statusCode,statusMessage,client,_consuming,_dumped,req,
// request,toJSON,caseless,read,body


exports.init = function(){

	//authedClient = new Gdax.authedClient( config.bot.product_id )
	buy_amount = config.bot.buy_amount
	
	
	// Authenticate or die
	try {
		authedClient = new Gdax.AuthenticatedClient( config.api.api_key, config.api.api_secret, config.api.api_passphrase, config.api.api_url )
		authedClient.productID = config.bot.product_id
		log.write( "Connected to GDAX api at " + config.api.api_url )
		
		// Open web socket to gdax
		this.startStream( function( websocket ){})
		
	}
	catch( err ){
		if ( err ){
			log.write( "Problem authenticating with gdax: " + err, "ERROR" )
			process.exit()
		}
	}
}

exports.connect = function( callback ){
	try {
		 var authedClient = new Gdax.AuthenticatedClient( config.api.api_key, config.api.api_secret, config.api.api_passphrase, config.api.api_url )
		 authedClient.productID = config.bot.product_id
		 callback( authedClient )
	}
	catch( err ){
		if ( err ){
			log.write( "Problem connecting to gdax: " + err, "ERROR" )
			process.exit()
		}
	}
}

exports.testMethod = function( callback ){
	authedClient.getProducts( (err, response, data ) => {
		if ( err ){
			log.write( "Problem calling getProductTicker: " + err, "ERROR" ) 
		}
		else {
			callback( data )
		}
	})
}

exports.getHistory = function( params, callback ){
	this.connect( function( client ) {

		client.getProductHistoricRates( params, (err, response, data ) => {
			if ( err ){
				log.write( "Problem calling getProductHistoricalData: " + err, "ERROR" ) 
			}
			else {
				callback( data )
			}
		})
	})
}

exports.buy = function( price, amount, buy_type, callback ){
	
	if( buy_type = "curve" )
		buy_type = "limit"
			
	if ( price == "current" )
		price = ds.stats.ticker.price

	var params = {
			
		"price": parseFloat( price ).toFixed(2),
		"product_id": config.bot.product_id,
		"side": "buy",
		"type": buy_type,
		"post_only": false
	}
	
	if ( buy_type == "limit" || buy_type == "curve" ){
		// Buy at price minus current sink rate
		params.price = parseFloat( price ).toFixed(2)
		params.post_only = true
		params.size = ( parseFloat( amount ) / params.price ).toFixed(8)
	}
	
	if ( buy_type == "market" ){
		params.post_only = null
		params.type = "market"
	}
	
	if ( config.bot.test_mode == true ){
		
		ds.test_order.id = "a100"
		ds.test_order.price = params.price
		ds.test_order.size = params.size
		ds.test_order.product_id = params.product_id
		ds.test_order.side = params.side
		ds.test_order.stp = false
		ds.test_order.type = params.type
		ds.test_order.time_in_force = false
		ds.test_order.post_only = params.post_only
		ds.test_order.fill_fees = 0
		ds.test_order.amount = parseFloat( amount )
		//ds.test_order.filled_size = parseFloat( ( parseFloat( amount ) / parseFloat ( params.price ) ) ).toFixed(8)
		ds.test_order.filled_size = parseFloat( amount ) / parseFloat( price ) 
		ds.test_order.executed_value = parseFloat( amount )
		ds.test_order.status = "pending"
		ds.test_order.settled = "true"
			
		ds.states.last_buy_price = params.price
		
		if ( buy_type == "market" ){
			ds.test_order.fill_fees = parseFloat( config.bot.buy_amount ) * ( parseFloat( config.bot.buy_fee ) / 100 )
			ds.test_order.status = "done"
		}
			
		ds.buy_order = ds.test_order
		//Simulate network latency
		setTimeout( function(){
			callback( ds.test_order )
		}, Math.floor( Math.random() * ( parseFloat( config.api.test_mode_latency_high ) - parseFloat( config.api.test_mode_latency_low ) + 1 ) ) + parseFloat( config.api.test_mode_latency_low ) )

	}
	else {
		// Do the real thing
		authedClient.buy( params, ( err, response, data ) => {
			if ( response.statusCode != 200 ){
				// Error, lets explain it
				log.write( "Problem placing a buy: " + response.statusCode + ": " + ds.status_codes[response.statusCode])
				log.write( response.body )

				ds.states.last_buy_price = parseFloat( price ).toFixed(2)
				callback( false )
			}
			else if( data.id ) {
				
				// Need to inspect the data to validate buy was successful
				
				log.write( "Buy order request completed. Response is: " + response.statusMessage )
				log.write( "                           StatusCode is: " + response.statusCode )
				ds.states.last_buy_price = params.price
				ds.buy_order = data
				//ds.transaction.buy_order_response = response
				callback( data )
			}
		});
	}
}

exports.sell = function( price, coins, buy_type, callback ){
	var data_return = false
	
	if( buy_type == "curve" )
		buy_type = "limit"
			
	if ( price == "current" )
		price = ds.stats.ticker.price
		
	price = parseFloat( price ).toFixed(2)

	var params = {
		//"price": parseFloat( price ).toFixed(2),
		"product_id": config.bot.product_id,
		"side": "sell",
		"type": buy_type,
		"size": coins,
		"post_only": false
	}
	
	if ( buy_type == "limit" ){
		params.price = parseFloat( price ).toFixed(2)
		params.post_only = true
	}

	if ( buy_type == "market" ){
		params.price = null
		params.post_only = null
		params.type = "market"
	}
	
	if ( config.bot.test_mode == true ){
		
		ds.test_order.id = params.product_id
		ds.test_order.price = price
		ds.test_order.size = params.size
		ds.test_order.product_id = params.product_id
		ds.test_order.side = params.side
		ds.test_order.stp = false
		ds.test_order.type = params.type
		ds.test_order.time_in_force = false
		ds.test_order.post_only = params.post_only
		ds.test_order.fill_fees = 0
		ds.test_order.amount = coins
		ds.test_order.filled_size = coins
		ds.test_order.executed_value = ( coins * price )
		ds.test_order.status = "open"
		ds.test_order.settled = "true"
		
		if ( buy_type == "market" ){
			ds.test_order.fill_fees = parseFloat( config.bot.buy_amount ) * ( parseFloat( config.bot.sell_fee ) / 100 )
			ds.test_order.status = "done"
		}
		
		//this.writeOrderToLog( ds.test_order )
		ds.sell_order = ds.test_order
		//ds.sell_orders.unshift( ds.test_order )
		
		//Simulate network latency
		setTimeout( function(){
			callback( ds.test_order )
		}, Math.floor( Math.random() * ( parseFloat( config.api.test_mode_latency_high ) - parseFloat( config.api.test_mode_latency_low ) + 1 ) ) + parseFloat( config.api.test_mode_latency_low ) )
	}
	else {
		authedClient.sell( params, ( err, response, data ) => {
			if ( response.statusCode != 200 ){
				// Error, lets explain it
				log.write( "Problem placing a sell: " + response.statusCode + ": " + ds.status_codes[response.statusCode])
				log.write( response.body )
				ds.states.last_sell_price = params.price
				callback( false )
			}
			else if( data.id ) {
				ds.sell_order = data
				log.write( "Sell order request completed. Response is: " + response.statusMessage )
				log.write( "                           StatusCode is: " + response.statusCode )
				log.write( "sell type: " + buy_type + " | " + params.size )
				//ds.transaction.sell_order_response = response
				callback( data )
			}
		})
	}
}

exports.getOrder = function( id, callback ){
	if ( config.bot.test_mode == true ){
		//Simulate network latency
		setTimeout( function(){
			callback( ds.test_order )
		}, Math.floor( Math.random() * ( parseFloat( config.api.test_mode_latency_high ) - parseFloat( config.api.test_mode_latency_low ) + 1 ) ) + parseFloat( config.api.test_mode_latency_low ) )

	}
	else {
		authedClient.getOrder( id, ( err, response, data ) => {
			if ( err ){
				log.write( "Error looking up gdax order: " + err )
			}
			else {
				//log.write( "Get order successful" )
				ds.status_codes.getOrder_response = response
				//log.write( "Get order request completed. Response is: " + response.statusMessage )
				callback( data )
			}
		})
	}
}

exports.cancelOrder = function( order_id, callback ){
	if ( config.bot.test_mode == true ){
		
		var response = {
				"statusCode": 200,
				"statusMessage": "OK"
		}
		
		if ( ds.buy_order.id == order_id ){
			ds.buy_order = false
		}
		else if ( ds.sell_order == order_id ){
			ds.sell_order = false
		}
		
		
		//Simulate network latency
		setTimeout( function(){
			callback( response )
		}, Math.floor( Math.random() * ( parseFloat( config.api.test_mode_latency_high ) - parseFloat( config.api.test_mode_latency_low ) + 1 ) ) + parseFloat( config.api.test_mode_latency_low ) )

	}
	else {
		authedClient.cancelOrder( order_id, ( err, response, data ) => {
			if( err ){
				log.write( "Error canceling gdax order: " + err )
			}
			else {
				// Responses are:
				// OK
				// Not Found
				
				if ( ds.buy_order.id == order_id ){
					//ds.buy_order = false
				}
				else if ( ds.sell_order.id == order_id ){
					//ds.sell_order = false
				}
				
				log.write( "Cancel order request completed. Response is: " + response.statusMessage )
				log.write( "                              StatusCode is: " + response.statusCode )
				//ds.transaction.cancel_order_response = response
				callback( response )
			}
		})
	}
}

exports.startStream = function( callback ){

	var self = this
	
	if ( ds.gdax.websocket )
		ds.gdax.websocket = null
		
	try {
		
		var connect = function(){
			var _conn = new Gdax.WebsocketClient( 
					[ config.bot.product_id ]
					)
			
			log.write( "Starting gdax websocket..." )
			
			return _conn
		}
			
		// Connect to gdax
		ds.gdax.websocket = connect()
		
		ds.gdax.websocket.on( 'message', data => {
            if ( !fs.existsSync( config.bot.hold_connection_on_file ) )
			    ds.gdax.ticker = data

			// Translate to universal stats
			//
			// Ticker price -- only match
			if ( ds.gdax.ticker.type == "match" && !fs.existsSync( config.bot.hold_connection_on_file ) )
				ds.stats.ticker.price = ds.gdax.ticker.price
		})
		
		// reopen if lost
		ds.gdax.websocket.on( 'close', () => {
			log.write( "Connection closed, re-connecting..." )
			connect()
		})
		
		ds.gdax.websocket.on( 'error', err => {
			log.write( "Error from gdax client: " + err )
			log.write( "Will close and re-connect just in case..." )
			connect()
		})

		self.error()
		
		callback( true )
	}
	catch( err ){
		log.write( "Can't connect to gdax websocket: " + err )
		callback( false )
	}
}

exports.error = function(){
	var self = this
	ds.gdax.websocker.on( 'error', err => {
		// Log error and reconnect
		log.write( "Error with gdax connection, reconnecting" )
		self.startStream( function(){})
	})
}

exports.writeOrderToLog = function( order ){
	log.write( 
			"id: " + order.id + "\n" +
			"price: " + order.price + "\n" +
			"size: " + order.size + "\n" +
			"product_id: " + order.product_id + "\n" +
			"side: " + order.side + "\n" +
			"stp: " + order.stp + "\n" +
			"type: " + order.type + "\n" +
			"time_in_force: " + order.time_in_force + "\n" +
			"post_only: " + order.post_only + "\n" +
			"created_at: " + order.created_at + "\n" +
			"fill_fees: " + order.fill_fees + "\n" +
			"filled_size: " + order.filled_size + "\n" +
			"executed_value: " + order.executed_value + "\n" +
			"status: " + order.status + "\n" +
			"settled: " + order.settled + "\n"		
	)
}

