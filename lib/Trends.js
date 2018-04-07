const ds = require( './DataStructures.js' ).data
const log = require( "../bitbot.js" ).log
const formulas = require('./Formulas.js')
const db = require('./Db.js')
const action = require('./Actions.js')

var config = require( "../bitbot.js" ).config
if ( config.bot.dynamic_config ){
	// Add a timeout so we're not reading the fs every millisecond
	setInterval( function(){
		config = require( "../bitbot.js" ).config
	}, 500 )
}



exports.state = function(){
	
	// Get the sink rate
	formulas.getSinkRatePrice( function( sinkrate ){ 
		if( sinkrate ){
			ds.stats.sinkrate_price = sinkrate
		}
	})
	
	// Get the trend margin. This is the difference between
	// the current price and the last price. 
	if ( ds.stats.ticker.price && ds.trend.last_price ){
		ds.trend.margin = Math.abs( parseFloat( ds.stats.ticker.price ) - parseFloat( ds.trend.last_price ) )
	}
	else {
		ds.trend.margin = 0
	}

	// Ensure flaps are only at max levels
	if ( ds.trend.flap.up > ds.trend.threshold )
		ds.trend.flap.up = ds.trend.threshold
		
	if ( ds.trend.flap.down > ds.trend.threshold )
		ds.trend.flap.down = ds.trend.threshold	
	
	try {
		if ( ds.stats.ticker.price > ds.trend.last_price ){
			
			// Increase flap, negate other size
			if ( ds.trend.flap.up <  ds.trend.threshold ){
				ds.trend.flap.up++
				ds.trend.flap.down = 0
			}

			
			// Set the upchange/downchange. This holds the amount of change in price
			// While in this state. Goes to zero once the state flips. Upchange/downchange is used 
			// to help determine a threshold for when to set an up or down state, so it does not bounce
			// back and forth too erratically
			ds.trend.upchange = ds.trend.upchange + ds.trend.margin
			ds.trend.downchange = ds.trend.downchange - ds.trend.margin
			
			// Set the max uptick. The max uptick is used to determine the highest amount the upchange
			// is allowed to get to. This is a percentage of the ticker price
			ds.trend.max_uptick = ( ds.stats.ticker.price * config.bot.pct_change_threshold )
			if ( ds.trend.upchange >  ds.trend.max_uptick ) ds.trend.upchange = ds.trend.max_uptick
			
			// If the downchange goes into negative numbers, just reset to 0 to keep it flat
			if ( ds.trend.downchange < 0 ) ds.trend.downchange = 0
			
			
			// Set the upchange/downchange totals. This ignores the max_uptick and tracks 
			// the change over time. Not used for setting state, but for helping to decide
			// buys/sells
			ds.trend.upchange_total = ds.trend.upchange_total + ds.trend.margin
			ds.trend.downchange_total = ds.trend.downchange_total - ds.trend.margin
			if ( ds.trend.downchange_total < 0 ) ds.trend.downchange_total = 0
			
			// Reset the downchange, if the upchange is greater than the buy threshold
			if ( ( ds.trend.downchange_total > ds.transaction.buy_threshold ) && ds.trend.state == 1 ){
				ds.trend.downchange_total = ds.trend.downchange_total - ds.transaction.buy_threshold
			}
		}
		if ( ds.stats.ticker.price < ds.trend.last_price ){
			
			if ( ds.trend.flap.down < ds.trend.threshold ){
				ds.trend.flap.down++
				ds.trend.flap.up = 0
			}

			
			// Set trend changes detectors
			ds.trend.downchange = ds.trend.downchange + ds.trend.margin
			ds.trend.upchange = ds.trend.upchange - ds.trend.margin
			
			ds.trend.max_downtick = ( ds.stats.ticker.price * config.bot.pct_change_threshold )
			if ( ds.trend.downchange >  ds.trend.max_downtick ) ds.trend.downchange = ds.trend.max_downtick
			if ( ds.trend.upchange < 0 ) ds.trend.upchange = 0
			
			// Set the total trend values
			ds.trend.downchange_total = ds.trend.downchange_total + ds.trend.margin
			ds.trend.upchange_total = ds.trend.upchange_total - ds.trend.margin
			if ( ds.trend.upchange_total < 0 ) ds.trend.upchange_total = 0
		}
	
		this.setTrendState()
	}
	catch( err ){
		log.write( "Error setting up/down trend: " + err )
	}
}

exports.setTrendState = function(){
	if ( ds.trend.upchange > ds.trend.downchange && ds.trend.flap.up >= ds.trend.threshold ){
		ds.trend.state = 1
		
	}
	
	if ( ds.trend.upchange < ds.trend.downchange && ds.trend.flap.down >= ds.trend.threshold ){
		ds.trend.state = 2
		
	}
}

exports.setLastPrice = function(){
	ds.trend.last_price = ds.stats.ticker.price
}

/*
 * Price Log
 * 
 * Log the price to an array every second. Only allow config.bot.price_history_seconds elements to exist.
 */
exports.priceHistory = function( callback ){
	if ( ds.stats.ticker.price ){
		ds.trend.price_history.unshift( ds.stats.ticker.price )
	}
	
	// Remove last element if array is over config.bot.price_history_seconds elements
	if ( ds.trend.price_history.length > config.bot.price_history_seconds ){
		ds.trend.price_history.splice( -1, 1 )
	}
}

/*
 * Save Trend History
 */
exports.saveStateHistory = function( callback ){
	if ( ds.states_history ){
		
		ds.states_history.unshift( ds.states )
		
		if ( ds.states_history.length > 200 ){
			ds.states_history.splice( -1, 2 )
		}
	}
}

/*
 * Detect a drop
 */
exports.dropDetection = function( callback ){
	// We need to make sure config.bot.drop_detection_history is checked
	if ( config.bot.drop_detection_history && config.bot.large_drop_detection_history ){
		
		start_price = null
		var end_price = null
		
		if ( ds.stats.ticker.price )
			start_price = ds.stats.ticker.price
			
		if ( ds.trend.price_history[config.bot.drop_detection_history] ){
			end_price = ds.trend.price_history[config.bot.drop_detection_history]
		}
		else if ( ds.trend.price_history[ ds.trend.price_history.length - 1 ] ){
			end_price = ds.trend.price_history[ ds.trend.price_history.length - 1 ]
		}
		
		if ( ds.trend.price_history[config.bot.large_drop_detection_history] ){
			large_end_price = ds.trend.price_history[config.bot.large_drop_detection_history]
		}
		else if ( ds.trend.price_history[ ds.trend.price_history.length - 1 ] ){
			large_end_price = ds.trend.price_history[ ds.trend.price_history.length - 1 ]
		}
		
		if ( start_price && end_price && large_end_price ){
			
			
			var drop_price = ( parseFloat( start_price ) * ( config.bot.drop_detection_threshold / 100 ) )
			var large_drop_price = ( parseFloat( start_price ) * ( config.bot.large_drop_detection_threshold / 100 ) )
			
			for ( var index = 0; index < config.bot.drop_detection_history; index++ ){
				if ( ds.trend.price_history[index] ){
					
					if ( start_price < ds.trend.price_history[index] ){
						
						// Technical drop, let's see if meets our thresholds for alarms
						var price_difference = parseFloat( ds.trend.price_history[index] - parseFloat( start_price ) )
//						ds.test_field = price_difference + " > " + drop_price
						if ( price_difference > drop_price ){
							ds.states.alarms.drop_detection = true
							ds.states.alarms.spike_detection = false
						}
						else {
							ds.states.alarms.drop_detection = false
						}
					}
					else {
						ds.states.alarms.drop_detection = false
						ds.states.alarms.large_drop_detection = false
					}
				}
			}
			
			for ( var index = 0; index < config.bot.large_drop_detection_history; index++ ){
				if ( ds.trend.price_history[index] ){
					
					if ( start_price < ds.trend.price_history[index] ){
						
						// Technical drop, let's see if meets our thresholds for alarms
						var price_difference = parseFloat( ds.trend.price_history[index] - parseFloat( start_price ) )
						//ds.test_field = price_difference + " > " + large_drop_price
						
						if ( price_difference > large_drop_price ){
							ds.states.alarms.drop_detection = false
							ds.states.alarms.large_drop_detection = true
							ds.states.alarms.spike_detection = false
							ds.states.alarms.large_spike_detection = false
						}
					}
					else {
						ds.states.alarms.large_drop_detection = false
					}
				}
			}
		}
	}
}

/*
 * Detect spikes
 */
exports.spikeDetection = function( callback ){
	// We need to make sure config.bot.spike_detection_history is checked
	if ( config.bot.spike_detection_history && config.bot.large_spike_detection_history ){
		
		start_price = null
		var end_price = null
		
		if ( ds.stats.ticker.price )
			start_price = ds.stats.ticker.price
			
		if ( ds.trend.price_history[config.bot.spike_detection_history] ){
			end_price = ds.trend.price_history[config.bot.spike_detection_history]
		}
		else if ( ds.trend.price_history[ ds.trend.price_history.length - 1 ] ){
			end_price = ds.trend.price_history[ ds.trend.price_history.length - 1 ]
		}
		
		if ( ds.trend.price_history[config.bot.large_spike_detection_history] ){
			large_end_price = ds.trend.price_history[config.bot.large_spike_detection_history]
		}
		else if ( ds.trend.price_history[ ds.trend.price_history.length - 1 ] ){
			large_end_price = ds.trend.price_history[ ds.trend.price_history.length - 1 ]
		}
		
		if ( start_price && end_price && large_end_price ){
			
			var spike_price = ( parseFloat( start_price ) * ( config.bot.spike_detection_threshold / 100 ) )
			var large_spike_price = ( parseFloat( start_price ) * ( config.bot.large_spike_detection_threshold / 100 ) )
			
			for ( var index = 0; index < config.bot.spike_detection_history; index++ ){
				if ( ds.trend.price_history[index] ){
					
					if ( start_price > ds.trend.price_history[index] ){
						
						// Technical drop, let's see if meets our thresholds for alarms
						var price_difference = parseFloat( parseFloat( start_price ) - ds.trend.price_history[index] )
//						ds.test_field = price_difference + " > " + spike_price
						if ( price_difference > spike_price ){
							ds.states.alarms.spike_detection = true
							ds.states.alarms.drop_detection = false
						}
						else {
							ds.states.alarms.spike_detection = false
						}
					}
					else {
						ds.states.alarms.spike_detection = false
						ds.states.alarms.large_spike_detection = false
					}
				}
			}

			for ( var index = 0; index < config.bot.large_spike_detection_history; index++ ){
				if ( ds.trend.price_history[index] ){
					
					if ( start_price > ds.trend.price_history[index] ){
						
						// Technical drop, let's see if meets our thresholds for alarms
						var price_difference = parseFloat( parseFloat( start_price ) - ds.trend.price_history[index] )
						//ds.test_field = price_difference + " > " + large_spike_price
						
						if ( price_difference > large_spike_price ){
							ds.states.alarms.spike_detection = false
							ds.states.alarms.large_spike_detection = true
							ds.states.alarms.drop_detection = false
							ds.states.large_drop_detection = false
						}
					}
					else {
						ds.states.alarms.large_spike_detection = false
					}
				}
			}			
		}
	}
}

/*
 * Look into detecting large drops and increasing the trend gap, to avoiid buying to soon
 */
exports.largeDropDetection = function( callback ){
	// Check the tactical trend slope is greater than slope threshold for drops
	// Check the total price drop is greater than the percent threshold for a drop
	if ( 
			parseFloat ( ds.stats.oneMin_slope_rate ) > parseFloat( config.bot.drop_detection_over_slope )
	){
		ds.states.alarms.large_drop_detection = false
	}
	else if ( 
			parseFloat ( ds.stats.fiveMin_slope_rate ) < parseFloat( config.bot.drop_detection_slope )
	){
		ds.states.alarms.large_drop_detection = true
	}
}

exports.largeDropDetectionActions = function(){
	
}

exports.largeSpikeDetectionActions = function(){
	
}

exports.getTrendFromRecentPrice = function( price ){
	
	return price
}

exports.monitorSpikes = function(){
	if ( ds.states.alarms.spike_detection && ds.states.loops.spike_detection == false ){
		ds.states.loops.spike_detection = true
		ds.trend.volatility.spike++
		
		ds.trend.volatility.drop--
		ds.trend.volatility.large_drop--
		
		if ( ds.trend.volatility.drop < 0 )
			ds.trend.volatility.drop = 0
			
		if ( ds.trend.volatility.large_drop < 0 )
			ds.trend.volatility.large_drop = 0
	}
	else if ( !ds.states.alarms.spike_detection ){
		ds.states.loops.spike_detection =false
	}
	
	if ( ds.states.alarms.large_spike_detection && ds.states.loops.large_spike_detection == false ){
		ds.states.loops.large_spike_detection = true
		ds.trend.volatility.large_spike++
		
		ds.trend.volatility.drop--
		ds.trend.volatility.large_drop--
		
		if ( ds.trend.volatility.drop < 0 )
			ds.trend.volatility.drop = 0
			
		if ( ds.trend.volatility.large_drop < 0 )
			ds.trend.volatility.large_drop = 0
	}
	else if ( !ds.states.alarms.large_spike_detection ){
		ds.states.loops.large_spike_detection =false
	}
	
	if ( ds.states.alarms.drop_detection && ds.states.loops.drop_detection == false ){
		ds.states.loops.drop_detection = true
		ds.trend.volatility.drop++
		
		ds.trend.volatility.spike--
		ds.trend.volatility.large_spike--
		
		if ( ds.trend.volatility.spike < 0 )
			ds.trend.volatility.spike = 0
			
		if ( ds.trend.volatility.large_spike < 0 )
			ds.trend.volatility.large_spike = 0
	}
	else if ( !ds.states.alarms.drop_detection ){
		ds.states.loops.drop_detection =false
	}

	if ( ds.states.alarms.large_drop_detection && ds.states.loops.large_drop_detection == false ){
		ds.states.loops.large_drop_detection = true
		ds.trend.volatility.large_drop++
		
		ds.trend.volatility.spike--
		ds.trend.volatility.large_spike--
		
		if ( ds.trend.volatility.spike < 0 )
			ds.trend.volatility.spike = 0
			
		if ( ds.trend.volatility.large_spike < 0 )
			ds.trend.volatility.large_spike = 0
	}
	else if ( !ds.states.alarms.large_drop_detection ){
		ds.states.loops.large_drop_detection =false
	}
	
	//ds.test_field = "[" + ds.trend.volatility.large_drop + "] Large Drop | [" + ds.trend.volatility.drop + "] Drop  ||  Spike [" + ds.trend.volatility.spike + "] | Large Spike [" + ds.trend.volatility.large_spike + "]"    
}

exports.curve = function( callback ){
	
	if ( ds.trend.curves.price_peak < 1 ){
		ds.trend.curves.price_peak = ds.stats.ticker.price
	}
	
	if ( ds.trend.curves.price_bottom < 1 ){
		ds.trend.curves.price_bottom = ds.stats.ticker.price
	}
	
	if ( ds.stats.ticker.price > ds.trend.curves.price_peak ) {
		ds.trend.curves.price_peak = ds.stats.ticker.price
		ds.states.curves.dropping = false
	}
	
	if ( ds.stats.ticker.price < ds.trend.curves.price_bottom ) {
		ds.trend.curves.price_bottom = ds.stats.ticker.price
		ds.states.curves.rising = false
	}
	
	//ds.test_field = ds.states.curves.dropping + " | " + ds.states.curves.rising
	
	this.curveDrop()
	this.curveRise()
	
	ds.trend.curves.last_price = ds.stats.ticker.price
}

exports.curveDrop = function( callback ){
	
	var self = this
	//ds.test_field = ( parseFloat( ds.trend.curves.price_peak ) - parseFloat( ds.stats.ticker.price ) ) + " > " + ( parseFloat( ds.trend.curves.price_peak ) * parseFloat( config.bot.curve_warning_drop_threshold ) )
	//ds.test_field = ds.trend.curves.last_price
	//ds.test_field = ds.states.curves.dropping
	
	// if price falls more than x (.001)% of the price_peak, then go to DROP WARNING
	if ( 
			!ds.states.curves.dropping
				&&
			!ds.states.curves.rising
				&&
			( parseFloat( ds.trend.curves.last_price ) - parseFloat( ds.stats.ticker.price ) )
				>
			( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_warning_drop_threshold ) / 100 ) )
			
	){
		ds.states.curves.dropping = true
		ds.states.alarms.drop_warning = true
		ds.trend.curves.price_bottom = ds.stats.ticker.price
		ds.states.alarms.peak_reached = false
		this.clearPeaks()
	}
	
	else if ( ds.states.curves.dropping ){
		
		// Add price to our counter
		ds.trend.curves.price_history.unshift( ds.stats.ticker.price )
		
		// if price ever goes over peak_price,  nullify DROP WARNING and reset dropping flag
		if ( parseFloat( ds.stats.ticker.price ) > parseFloat( ds.trend.curves.price_peak ) ){
			//this.clearDrops( ds.stats.ticker.price )
			
			ds.trend.curves.price_peak = 0
			ds.trend.curves.last_price_bottom = ds.trend.curves.price_bottom
			ds.trend.curves.price_bottom = 0
			ds.trend.curves.price_history = []
			ds.states.curves.dropping = false
		}
		
//		else if ( 
//				parseFloat( ds.stats.ticker.price )
//					>
//				parseFloat( ds.trend.curves.price_bottom ) + ( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_warning_drop_threshold ) / 100 ) )
//
//		){
//			ds.states.curves.rising = true
//			ds.states.alarms.rise_warning = true
//			ds.states.curves.dropping = false
//			ds.trend.curves.price_peak = 0
//			
//			ds.states.alarms.drop_warning = false
//			ds.states.alarms.drop_started = false
//			ds.states.alarms.dropping = false
//			ds.states.alarms.bottom_close = false
//			ds.states.alarms.bottom_reached = false
//		}
		
		else {
			var price_history_count = ds.trend.curves.price_history.length
			
			//ds.test_field = ds.states.alarms.drop_warning + " && " + price_history_count > 4			
			//	Every lower price should be recorded as the bottom_price
			if ( parseFloat( ds.stats.ticker.price ) < parseFloat( ds.trend.curves.price_bottom ) ){
				ds.trend.curves.price_bottom = ds.stats.ticker.price
			}  
			
			//	While in DROP WARNING, start checking price history over last second. If price drops x (.0005)% within that second, set DROP STARTED. Nullify DROP WARNING, CLIMBING, CLIMB STARTED PEAK CLOSE, PEAK REACHED and climbing flag.
			else if ( ds.states.alarms.drop_warning && price_history_count > 4 ){
				for ( i = 0; i <= 4; i++ ){
					
					//ds.test_field = parseFloat( ds.trend.curves.price_history[i] ) + " | " + ( parseFloat( ds.trend.curves.price_history[i] ) - parseFloat( ds.stats.ticker.price ) ) + " > " + ( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_started_drop_threshold ) / 100 ) )
					//ds.test_field = parseFloat( ds.trend.curves.price_history[i] ) + " - " + parseFloat( ds.stats.ticker.price )
					if ( 
							( parseFloat( ds.trend.curves.price_history[i] ) - parseFloat( ds.stats.ticker.price ) )
								>
							( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_started_drop_threshold ) / 100 ) )
					){
						ds.states.alarms.drop_warning = false
						ds.states.alarms.drop_started = true
					}
				}
			}
			
			// While in DROP STARTED, if price drops more than x (.002)% from price_peak, 
			// then set DROPPING and nullify DROP STARTED.
			else if ( 
						ds.states.alarms.drop_started
							&&
						( parseFloat( ds.trend.curves.price_peak ) - parseFloat( ds.stats.ticker.price ) )
							>
						( parseFloat( ds.trend.curves.price_peak ) * ( parseFloat( config.bot.curve_dropping_drop_threshold ) / 100 ) )
			){
				ds.states.alarms.drop_started = false
				ds.states.alarms.dropping = true
			}
			
			//	if price stays within x (.0002)% of the last price for x (20) seconds then predict BOTTOM CLOSE
			else if ( 
					(
							ds.states.alarms.dropping
								||
							ds.states.alarms.drop_started
					)
						&&
					price_history_count > ( parseFloat( config.bot.curve_close_drop_history ) * 4 )
			){
				for ( i = 0; i <= ( parseFloat( config.bot.curve_close_drop_history ) * 4 ); i++ ){
					if ( 
							( parseFloat( ds.trend.curves.price_history[i] ) - parseFloat( ds.stats.ticker.price ) )
								<
							( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_close_drop_threshold ) / 100 ) )
					){
						//ds.states.alarms.dropping = false
						ds.states.alarms.dropping = false
						ds.states.alarms.drop_started = false
						ds.states.alarms.bottom_close = true
					}
				}
				
//				// If price ever goes above 1/2 the peak price, reset
				if ( parseFloat( ds.stats.ticker.price ) > ( parseFloat( ds.trend.curves.price_peak ) / 2 ) ){
					//this.clearDrops( ds.stats.ticker.price )
					
					ds.states.alarms.bottom_reached = true
				}
			} 
			
			//	if price stays within x (.0002)% of the bottom_price for x (120) seconds, predict BOTTOM REACHED . flag last_bottom_price. and last_peak_price. nullify BOTTOM CLOSE, DROPPING
			else if ( 
					ds.states.alarms.bottom_close
						&&
					price_history_count > ( parseFloat( config.bot.curve_reached_drop_history ) * 4 )
			){
				
				
				// revert state if price changes
				var bottom_closed = function(){
					self.clearDrops()
					self.addDrop()
					ds.states.alarms.bottom_reached = true
					//ds.trend.curves.price_peak = 0
					ds.trend.curves.last_price_bottom = ds.trend.curves.price_bottom
					ds.trend.curves.price_bottom = 0
					ds.trend.curves.price_history = []
				}
				
				var bottom_price_margin = parseFloat( ds.trend.curves.price_bottom ) * ( parseFloat( config.bot.curve_reached_drop_threshold ) / 100 )				
				for ( i = 0; i <= ( parseFloat( config.bot.curve_reached_drop_history ) * 4 ); i++ ){
					if ( 
							parseFloat( ds.trend.curves.price_history[i] )
								>
							parseFloat( ds.stats.ticker.price ) - bottom_price_margin
					){
						bottom_closed()
					}
				}

				bottom_closed()
			}
			
			else {
				//this.clearDrops( ds.trend.curves.price_peak )
			}
			
			//	if in DROP STARTED or DROPPING, and if current_price rises above peak_price / 2, then set BOTTOM REACHED. nullify DROP STARTED and DROPPING
	
		}
	}
	
	else {
		ds.states.curves.dropping = false
		ds.states.alarms.drop_warning = false
	}
	
	
}

exports.curveRise = function( callback ){
	
	var self = this 
	//ds.test_field = (  parseFloat( ds.stats.ticker.price ) - parseFloat( ds.trend.curves.last_price ) ) + " > " + ( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_warning_peak_threshold ) / 100 ) )	
	//ds.test_field = ds.trend.curves.last_price
	//ds.test_field = ds.states.curves.rising
	
	// if price falls more than x (.001)% of the price_peak, then go to DROP WARNING
	if ( 
			!ds.states.curves.dropping
				&&
			!ds.states.curves.rising
				&&
			(  parseFloat( ds.stats.ticker.price ) - parseFloat( ds.trend.curves.last_price ) )
				>
			( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_warning_peak_threshold ) / 100 ) )
			
	){
		ds.states.curves.rising = true
		ds.states.alarms.rise_warning = true
		ds.trend.curves.price_peak = ds.stats.ticker.price
		ds.states.alarms.bottom_reached = false
		this.clearDrops()
	}
	
	else if ( ds.states.curves.rising ){
		
		// Add price to our counter
		ds.trend.curves.price_history.unshift( ds.stats.ticker.price )
		
		// if price ever goes under bottom_price,  nullify RISE WARNING and reset dropping flag
		if ( parseFloat( ds.stats.ticker.price ) < parseFloat( ds.trend.curves.price_bottom ) ){
			//this.clearDrops( ds.stats.ticker.price )
			ds.trend.curves.last_price_peak = ds.trend.curves.price_peak
			ds.trend.curves.price_peak = 0
			ds.trend.curves.price_bottom = 0
			ds.trend.curves.price_history = []
			ds.states.curves.rising = false
		}
		
//		else if ( 
//				parseFloat( ds.stats.ticker.price )
//					<
//				parseFloat( ds.trend.curves.price_peak ) - ( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_warning_peak_threshold ) / 100 ) )
//		){
//			ds.states.curves.dropping = true
//			ds.states.alarms.drop_warning = true
//			ds.states.curves.rising = false
//			ds.trend.curves.price_bottom = 0
//			
//			ds.states.alarms.rise_warning = false
//			ds.states.alarms.rise_started = false
//			ds.states.alarms.rising = false
//			ds.states.alarms.peak_close = false
//			ds.states.alarms.peak_reached = false
//		}
		
		else {
			var price_history_count = ds.trend.curves.price_history.length
			
			//ds.test_field = ds.states.alarms.rise_warning + " && " + price_history_count > 4			
			//	Every lower price should be recorded as the bottom_price
			if ( parseFloat( ds.stats.ticker.price ) > parseFloat( ds.trend.curves.price_peak ) ){
				ds.trend.curves.price_peak = ds.stats.ticker.price
			}  
			
			
			//	While in RISE WARNING, start checking price history over last second. If price rises x (.0005)% within that second, set RISE STARTED. Nullify RISE WARNING, CLIMBING, CLIMB STARTED PEAK CLOSE, PEAK REACHED and climbing flag.
			else if ( ds.states.alarms.rise_warning && price_history_count > 4 ){
				for ( i = 0; i <= 4; i++ ){
					
					//ds.test_field = parseFloat( ds.trend.curves.price_history[i] ) + " | " + ( parseFloat( ds.trend.curves.price_history[i] ) - parseFloat( ds.stats.ticker.price ) ) + " > " + ( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_started_peak_threshold ) / 100 ) )
					//ds.test_field = parseFloat( ds.trend.curves.price_history[i] ) + " - " + parseFloat( ds.stats.ticker.price )
					if ( 
							( parseFloat( ds.stats.ticker.price ) - parseFloat( ds.trend.curves.price_history[i] ) )
								>
							( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_started_peak_threshold ) / 100 ) )
					){
						ds.states.alarms.rise_warning = false
						ds.states.alarms.rise_started = true
					}
				}
			}
			
			// While in RISE STARTED, if price rises more than x (.002)% from price_bottom, 
			// then set RISING and nullify RISE STARTED.
			else if ( 
						ds.states.alarms.rise_started
							&&
						( parseFloat( ds.stats.ticker.price ) - parseFloat( ds.trend.curves.price_bottom ) )
							>
						( parseFloat( ds.trend.curves.price_bottom ) * ( parseFloat( config.bot.curve_dropping_peak_threshold ) / 100 ) )
			){
				ds.states.alarms.rise_started = false
				ds.states.alarms.rising = true
			}
			
			//	if price stays within x (.0002)% of the last price for x (20) seconds then predict BOTTOM CLOSE
			else if ( 
					(
							ds.states.alarms.rising
								||
							ds.states.alarms.rise_started
					)
						&&
					price_history_count > ( parseFloat( config.bot.curve_close_peak_history ) * 4 )
			){
				for ( i = 0; i <= ( parseFloat( config.bot.curve_close_peak_history ) * 4 ); i++ ){
					if ( 
							( parseFloat( ds.stats.ticker.price ) - parseFloat( ds.trend.curves.price_history[i] ) )
								>
							( parseFloat( ds.trend.curves.last_price ) * ( parseFloat( config.bot.curve_close_peak_threshold ) / 100 ) )
					){
						//ds.states.alarms.dropping = false
						ds.states.alarms.rising = false
						ds.states.alarms.rise_started = false
						ds.states.alarms.peak_close = true
						//ds.test_field = "here"
					}
				}
				
//				// If price ever goes above 1/2 the peak price, reset
				if ( parseFloat( ds.stats.ticker.price ) < ( parseFloat( ds.trend.curves.price_bottom ) / 2 ) ){
					//this.clearDrops( ds.stats.ticker.price )
					
					ds.states.alarms.peak_reached = true
				}
			} 
			
			//	if price stays within x (.0002)% of the bottom_price for x (120) seconds, predict BOTTOM REACHED . flag last_bottom_price. and last_peak_price. nullify BOTTOM CLOSE, DROPPING
			else if ( 
					ds.states.alarms.peak_close
						&&
					price_history_count > ( parseFloat( config.bot.curve_reached_peak_history ) * 4 )
			){
				
				var peak_closed = function(){
					self.clearPeaks()
					self.addPeak()
					ds.states.alarms.peak_reached = true
					ds.trend.curves.last_price_peak = ds.trend.curves.price_peak
					ds.trend.curves.price_peak = 0
					//ds.trend.curves.price_bottom = 0
					ds.trend.curves.price_history = []
				}
				// revert state if price changes 
				var peak_price_margin = parseFloat( ds.trend.curves.price_peak ) * ( parseFloat( config.bot.curve_reached_peak_threshold ) / 100 )				
				for ( i = 0; i <= ( parseFloat( config.bot.curve_reached_peak_history ) * 4 ); i++ ){
					if ( 
							parseFloat( ds.trend.curves.price_history[i] )
								<
							parseFloat( ds.stats.ticker.price ) - peak_price_margin
					){
						peak_closed()
					}
				}
				
				peak_closed()
			}
			
			else {
				//this.clearDrops( ds.trend.curves.price_peak )
			}
			
			//	if in DROP STARTED or DROPPING, and if current_price rises above peak_price / 2, then set BOTTOM REACHED. nullify DROP STARTED and DROPPING
	
		}
	}
	
	else {
		ds.states.curves.rising = false
		ds.states.alarms.rise_warning = false
	}
	
	//ds.trend.curves.last_price = ds.stats.ticker.price
}

exports.clearDrops = function( callback ){
	ds.states.curves.dropping = false
	ds.states.alarms.drop_warning = false
	ds.states.alarms.drop_started = false
	ds.states.alarms.dropping = false
	ds.states.alarms.bottom_close = false
	ds.states.alarms.bottom_reached = false
}

exports.addDrop = function( callback ){
	ds.trend.curves.bottoms.unshift( ds.trend.curves.price_bottom )
	
	// Clean array if too large
	if ( parseFloat( ds.trend.curves.bottoms.length ) > parseFloat( config.bot.curve_history_peak_limits ) ){
		ds.trend.curves.bottoms.splice( -1, 1 )
	}
}

exports.clearPeaks = function( callback ){
	ds.states.curves.rising = false
	ds.states.alarms.rise_warning = false
	ds.states.alarms.rise_started = false
	ds.states.alarms.rising = false
	ds.states.alarms.peak_close = false
	ds.states.alarms.peak_reached = false
}

exports.addPeak = function( callback ){
	ds.trend.curves.peaks.unshift( ds.trend.curves.price_peak )
	
	if ( parseFloat( ds.trend.curves.peaks.length ) > parseFloat( config.bot.curve_history_peak_limits ) ){
		ds.trend.curves.peaks.splice( -1, 1 )
	}
}

exports.selloffDetection = function( callback ){

	if ( 
			(
				ds.stats.oneHr_slope_rate < parseFloat( config.bot.oneHr_selloff_factor )
					||
				ds.stats.tactical_slope_rate < parseFloat( config.bot.tactical_slope_selloff_factor )
			)
			
				&&
			
			config.bot.selloff_recovery_type == "slope"
	){
		ds.states.alarms.selloff = true
		ds.states.loops.selloff_recover_post_wait_trigger = true
	}
	else {
		ds.states.alarms.selloff = false
	}
	
	callback( true )
}

exports.holdOnSlopeRate = function( callback ){
	
	this.detectSlopeRate( function(){} )
	
	if ( config.bot.hold_on_slope_rate_type == "sides" ){
		callback( this.holdOnSlopeRateSides( function(){} ) )
	}
	else {
		callback( this.holdOnSlopeRateWindow( function(){} ) )
	}
	
	callback( true )
}

exports.detectSlopeRate = function( callback ){
	var topOrBottom = function top_or_bottom(){
		if ( ds.states.slope_type == "up" ){
			ds.states.slope_type = "top"
		}
		
		else if ( ds.states.slope_type == "down" ){
			ds.states.slope_type = "bottom"
			
			// Hold buys for config.bot.hold_on_bottom_limit seconds
			if ( !ds.states.loops.buy_hold ){
				action.buy_hold( config.bot.hold_on_bottom_limit, function(){} )
			}
		}
	}
	
	if (
			(	
				parseFloat( ds.stats.oneMin_slope_rate ) < parseFloat( config.bot.slope_1min ) 
					&&
				parseFloat( ds.stats.fiveMin_slope_rate ) < parseFloat( config.bot.slope_5min )
					&&
				parseFloat( ds.stats.tactical_slope_rate ) < parseFloat( config.bot.slope_15min )
					&&
				parseFloat( ds.stats.halfHr_slope_rate ) < parseFloat( config.bot.slope_30min )
			)
	){
			ds.states.slope_rate_under = true
			ds.states.slope_type = "down"
	}
	else {
		ds.states.slope_rate_under = false
	}
				
	if
	(
			(
				parseFloat( ds.stats.oneMin_slope_rate ) > parseFloat( config.bot.slope_1min_over ) 
					&&
				parseFloat( ds.stats.fiveMin_slope_rate ) > parseFloat( config.bot.slope_5min_over )
					&&
				parseFloat( ds.stats.tactical_slope_rate ) > parseFloat( config.bot.slope_15min_over )
					&&
				parseFloat( ds.stats.halfHr_slope_rate ) > parseFloat( config.bot.slope_30min_over )
			)
	){
			ds.states.slope_rate_over = true
			ds.states.slope_type = "up"
			
			// Temp timer to hold when at the bottom 
			if ( 
					config.bot.hold_on_slope_rate
						&&
					ds.states.loops.buy_hold_timer > 0
						&&
					ds.states.loops.buy_hold_timer <= ( parseFloat( config.bot.hold_on_bottom_limit ) * 1000 )
			){
				action.cancel_buy_hold( function(){} )
			}
	}
	else {
		ds.states.slope_rate_over = false
	}
		
		
	if ( config.bot.hold_on_slope_rate ){
		// Set slope buy hold
		if ( 
				ds.states.slope_rate_under
					&&
				!ds.states.slope_rate_over
		){
			ds.states.buy_hold_on_detectSlopeRate_under = true
			ds.states.sell_hold_on_detectSlopeRate_over = false
		}
		else if ( 
				ds.states.slope_rate_over
					&&
				!ds.states.slope_rate_under
		){
			ds.states.buy_hold_on_detectSlopeRate_under = false
			ds.states.sell_hold_on_detectSlopeRate_over = true
		}
		else if (
				ds.states.slope_rate_over
					&&
				ds.states.slope_rate_under	
		){
			ds.states.buy_hold_on_detectSlopeRate_under = true
			ds.states.sell_hold_on_detectSlopeRate_over = true
			topOrBottom()
		}
			
		else {
			ds.states.buy_hold_on_detectSlopeRate_under = false
			ds.states.buy_hold_on_detectSlopeRate_over = false
			ds.states.buy_hold_on_detectSlopeRate_under = false
			ds.states.sell_hold_on_detectSlopeRate_over = false
			topOrBottom()
		}
		
		// Check if on top and hold
		if ( 
				ds.states.slope_type == "top"
					&&
				!ds.states.slope_rate_over
		){
			ds.states.buy_hold_on_detectSlopeRate_over = true
		}
	}
	else {
		ds.states.buy_hold_on_detectSlopeRate_under = false
		ds.states.buy_hold_on_detectSlopeRate_over = false
		ds.states.buy_hold_on_detectSlopeRate_under = false
		ds.states.sell_hold_on_detectSlopeRate_over = false
                topOrBottom()
	}
	
	callback( true )
}

exports.holdOnSlopeRateWindow = function( callback ){
    if ( config.bot.hold_on_slope_rate ){
            if (
                            (
                                    parseFloat( ds.stats.oneMin_slope_rate ) > parseFloat( config.bot.hold_1min ) 
                                            &&
                                    parseFloat( ds.stats.fiveMin_slope_rate ) > parseFloat( config.bot.hold_5min )
                                            &&
                                    parseFloat( ds.stats.tactical_slope_rate ) > parseFloat( config.bot.hold_15min )
                                            &&
                                    parseFloat( ds.stats.halfHr_slope_rate ) > parseFloat( config.bot.hold_30min )
                                            &&
                                    parseFloat( ds.stats.oneHr_slope_rate ) > parseFloat( config.bot.hold_1hr )
                                            &&
                                    parseFloat( ds.stats.twoHr_slope_rate ) > parseFloat( config.bot.hold_2hr )
                                            &&
                                    parseFloat( ds.stats.threeHr_slope_rate ) > parseFloat( config.bot.hold_3hr )
                                            &&
                                    parseFloat( ds.stats.fourHr_slope_rate ) > parseFloat( config.bot.hold_4hr )
                                            &&
                                    parseFloat( ds.stats.oneHr_avg_slope_rate ) > parseFloat( config.bot.hold_1_avg )
                                            &&
                                    parseFloat( ds.stats.twoHr_avg_slope_rate ) > parseFloat( config.bot.hold_2_avg )
                                            &&
                                    parseFloat( ds.stats.threeHr_avg_slope_rate ) > parseFloat( config.bot.hold_3_avg )
                                            &&
                                    parseFloat( ds.stats.fourHr_avg_slope_rate ) > parseFloat( config.bot.hold_4_avg )
                            )
                                    &&
                            (
                                    parseFloat( ds.stats.oneMin_slope_rate ) < parseFloat( config.bot.hold_1min_over ) 
                                            &&
                                    parseFloat( ds.stats.fiveMin_slope_rate ) < parseFloat( config.bot.hold_5min_over )
                                            &&
                                    parseFloat( ds.stats.tactical_slope_rate ) < parseFloat( config.bot.hold_15min_over )
                                            &&
                                    parseFloat( ds.stats.halfHr_slope_rate ) < parseFloat( config.bot.hold_30min_over )
                                            &&
                                    parseFloat( ds.stats.oneHr_slope_rate ) < parseFloat( config.bot.hold_1hr_over )
                                            &&
                                    parseFloat( ds.stats.twoHr_slope_rate ) < parseFloat( config.bot.hold_2hr_over )
                                            &&
                                    parseFloat( ds.stats.threeHr_slope_rate ) < parseFloat( config.bot.hold_3hr_over )
                                            &&
                                    parseFloat( ds.stats.fourHr_slope_rate ) < parseFloat( config.bot.hold_4hr_over )
                                            &&
                                    parseFloat( ds.stats.oneHr_avg_slope_rate ) < parseFloat( config.bot.hold_1_avg_over )
                                            &&
                                    parseFloat( ds.stats.twoHr_avg_slope_rate ) < parseFloat( config.bot.hold_2_avg_over )
                                            &&
                                    parseFloat( ds.stats.threeHr_avg_slope_rate ) < parseFloat( config.bot.hold_3_avg_over )
                                            &&
                                    parseFloat( ds.stats.fourHr_avg_slope_rate ) < parseFloat( config.bot.hold_4_avg_over )
                            )
            ){
                    ds.states.buy_hold_on_slope_rate = false
            }
            else {
                    ds.states.buy_hold_on_slope_rate = true
            }
    }
    else {
            ds.states.buy_hold_on_slope_rate = true
    }

    callback( true )
}


exports.holdOnSlopeRateSides = function( callback ){
	
	if ( config.bot.hold_on_slope_rate ){
		
		// Hold if meets criteria for past one hour slopes
		if (
				(
					parseFloat( ds.stats.oneMin_slope_rate ) < parseFloat( config.bot.hold_1min ) 
						||
					parseFloat( ds.stats.fiveMin_slope_rate ) < parseFloat( config.bot.hold_5min )
						||
					parseFloat( ds.stats.tactical_slope_rate ) < parseFloat( config.bot.hold_15min )
						||
					parseFloat( ds.stats.halfHr_slope_rate ) < parseFloat( config.bot.hold_30min )
						||
					parseFloat( ds.stats.oneHr_slope_rate ) < parseFloat( config.bot.hold_1hr )
						||
					parseFloat( ds.stats.twoHr_slope_rate ) < parseFloat( config.bot.hold_2hr )
						||
					parseFloat( ds.stats.threeHr_slope_rate ) < parseFloat( config.bot.hold_3hr )
						||
					parseFloat( ds.stats.fourHr_slope_rate ) < parseFloat( config.bot.hold_4hr )
					    ||
	                parseFloat( ds.stats.oneHr_avg_slope_rate ) < parseFloat( config.bot.hold_1_avg )
	                    ||
	                parseFloat( ds.stats.twoHr_avg_slope_rate ) < parseFloat( config.bot.hold_2_avg )
	                    ||
	                parseFloat( ds.stats.threeHr_avg_slope_rate ) < parseFloat( config.bot.hold_3_avg )
	                    ||
	                parseFloat( ds.stats.fourHr_avg_slope_rate ) < parseFloat( config.bot.hold_4_avg )
	            )
	            	||
				(
					parseFloat( ds.stats.oneMin_slope_rate ) > parseFloat( config.bot.hold_1min_over ) 
						||
					parseFloat( ds.stats.fiveMin_slope_rate ) > parseFloat( config.bot.hold_5min_over )
						||
					parseFloat( ds.stats.tactical_slope_rate ) > parseFloat( config.bot.hold_15min_over )
						||
					parseFloat( ds.stats.halfHr_slope_rate ) > parseFloat( config.bot.hold_30min_over )
						||
					parseFloat( ds.stats.oneHr_slope_rate ) > parseFloat( config.bot.hold_1hr_over )
						||
					parseFloat( ds.stats.twoHr_slope_rate ) > parseFloat( config.bot.hold_2hr_over )
						||
					parseFloat( ds.stats.threeHr_slope_rate ) > parseFloat( config.bot.hold_3hr_over )
						||
					parseFloat( ds.stats.fourHr_slope_rate ) > parseFloat( config.bot.hold_4hr_over )
						||
	                parseFloat( ds.stats.oneHr_avg_slope_rate ) > parseFloat( config.bot.hold_1_avg_over )
	                    ||
	                parseFloat( ds.stats.twoHr_avg_slope_rate ) > parseFloat( config.bot.hold_2_avg_over )
	                    ||
	                parseFloat( ds.stats.threeHr_avg_slope_rate ) > parseFloat( config.bot.hold_3_avg_over )
	                    ||
	                parseFloat( ds.stats.fourHr_avg_slope_rate ) > parseFloat( config.bot.hold_4_avg_over )
		        )

		){
			ds.states.buy_hold_on_slope_rate = true
		}
		else {
			ds.states.buy_hold_on_slope_rate = false
		}
	}
	else {
		ds.states.buy_hold_on_slope_rate = false
	}
	
	callback( true )
}


