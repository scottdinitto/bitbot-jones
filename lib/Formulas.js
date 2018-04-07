const ds = require( './DataStructures.js' ).data
const log = require( "../bitbot.js" ).log
const db = require('./Db.js')
const trend = require( './Trends.js' )

var config = require( "../bitbot.js" ).config
if ( config.bot.dynamic_config ){
	// Add a timeout so we're not reading the fs every millisecond
	setInterval( function(){
		config = require( "../bitbot.js" ).config
	}, 500 )
}


var transaction = ds.transaction
var trend_threshold = config.bot.trend_tick_threshold



exports.calculateFees = function( buy_price, callback ){
	var transaction_buy = parseFloat( transaction.buy_amount ) * parseFloat( transaction.buy_fee )
	var transaction_sell = ( parseFloat( transaction.buy_amount ) + parseFloat( transaction.profit ) ) * parseFloat( transaction.sell_fee )

	if ( config.bot.buy_type == "limit" ){
		transaction_buy = 0
		transaction_sell = 0
	}
	
	var coins = ( parseFloat( transaction.buy_amount ) - transaction_buy ) / buy_price
	var sell_price = ( parseFloat( transaction.profit ) + parseFloat( transaction.buy_amount ) + transaction_sell ) / coins
		
	callback({
		"coins": coins,
		"sell_price": sell_price
	})
}

exports.getProfitBetweenPrices = function( buy_price, current_price, buy_amount ){
	var coins = parseFloat( buy_amount ) / parseFloat( buy_price )
	var new_price = coins * parseFloat( current_price )
	
	//ds.test_field = new_price + " - " + buy_price + " | " + buy_price + " -- " + current_price + " -- " + buy_amount
	return ( new_price - buy_amount )
}

exports.getOptimalSellPrice = function( buy_price, profit ){
	var transaction_buy = parseFloat( transaction.buy_amount ) * parseFloat( transaction.buy_fee )
	var transaction_sell = ( parseFloat( transaction.buy_amount ) + parseFloat( transaction.profit ) ) * parseFloat( transaction.sell_fee )

	if ( config.bot.buy_type == "limit" ){
		transaction_buy = 0
		transaction_sell = 0
	}
	
	var coins = ( parseFloat( transaction.buy_amount ) - transaction_buy ) / buy_price
	var sell_price = ( parseFloat( transaction.profit ) + parseFloat( transaction.buy_amount ) + transaction_sell ) / coins

	return sell_price
}

exports.getSinkRatePrice = function( callback ){
	var price_diff = ds.stats.ticker.price * config.bot.pct_drop_buy_min
	callback( price_diff )
}

exports.setSinkRate = function( callback ){
	if ( config.bot.sink_rate ){
		this.getSinkRatePrice( function( price ){
			ds.stats.sinkrate_price = price
		})
	}
	else {
		ds.stats.sinkrate_price = 0
	}
}

/*
 * Dynamic Sink Rate
 * 
 * We want to calculate the optimal sink rate by the following:
 * 
 *   - At least as much as we need to recover to make a profit
 *   - If drop detected, then alter the price and lower the price equal to the drop trend
 *   - Check the recent price history:
 *     - Try to detect if we are on an uptrend and how much. If the price increase has been too signifigant, 
 *       we need to antipate a large drop soon. Lower the buy price accordingly
 *     - If price has been going down, lower the buy price by the downtrend factor
 *   - If large spike detected, lower the drop price equal to the spike increase
 *   - Check if volatile, and if so, then drop the price accordingly.
 *     
 */
exports.setDynamicSinkRate = function( callback ){
	if ( config.bot.dynamic_sink_rate == true && config.bot.sink_rate ){
		
		var price = ds.stats.ticker.price
		var sink_rate = 0
		
		// Sink rate should be at least as much as what we need to recover to make a profit,
		// times a modifier
		this.calculateFees( price, function( fees ){	
				sink_rate = ( ( parseFloat( fees.sell_price ) - parseFloat( ds.stats.ticker.price ) ) * parseFloat( config.bot.dynamic_sink_rate_modifier ) )
		})
		
		// Recent price history alters

		if ( ds.trend.price_history ){
			var start_price = ds.trend.price_history[ ds.trend.price_history.length - 1 ]
			var end_price = price
			var average_price = this.getAveragePriceHistory()			
			
			if ( start_price > end_price ){
				// Downtrend
				var price_difference = ( start_price - end_price )
				
				// Determine from the average if we are unusually low or not
				if ( average_price > end_price ){
					var avg_difference = ( average_price - end_price )
				
					// going down
					// We need to alter the price
					sink_rate = ( ( sink_rate + price_difference + avg_difference ) * parseFloat( config.bot.dynamic_sink_rate_drop_modifier ) )
				}
				else {
					var avg_difference = ( end_price - average_price )
					// overall going up
					sink_rate = ( ( sink_rate + avg_difference ) * parseFloat( config.bot.dynamic_sink_rate_drop_modifier ) )
				}
			}
			else {
				// No alters for now...
				// Uptrend
				var price_difference = ( end_price - start_price )
				
				// Determine from the average if we are unusually low or not
				if ( average_price > end_price ){
					// going downward
				}
				else {
					// going up
				}
			}
		}

		
		// drop detected
		if ( ds.states.alarms.drop_detection ){
			// Slightly alter the price based on the drop
			var add_price = price + ( ( price * ( parseFloat( config.bot.dynamic_sink_rate_drop_modifier ) /100 ) ) * config.bot.dynamic_sink_rate_modifier )
			sink_rate = ( sink_rate + add_price )
		}
		
		// large spike detected
		if ( ds.states.alarms.spike_detection || ds.states.alarms.large_spike_detection ){
			// We might need to alter to compensate for an upcoming big frop
			// Get the difference from the now price and the price from config.bot.drop_detection_history
			var price_difference
			if ( ds.trend.price_history[ config.bot.spike_detection_history ] ){
				price_difference = price - ds.trend.price_history[ config.bot.spike_detection_history ]
			}
			else {
				price_difference = price - ds.trend.price_history[ ds.trend.price_history.length - 1 ]
			}
			
//			ds.test_field = "price: " + price_difference
			
			// Now, add a drop rate equal to this change
			if ( price_difference )
				sink_rate = ( ( sink_rate + price_difference ) * config.bot.dynamic_sink_rate_modifier )
		}
		
		//sink_rate_factor = ( ds.stats.total_slope_rate / config.bot.dynamic_sink_rate_factor ).toFixed(1)
		
		// Multiply sink rate factor and sink rate, add amount to sink rate
//		if ( sink_rate_factor < -1 ){
//			ds.stats.sinkrate_price = Math.abs( ( ds.stats.sinkrate_price * sink_rate_factor ).toFixed(2) )
//		}
//		else if ( sink_rate_factor > 1 ){
//			//ds.stats.sinkrate_price = Math.abs( ( ds.stats.sinkrate_price / sink_rate_factor ).toFixed(2) )
//		}
		
		ds.stats.sinkrate_price = sink_rate
	}
	else {
		ds.stats.sinkrate_price = 0
	}
}

exports.setDynamicSinkRateCurve = function( callback ){
	
	if ( config.bot.sink_rate ){
		var drop_rate = 0
		
		drop_rate = ( parseFloat( ds.trend.curves.price_peak ) * ( parseFloat( config.bot.curve_buy_drop_drop_amount ) / 100 ) )
		
		if ( config.bot.curve_dynamic_drop ){
			drop_rate = ( 
							drop_rate 
								+ 
							( 
									parseFloat( ds.trend.curves.price_peak ) 
										* 
									( 
											Math.abs( 
													parseFloat( ds.stats.oneMin_slope_rate ) 
														/
													parseFloat( config.bot.curve_drop_rate_modifier ) 
											) 
									) 
							) 
						)
		}
		
		if ( 
				parseFloat( ds.stats.halfHr_slope_rate ) < parseFloat( config.bot.curve_negative_drop_slope )
					||
				parseFloat( ds.stats.halfHr_slope_rate ) > parseFloat( config.bot.curve_positive_drop_slope )
		){
	//		ds.stats.sinkrate_price = drop_rate + ( parseFloat( ds.trend.curves.price_peak ) * Math.abs( parseFloat( ds.stats.fiveMin_slope_rate ) / parseFloat( config.bot.curve_drop_rate_modifier ) ) )
			ds.stats.sinkrate_price = (
					
					drop_rate 
						+ 
					( 
							parseFloat( ds.trend.curves.price_peak ) 
								* 
							Math.abs( 
									parseFloat( ds.stats.halfHr_slope_rate ) 
										/
									parseFloat( config.bot.curve_secondary_drop_rate_modifier ) 
							) 
					) 
			)
	
		}
		else {
			ds.stats.sinkrate_price = drop_rate
		}
	}
	else {
		ds.stats.sinkrate_price = 0
	}
}

exports.oldSetDynamicSinkRate = function( callback ){
	/*
	 * Calculate the sink rate on these factors:
	   - The current slop rates
	   - The difference in price from the current price to the 
	     optimal sale price
	   - 
	 */
	if ( config.bot.sink_rate ){
		if ( config.bot.dynamic_sink_rate == true ){
			// Sink rate should be at least as much as what we need to recover to make a profit
			this.calculateFees( ds.stats.ticker.price, function( fees ){
				
				if ( config.bot.buy_type == "market" && config.bot.sink_rate ){
					ds.stats.sinkrate_price = ( parseFloat( fees.sell_price ) - parseFloat( ds.stats.ticker.price ) )
				}
				else if ( config.bot.buy_type == "limit" && config.bot.sink_rate ){
					ds.stats.sinkrate_price = ( parseFloat( fees.sell_price ) - parseFloat( ds.stats.ticker.price ) )
				}
				else {
					ds.stats.sinkrate_price = 0
				}
			})
			
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
			
			sink_rate_factor = ( ds.stats.total_slope_rate / config.bot.dynamic_sink_rate_factor ).toFixed(1)
			
			// Multiply sink rate factor and sink rate, add amount to sink rate
			if ( sink_rate_factor < -1 ){
				ds.stats.sinkrate_price = Math.abs( ( ds.stats.sinkrate_price * sink_rate_factor ).toFixed(2) )
			}
			else if ( sink_rate_factor > 1 ){
				//ds.stats.sinkrate_price = Math.abs( ( ds.stats.sinkrate_price / sink_rate_factor ).toFixed(2) )
			}
		}
	}
	else {
		ds.stats.sinkrate_price = 0
	}
}

exports.getSlopeRate = function( coords, callback ){	
	// angle in radians
	//var angleRadians = Math.atan2(coords.end.y - coords.start.y, coords.end.x - coords.start.x);
	
	// angle in degrees
	var angleDeg = Math.atan2( parseFloat( coords.end.y ) - parseFloat( coords.start.y ), parseFloat( coords.end.x )  - parseFloat( coords.start.x ) ) * 180 / Math.PI;
	ds.trend.slope_interval = angleDeg.toFixed(0)
	callback( angleDeg.toFixed(1) )
}

/*
 *  "Get what I can take" - Add this option to sell as close as possible to the profit point. 
 *  When detecting a downturn, if the price is at a point where any profit is possible, make 
 *  a decision to sell or wait until the max profit price is reached. Base the decision on:

  - slope factors
  - volatility index
  - volume
 */
exports.getWhatICanTake = function( callback ){
	
}

/*
 * "Never lose" - Add this option to always sell during a drop before the price drops below a 
 * minimum profit point. May require adding "minimum profit" in the config file

 */
exports.neverLose = function( callback ){
	
}

/*
 * Teach bot how to detect flapping at top. Flapping at the top fluctuates the price from up to 
 * down rapidly. Need to check for very rapid up and down swings, and increase the flap
 * so the trend increases to compensate
 */
exports.rapidFlap = function( callback ){
	
}

/*
 * 	On a sale, check the upswing before it happen. The steeper the upswing, 
	the more the sink rate should be increased before buying again, if that 
	increase is a high for the day
 */
exports.increaseSinkRateAfterUpswing = function( callback ){


}

/* Stop limit
 * 
 * When the wallet hits this amount, stop buying
 */
exports.stopBuying = function( callback ){
	
}

/* Climbing the ladder
 * 
 * If in a sell cycle, when the sale price is met, detect if the trend is on a rise.
 * If so, then hold from selling until it reaches the top
 */
exports.climbTheLadder = function( callback ){
	if ( config.bot.climb_the_ladder == true && ds.trend.state == 1 ){
		if ( parseFloat( ds.stats.oneMin_slope_rate ) > parseFloat( config.bot.climb_the_ladder_slope ) ){
			ds.states.alarms.climb_ladder = true
		}
		else {
			ds.states.alarms.climb_ladder = false
		}
	}
	else {
		ds.states.alarms.climb_ladder = false
	}
}

/*
 * Detect extreme volatility and adjust trend gap and sink rate accordingally
 */
exports.detectVolatility = function( callback ){
	
}

/*
 * Detect up and downswings, and their slopes. Dynamically alter other values 
 * to match the current trend, for performance
 */
exports.detectSwing = function( callback ){
	
}

/*
 * Alter the buy price in downward trends
 */
exports.alterBuyPriceDuringDowntrend = function( callback ){
	
}

/*
 * Detect sellofs and suspend buys while it's happening; possibly do a quick sell before the drop increases
 */
exports.detectSelloff = function( callback ){
	
}

/*
 * Add acceptable loss algorithm to prevent being stuck holding coins and not making buys
 */
exports.acceptableLoss = function( callback ){
	
}



/*
 * Tactical price change
 * 
 * We'll use the tactical price change to show the total price changes over a period of time
 * specified by config.bot.tactical_price_change_timeframe, in seconds
 */



/* Dynamic limit sale price
 * 
 * This works in conjunction with drop detection to determine the best limit sale price.
 */

/*
 * Add a way to read history and determine a slope trend, and alter the buy 
 * price and/or the sink rate to accomodat the trend

 */
/*
 * Calculate the amount to get profit, and couple that with the downtrend slope 
 * value, and alter the sink rate/buy decisions based on this
 */


/*
 * When a drop is detected, determine the distance from the current price to the 
 * optimal sale price. measure the total sink rate size for the original buy price. 
 * If the distance from the buy price to the current price exceeds the sink rate, 
 * allow it to drop and sell to within 20% of the distance from the current price 
 * to the starting price + adding the sink rate.
 */


/*
 * Add a way to detect an uptrend. Make an option so after a buy, use a combination 
 * of the up and down flags coupled with the current price to determine the sale. 
 * If there is a downtrend, instead of instantly selling, hold onto the buy until it 
 * is within a few percentage of the sell price (for protection on the sale). Make sure 
 * there is a sale if there is risk the downtrend will fall below the optimale sale period. 
 * This way, if the trend turns around and climbs again, there will be more.
 */



exports.addPercent = function( number, percent ){
	return(
			parseFloat( number )
				+
			( parseFloat( number ) * parseFloat( percent ) )
	)
}

exports.subtractPercent = function( number, percent ){
	return(
			parseFloat( number )
				-
			( parseFloat( number ) * parseFloat( percent ) )
	)
}

exports.setBuyThreshold = function( current_price ){
	var buy_threshold = null
	
	if ( config.bot.dynamic_sink_rate ){
		if ( ds.stats.sinkrate_price ){
			buy_threshold =  ds.stats.sinkrate_price
		}
		else {
			buy_threshold =  current_price * config.bot.pct_drop_buy_min 
		}
	}
	
	// Limit Buys
	// We modify the threshold by the config.bot.dynamic_slope_rate_limit_modifier percentage
	// and will place an order x% fewer dollars to make sure the limit order is put in far enough down
	// to avoid an immediate buy (and the post only succeeds for gdax)
	if ( config.bot.buy_type == "limit" ){
		buy_threshold = ( 
				parseFloat( current_price ).toFixed(2) 
					- 
				( ds.stats.sinkrate_price * ( parseFloat( config.bot.sink_rate_limit_modifier ) / 100 ) ).toFixed(2)
		)
	}

	ds.transaction.buy_threshold = parseFloat( buy_threshold ).toFixed(2)
	
	return ds.transaction.buy_threshold
}

exports.getLimitOrderBuyPrice = function( price ){
	// Need to set a buy price for limit orders
	//
	// Standard model is to set a price based on the sink rate. The sink rate
	// is either manual in the config file, or dynamic.
	// We also need
	// Dynamic sink rate | manual
	if ( config.bot.dynamic_sink_rate ){
		
	}
	else {
		
	}
	// Dynamic buy price
}


exports.getAveragePriceHistory = function(){
	
	if ( ds.trend.price_history ){
		var price = 0
		for ( var index = 0; index < ds.trend.price_history.length; index++ ){
			price += parseFloat( ds.trend.price_history[index] )
		}

		return ( price / ds.trend.price_history.length )
	}
}

exports.getLiveProfit = function( callback ){
	
	if ( ds.stats.ticker.price > ds.transaction.last_buy_price ){
		ds.states.live_profit = this.getProfitBetweenPrices( ds.transaction.last_buy_price, ds.stats.ticker.price, config.bot.buy_amount )
	}
	else {
		ds.states.live_profit = 0
	}
	
	callback( true )
}

exports.incrementConsecutiveSells = function( callback ){
	ds.transaction.consecutive_sells++
	ds.transaction.consecutive_sell_price = ds.stats.ticker.price
	
	callback( true )
}

exports.getAverageSlopeRate = function( callback ){

		return ( parseFloat(
				(	
					parseFloat( ds.stats.oneHr_slope_rate ) + 
					parseFloat( ds.stats.twoHr_slope_rate ) + 
					parseFloat( ds.stats.threeHr_slope_rate ) + 
					parseFloat( ds.stats.fourHr_slope_rate )
				) / 4 ).toFixed(1)
			)				 
}

exports.getUnixTimestamp = function( callback ){
	callback( Math.round((new Date()).getTime() / 1000) )
}

exports.getDateStamp = function( callback ){
	var d = new Date()
	callback( d.getFullYear() + "-" + d.getMonth() + "-" + ( parseFloat( d.getDate() ) + 1 ) + "_" + d.getHours() + "." + d.getMinutes() + "." + d.getSeconds() )
}

