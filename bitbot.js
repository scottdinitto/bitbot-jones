const fs = require('fs')
const ini = require( 'ini' )

var config = ini.decode( fs.readFileSync( './bitbot.ini', 'utf-8' ) )
exports.config = config
if ( config.bot.dynamic_config ){
	// Add a timeout so we're not reading the fs every millisecond
	setInterval( function(){
		config = ini.decode( fs.readFileSync( './bitbot.ini', 'utf-8' ) )
		exports.config = config
	}, 500 )
}



const log = require('./lib/Logger.js')
exports.log = log

const db = require('./lib/Db.js')
exports.db = db

const ds = require( './lib/DataStructures.js' ).data
const action = require( './lib/Actions.js' )
const trend = require( './lib/Trends.js' )
const display = require( './lib/Display.js' )
const f = require('./lib/Formulas.js')
const gdax = require('./lib/gdaxAPI.js')



// Tracing vars
var history = null

// Data array for holding transactionaction info
var transaction  = ds.transaction


// Start the log
log.start( config.bot.logfile)

f.getDateStamp( function(response){
	log.start_transaction_log( config.bot.transaction_logfile + "-" + response )
})

log.start_stats_log( config.bot.stats_log )

// Connect to db
db.init()

// Open gdax
gdax.init()

// Hack to keep alive every 12 hours
setInterval( function(){
	gdax.init()
}, 3600000 )




// **************************************************
// Startup // initialize  before entering event loop
// ***************************************************
// Clear the screen
display.clear()

// Always set the state to hold when starting
action.setState( 1 )

// Hold all buys while gathering stats
ds.states.buy_hold = true

/*
 * Dynamic Config
 */


// Main Loop Bot will check every poll interval to get data and do orders
setInterval( function(){
ds.test_field = "hold_timer: " +  ds.states.loops.buy_hold_timer + " <= " + ( parseFloat( config.bot.hold_on_bottom_limit ) * 1000 )
	if ( log && db ){
		/*
		 * Get current trend state
		 */
		trend.state()
		
		/*
		 * Run protections
		 */
		protections()
		
		/*
		 * Execute features
		 */
		features()
		
		/*
		 * Take action to buy or sell
		 */
		action.decide()
		
		/*
		 * Buffer the last price
		 */
		trend.setLastPrice()
	
		/*
		 * Display Control
		 */
		display.screen()
	}
})

var features = function( callback ){
	

	
	/*
	 * Dynamic sink rate
	 */
	if ( 
			config.bot.dynamic_sink_rate == true
				&&
			(
					config.bot.buy_type == "limit"
						||
					config.bot.buy_type == "market"
			)
		){
		f.setDynamicSinkRate()
	}
	
	else if ( 
			config.bot.buy_type == "curve"
	){
		f.setDynamicSinkRateCurve()
	}
		
	else {
		f.setSinkRate()
	}
	
	/*
	 * Climb the ladder
	 */
	f.climbTheLadder()
		
		
}

var protections = function( callback ){
	
	/*
	 * Hold buys on conditions
	 */
	action.checkBuyHolds()
	
	/*
	 * Hold sells on conditions
	 */
	action.checkSellHolds()
	
	/*
	 * Cancel on conditions
	 */
	// need to fix bug where drop is so fast, cancel reports successful from gdax
	// but it really fills it instead. perhaps a threshold will help, or details from the response
	action.checkSellOff()
	
	/*
	 *  Detect downslope
	 */
	trend.dropDetection()

	//trend.largeDropDetection()
	
	/*
	 * Spike detection
	 */
	trend.spikeDetection()

	/*
	 * Check for stale buyorders
	 */
	action.monitorOpenBuyOrder()
	
	/*
	 * Check for stuck sale orders
	 */
	action.monitorOpenSellOrder()
	//ds.test_field = ds.states.sell_order_interval
	
	/*
	 * Check for open bought orders
	 */
	action.monitorOpenBought()
	
	/*
	 * Check live profit, sell on stalls
	 */
	action.monitorLiveProfit()
	
	/*
	 * Detect selloffs
	 */
	trend.selloffDetection( function(){} )
	
	/*
	 * Hold on slope rate settings
	 */
	trend.holdOnSlopeRate( function(){} )
	
	/*
	 * Drop recovery
	 */
	action.dropRecovery( function(){} )
}

/*
 * Run every one second
 */
setInterval( function(){
	
	/*
	 * Log the current price
	 */
	trend.priceHistory()
	
	/*
	 * Save a record of trends
	 */
	trend.saveStateHistory()
	
	/*
	 * Spike measurement
	 */
	trend.monitorSpikes()
	
}, 1000 )

/*
 * Run every quarter second
 */
setInterval( function(){
	
	trend.curve()
}, 250)


/*
 * Run every config.bot.slope_interval seconds
 */
setInterval( function(){
	action.getHistory( config.bot.history, config.bot.history_gran )

	//tactical_candle_pos = parseInt( config.bot.tactical_slope_history ) / parseInt( config.bot.tactical_slope_history_gran )
	if ( ds.stats.ticker.price && Array.isArray( ds.stats.ticker.history ) ){
		
		// tactical slope
		
		var history
		var history_pos
		
		// Tactical slope
		history_pos = 15
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos]
			coords = {
				start: {
					x: 0,
					y: history[3]
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.tactical_slope_rate = value
			})
		}
		
		// 1 min slope
		history_pos = 1
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos];
			coords = {
				start: {
					x: 0,
					y: history[3]
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.oneMin_slope_rate = value
			})
		}
		
		// 5 min slope
		history_pos = 5
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos];
			coords = {
				start: {
					x: 0,
					y: history[3]
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.fiveMin_slope_rate = value
			})
		}

		// half hour slope
		history_pos = 29
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos];
			coords = {
				start: {
					x: 0,
					y: history[3] 
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.halfHr_slope_rate = value
			})
		}
		
		// 1 hour slope
		history_pos = 59
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos];
			coords = {
				start: {
					x: 0,
					y: history[3]
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.oneHr_slope_rate = value
			})
		}

		// 2 hour slope
		history_pos = 120
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos];
			coords = {
				start: {
					x: 0,
					y: history[3] 
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.twoHr_slope_rate = value
			})
		}
		
		// 3 hour slope
		history_pos = 180
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos];
			coords = {
				start: {
					x: 0,
					y: history[3] 
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.threeHr_slope_rate = value
			})
		}
		
		// 4 hour slope
		history_pos = 240
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos];
			coords = {
				start: {
					x: 0,
					y: history[3] 
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.fourHr_slope_rate = value
			})
		}
		

		
		
		// last slope
		history_pos = ds.stats.ticker.history.length - 1
		if ( ds.stats.ticker.history[history_pos] ){
			history = ds.stats.ticker.history[history_pos];
			coords = {
				start: {
					x: 0,
					y: history[3]
				},
					
				end: {
					x: ( ds.stats.ticker.price / config.bot.slope_scale_factor ),
					y: ds.stats.ticker.price
				}
			}
			
			f.getSlopeRate( coords, function( value ){
				ds.stats.last_slope_rate = value
			})
		}
		
		// Calculate slope rates
		ds.stats.total_slope_rate = ( (
				parseFloat( ds.stats.oneMin_slope_rate )
					+
				parseFloat( ds.stats.fiveMin_slope_rate )
					+
				parseFloat( ds.stats.tactical_slope_rate )
				+
				parseFloat( ds.stats.oneHr_slope_rate )
					+
				( parseFloat( ds.stats.fourHr_slope_rate ) / 2 )
					+
				( parseFloat( ds.stats.last_slope_rate ) / 4 )
		) / 6 ).toFixed(1)
		
		ds.stats.avg_slope_rate = ( (	
				parseFloat( ds.stats.oneHr_slope_rate ) + 
				parseFloat( ds.stats.twoHr_slope_rate ) + 
				parseFloat( ds.stats.threeHr_slope_rate ) + 
				parseFloat( ds.stats.fourHr_slope_rate )
			) / 4 ).toFixed(1)
			
		ds.stats.fourHr_avg_slope_rate = ds.stats.avg_slope_rate
		
		ds.stats.oneHr_avg_slope_rate = ( (	
				parseFloat( ds.stats.halfHr_slope_rate ) + 
				parseFloat( ds.stats.oneHr_slope_rate ) 
			) / 2 ).toFixed(1)
			
		ds.stats.twoHr_avg_slope_rate = ( (	
				parseFloat( ds.stats.oneHr_slope_rate ) + 
				parseFloat( ds.stats.twoHr_slope_rate ) 
			) / 2 ).toFixed(1)
			
		ds.stats.threeHr_avg_slope_rate = ( (	
				parseFloat( ds.stats.oneHr_slope_rate ) + 
				parseFloat( ds.stats.twoHr_slope_rate ) +
				parseFloat( ds.stats.threeHr_slope_rate ) 
			) / 3 ).toFixed(1)
			
		//console.log( "\n\n\n\n: " + ds.stats.ticker.history.length )
		//console.log( "\n\n\n\nprev: " + history[3] + " ( " + new Date( parseFloat( history[0] ) * 1000 ) + " ) ( " +  Date( Date.now() ) + " ) | " + ds.stats.ticker.price )
	}

}, ds.trend.slope_interval )


//gdax.testMethod( function(data){
//	console.log(data)
//})
