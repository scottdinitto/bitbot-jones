const ds = require( './DataStructures.js' ).data
const dataStructures = require( './DataStructures.js' )
const log = require( "../bitbot.js" ).log
const f = require( './Formulas.js' )
const display = require( './Display.js' )
const gdax = require( './gdaxAPI.js' )
const db = require('./Db.js')
const trend = require( './Trends.js' )
var config = require( "../bitbot.js" ).config

if ( config.bot.dynamic_config ){
	// Add a timeout so we're not reading the fs every millisecond
	setInterval( function(){
		config = require( "../bitbot.js" ).config
	}, 500 )
}

exports.decide = function( callback ){
	var self = this

	if ( ds.trend && !ds.states.deciding ){
		ds.states.deciding = true
		
		
		
		
		/*
		 * Buying mode, default starting mode
		 */
		if ( ds.transaction.state == 1 ){
			ds.states.profit_adjusted = config.bot.profit_usd
			
			// Check if we should buy
			self.doIBuy( function( state ){
				
				if ( state && !ds.states.alarms.bought ){
					
					var price = 0
					ds.states.alarms.check_buy = false
				
					if ( config.bot.buy_type == "market" ){
						price = "current"
					}
					else if ( config.bot.buy_type == "limit" ){
						//price = f.setBuyThreshold( ds.stats.ticker.price )
						price = parseFloat( ds.stats.ticker.price ) - parseFloat( ds.stats.sinkrate_price )
					}
					else if ( config.bot.buy_type == "curve" ){
						price = parseFloat( ds.stats.ticker.price ) - parseFloat( config.bot.curve_buy_price )
					}

					if ( !ds.states.buying ){
						self.buy( price, ds.transaction.buy_amount, config.bot.buy_type, function( response ){
							log.write("Decided to buy@" + ds.stats.ticker.price )
							
							if ( response == false ){
								log.write( "Buy failed, aborting and continuing search to buy sequence..." )
							}
							else {
								ds.states.alarms.bought = true
								ds.states.alarms.sold = false
								ds.states.alarms.check_buy = false
								
								if ( config.bot.buy_type == "market" ){
									log.write( "Ordered $" + response.executed_value + " of coins while at " + ds.states.last_buy_price )
									ds.transaction.state = 3
								}
								else if ( config.bot.buy_type == "limit" ){
									log.write( "Placed a limit order for $" + config.bot.buy_amount + " of coins at " + ds.states.last_buy_price )
									ds.transaction.state = 5
								}
								else if ( config.bot.buy_type == "curve" ){
									log.write( "Placed a limit order for $" + config.bot.buy_amount + " of coins at " + ds.states.last_buy_price )
									ds.transaction.state = 5
								}
							}
						})
					}
				}
			})
		}
		
		
		
		
		/*
		 * Selling mode
		 */
		else if ( ds.transaction.state == 2 ){
			self.doISell( function( state ){
				if ( state == true ){
					
					// Throw the check alarm if within >=1% of the sale price
					if ( ( ( ds.transaction.sell_price * .01 ) + ds.stats.ticker.price ) >= ds.transaction.sell_price ){
						ds.states.alarms.check_sell = true
					}
					
					log.write("Decided to sell")
					
					if ( !ds.states.selling ){
						self.sell( ds.stats.ticker.price, ds.transaction.coins, config.bot.buy_type, function(response){
							
							if ( response == false ){
								log.write( "Failed to sell " + transaction.coins + " coins @ " + ds.stats.ticker.price + ". Will stay in sell cycle and try again.")
							}
							else {
								log.write( "Succesfully sold " + response.size + " coins!" )
								ds.transaction.state = 4
								ds.states.alarms.sold = true
								ds.states.alarms.bought = false
								ds.states.alarms.check_sold = false
							}
						})
					}
				}
			})	
		}
		
		
		
		/*
		 * Made a purchase request, waiting for fill
		 */
		else if ( ds.transaction.state == 3 ){
			// Fill a buy
			// Bought, waiting for fill
			
			// Check on buy order
			self.fillBuyOrder( ds.buy_order.id, function( status ){
				if ( status ){
					ds.states.alarms.bought = true
					if ( !ds.states.order_added_to_db ){
						ds.states.order_added_to_db = true
						db.addOrder( ds.buy_order, function(){
							ds.states.order_added_to_db = false	
						})
					}
					log.write( "Order filled, Moving to sell" )
					ds.transaction.state = 2
				}
				else {
					log.write( "Waiting for order to be filled to sell" )
					ds.transaction.state = 3
				}
			});
		}
		
		
		
		/*
		 * Made a sell request, waiting for fill
		 */
		else if ( ds.transaction.state == 4 ){ 
			// Fill a sale
			  
			// Check on sell order
			self.fillSellOrder( ds.sell_order.id, function( status ){
				if ( status == "done" ){
					if ( !ds.states.order_added_to_db ){
						ds.states.order_added_to_db = true
						db.addOrder( ds.sell_order, function(){
							ds.states.order_added_to_db = false
						})
					}
					log.write( "Sell order filled!" )
					ds.sell_order = null
					ds.states.alarms.open_sell_order = false
					ds.states.order_added_to_db = false
					ds.states.alarms.check_sold = false
					ds.states.alarms.check_buy = false
					ds.states.alarms.bought = false
					ds.transaction.sell_price = null
					ds.transaction.state = 1
				}
				
				else if ( status == "open" ){
					log.write( "Waiting for sell order to be filled..." )
					ds.transaction.state = 4
				}
				
				else if ( status == "rejected" ){
					log.write( "Sell order rejected, stuck with " + ds.transaction.coins + ", going back to buy cycle" )
					ds.states.alarms.open_sell_order = false
					ds.states.order_added_to_db = false
					ds.states.alarms.check_sold = false
					ds.states.alarms.check_buy = false
					ds.states.alarms.bought = false
					ds.transaction.sell_price = null
					ds.sell_order = null
					ds.transaction.state = 1
					
				}
				else if ( status == "pending" ){
					ds.transaction.state = 4
					log.write( "Sell order is pending..." )
				}
			})
		}
		
		
		
		/*
		 * Limit order is successful, waiting for limit fill
		 */
		else if ( ds.transaction.state == 5 && ds.buy_order ){
			// Limit buy order is on the books, check for it to be filled
			// Check the order book for our product id anbd look for type of "done"

			self.fillBuyOrder( ds.buy_order.id, function( status ){
				
				if ( status ){
					
					if ( status == "rejected" ){
						log.write( "Buy order rejected... going back to buy state" )
						log.write( "Current price: " + ds.stats.ticker.price + " | Order price: " + ds.buy_order.price )
						ds.transaction.state = 1
						ds.states.alarms.bought = false
						ds.states.alarms.open_buy_order = false
						ds.states.buying = false
						
					}
					else if ( status == "pending" ){
						ds.transaction.state = 5
						ds.states.alarms.open_buy_order = false
						log.write( "Buy order is pending..." )
					}
					else if ( status == "open" ) {
						// Update db record
						ds.states.alarms.open_buy_order = true
						
						if ( !ds.states.order_added_to_db ){
							ds.states.order_added_to_db = true
							db.addOrder( ds.buy_order, function( state ){
								// keep db state true to avoid multiple adds.
								// cancel when filled
								log.write( "Get order request completed. Response is: " + ds.status_codes.getOrder_response.statusMessage )
								ds.states.order_added_to_db = true
							})
						}
						ds.transaction.state = 5
					}
					else if ( status == "done" ){
						log.write( "Order filled, Moving to sell" )
						
						ds.states.order_added_to_db = false
						ds.states.alarms.open_buy_order = false
						ds.states.alarms.bought = true
										
						if ( !ds.states.order_updated_to_db ){
							ds.states.order_updated_to_db = true
							db.updateOrderState( ds.buy_order, "active", function( state ){
								ds.states.order_updated_to_db = false
							})
						}
						
						if ( config.bot.buy_type == "limit" ){
							ds.transaction.state = 6
						}
						else if ( config.bot.buy_type == "curve" ){
							ds.transaction.state = 8
						}
					}
					else {
						ds.transaction.state = 5
					}
				}
			});
			
		}
		
		
		
		
		/*
		 * Limit sell order is successful, move to fill
		 */
		else if ( ds.transaction.state == 6 ){
			ds.states.live_price = 0
			
			// Add sell order to the books	
			self.sell( ds.transaction.sell_price, ds.transaction.coins, config.bot.buy_type, function(response){
				if ( response == false ){
					log.write( "Failed to sell " + ds.transaction.coins + " @ " + trend.price + ". Will stay in sell cycle and try again.")
					ds.transaction.state = 6
				}
				else {
					log.write( "Added sell order of " + response.size + " coins to sell at " + parseFloat( response.price ).toFixed(2) )
					ds.transaction.state = 7
					ds.states.alarms.check_sold = false
					ds.states.alarms.check_buy = false
					ds.states.alarms.bought = false
					//ds.transaction.sell_price = null
					
					ds.states.order_added_to_db = false
					if ( !ds.states.order_added_to_db ){
						ds.states.order_added_to_db = true
						db.addOrder( ds.sell_order, function( state ){
							ds.states.order_added_to_db = false
						})
					}
				}
			})
		}
		
		
		
		
		/*
		 * Limit sell order is waiting to fill
		 */
		else if ( ds.transaction.state == 7 ){

			// Check on sell order
			self.fillSellOrder( ds.sell_order.id, function( status ){
				if ( status ){

					if ( status == "rejected" ){
						log.write( "Sell order rejected ( Sell price: " + ds.transaction.sell_price + " | Rejected price: " + ds.transaction.rejected_price )

						// Retry
						if ( 
								config.bot.sell_order_retry > 0
									&&
								ds.transaction.sell_retry > 0
						){
							ds.transaction.sell_retry--
							ds.transaction.state = 6
							ds.states.selling = false
							ds.states.alarms.check_sold = false
							ds.states.alarms.open_sell_order = false
							ds.transaction.sell_price = parseFloat( ( parseFloat( ds.stats.ticker.price ) + parseFloat( config.bot.sell_order_retry_price_alter ) ) ).toFixed(2)
							log.write( "Going to retry sell " + ds.transaction.sell_retry + " more times @" + ds.transaction.sell_price )
						}
						else {
							if ( config.bot.sell_order_retry > 0 )
								ds.transaction.sell_retry = config.bot.sell_order_retry
								
							if ( config.bot.buy_type == "curve" ){
								ds.states.selling = false
								ds.states.alarms.check_sold = false
								ds.transaction.state = 8
								log.write( "Retries failed, will try to sell next opportunity")
							}
							
							log.write( "Going to retry to fill sell order..." )
						}
					}
					else if ( status == "pending" ){
						log.write( "Sell order is pending..." )
						ds.transaction.state = 7
						ds.states.alarms.check_sold = false
						ds.states.alarms.open_sell_order = false
					}
					else if ( status == "open" ){
						ds.states.alarms.check_sold = false
						ds.states.alarms.open_sell_order = true
						
						if ( !ds.states.order_added_to_db ){
							ds.states.order_added_to_db = true
							db.addOrder( ds.sell_order, function( state ){
								ds.transaction.state = 7
								// keep db state true to avoid multiple adds.
								// cancel when filled
//								ds.states.order_added_to_db = true
							})
						}						
					}
					else if ( status == "done" ){
						ds.states.alarms.sold = true
						ds.states.alarms.bought = false
						ds.states.alarms.check_sold = false
						ds.states.alarms.open_sell_order = false
						ds.states.selling = false
						
						ds.states.order_added_to_db = false
						if ( !ds.states.order_updated_to_db ){
							ds.states.order_updated_to_db = true
							db.updateOrderState( ds.sell_order, "closed", function( state ){
								ds.transaction.state = 1
								ds.states.order_updated_to_db = false
								ds.sell_order = null
								ds.buy_order = null
							})
						}
					}
				}
			})
		}
		
		
		
		
		else if ( ds.transaction.state == 8 ){
			
			// Cancel any leftover monitoropenby cancel checks
			clearTimeout( ds.states.loops.monitorOpenSellOrderTimer )
			
			if ( !ds.transaction.sell_price )
				ds.transaction.sell_price = ds.transaction.last_buy_price
			
			// Set live price
			if ( parseFloat( ds.stats.ticker.price ) >= parseFloat( ds.transaction.last_buy_price ) ){
				f.getLiveProfit( function(){} )
			}
			else {
				ds.states.live_profit = 0
			}
				
			// if config.bot.curve_sell_decrement_stale has passed, start decrementing 
			// at config.bot.curve_sell_decrement_interval
			if ( ds.states.loops.curve_decrement == false ){
				ds.states.loops.curve_decrement = true
				ds.states.loops.curve_sale_stale = setTimeout( function(){
					//ds.transaction.sell_price = parseFloat( ds.transaction.sell_price ) - parseFloat( config.bot.curve_sell_decrement_amount )

					var new_price_profit = f.getProfitBetweenPrices( ds.transaction.sell_price, ds.stats.ticker.price, config.bot.buy_amount )				
					log.write( "Sell limit has gone stale, checking to see if we can drop and sell... (" + new_price_profit + " > " + ( parseFloat( config.bot.acceptable_loss ) * -1 ) + ")" )
	
					if ( 
							parseFloat( new_price_profit ) > ( parseFloat( config.bot.acceptable_loss ) * -1 )
							
					){
						ds.transaction.sell_price = 0
					}
					ds.states.loops.curve_decrement = false
				}, parseFloat( config.bot.curve_sell_decrement_interval ) )
			}
				
			// Move to sell once we are at peak close
			//ds.test_field = ds.states.alarms.peak_close + " && " + ds.stats.ticker.price + " > " + ds.transaction.buy_price
			self.doISell( function( status ){
				if ( status == true ){
					ds.transaction.sell_price = parseFloat( parseFloat( ds.stats.ticker.price ) + parseFloat( config.bot.curve_sell_price ) ).toFixed(2)
					ds.transaction.state = 6
					ds.states.alarms.bought = true
					ds.states.live_profit = 0
					
					// Clear stale sell timeout
					if ( ds.states.loops.curve_sale_stale )
						clearTimeout( ds.states.loops.curve_sale_stale )
				}
			})
		}
	}
	
	ds.states.deciding = false
}

exports.doIBuy = function( callback ){
	//ds.test_field = "foo: " + ds.states.curves.rising + " && " + ( parseFloat( ds.trend.curves.last_price_peak ) - parseFloat( ds.stats.ticker.price ) ) + " > " + parseFloat( ds.stats.sinkrate_price )
//	ds.test_field = "consecutive sells: " + ds.transaction.consecutive_sells + " >= " + 
//	parseFloat( config.bot.consecutive_sell_limit ) + 
//	"\n                         "  +
//	parseFloat( ds.stats.ticker.price ) + 
//	" < " +
//	( parseFloat( ds.transaction.consecutive_sell_price ) - ( parseFloat( ds.transaction.consecutive_sell_price ) * ( parseFloat( config.bot.consecutive_sell_limit_threshold ) / 100 ) ) ) +
//	"\n                   hold_timer: " +  ds.states.loops.buy_hold_timer + " <= " + parseFloat( config.bot.hold_on_bottom )

    // Clear limits first
    this.clearConsecutiveSells( function( response ){} )
	
    // Do not buy if consecutive_sells is past limit
	if ( parseFloat( ds.transaction.consecutive_sells ) >= parseFloat( config.bot.consecutive_sell_limit ) ){
		callback( false )
	}
	
		
	// Check if state allows buying for slope side type
	else if ( 
				config.bot.hold_on_slope_rate_type == "sides"
					&&
				( 
						ds.states.last_slope_hold_type == "under"
							||
						ds.states.last_slope_hold_type == "top"
				)
	){
		callback( false )
	}
				
	// Check the state and buy status. If the state is up, proceed.
	else if ( !ds.states.buy_hold ){
		if ( 
				config.bot.always_buy 
		){
			ds.transaction.buy_reason = "always_buy"
			callback( true )
		}
		
		/*
		 * Check for market buys
		 */
		else if ( config.bot.buy_type == "market" && ds.trend.state == 1 ){
			if ( ds.trend.downchange_total > ds.transaction.buy_threshold ){
				ds.states.alarms.check_buy = true
				callback( true )
			}
		}
		
		/*
		 * Check for limit orders
		 */
		else if ( config.bot.buy_type == "limit" && ds.states.alarms.drop_detection ){
		//else if ( config.bot.buy_type == "limit" ){
			
			// Dynamic buy price model
			if ( config.bot.dynamic_buy_price == true ){
				
				// Determine if average price has been dropping too much to be risky
				var price_history = null
				var price_history_average = f.getAveragePriceHistory()
				
				if ( parseFloat( price_history_average ) > ds.stats.ticker.price ){
					// Do not allow a buy if the difference in the average price is
					// more than config.bot.dynamic_buy_price_downslope_percent
					if ( ( price_history_average - ds.stats.ticker.price  ) 
							>
						 ( ds.stats.ticker.price * ( parseFloat( config.bot.dynamic_buy_price_downslope_percent ) / 100) )
						 
					){
						ds.states.alarms.price_history_warning = true
						ds.states.buy_hold = true
					}
					else {
						ds.states.alarms.price_history_warning = false
						ds.states.buy_hold = false
					}
				}
				
				// Check for recent large spikes
				if ( 
						!ds.states.alarms.large_spike_detection
							&&
						!ds.states.alarms.price_history_warning
							&&
						!ds.states.buy_hold
				){
					callback( true )
				}
			}
			
			// Check the amount of the last drop. If it's within our threshold, and we are confident
			// that we're in a downward slope, buy.
			else if ( ds.stats.total_slope_rate ){
				ds.states.alarms.check_buy = true
				if ( parseFloat( ds.stats.total_slope_rate ) > parseFloat( config.bot.slope_limit_order_threshold ) ){
					callback( true )
				}
			}
		}
		
		/*
		 * If buying on the curve
		 */
		else if ( config.bot.buy_type == "curve" ){
			
			//ds.test_field = parseFloat( ds.trend.curves.price_peak ) - parseFloat( ds.stats.ticker.price ) + " > " +  ds.stats.sinkrate_price
				
			/*
			 * Default buy mode
			 */	
			if ( ds.states.alarms.bottom_close ){
				
				// Check to make sure we have dropped enough to make the buy
				if (
						parseFloat( ds.trend.curves.price_peak ) - parseFloat( ds.stats.ticker.price )
							>
						ds.stats.sinkrate_price
				){	
					ds.transaction.buy_reason = "bottom_close"
					callback( true )
				}
			}
			
			else if ( 
					ds.states.curves.rising
						&&
					( parseFloat( ds.trend.curves.last_price_peak ) - parseFloat( ds.stats.ticker.price ) )
						>
					parseFloat( ds.stats.sinkrate_price )
			){
				ds.transaction.buy_reason = "rising"
				callback( true )
			}
		}
		
	}
	else {
		ds.states.alarms.check_buy = false
		callback( false )
	}
}

exports.doISell = function( callback ){

	if ( !ds.states.sell_hold ){
		
		// Don't allow sell if price is undefined
		if ( 
				!ds.stats.ticker.price
					||
				ds.stats.ticker.price == "undefined"
		){
			callback( false )
		}
		
		else if ( config.bot.always_sell ){
			ds.transaction.sell_reason = "always_sell"
				callback( true )
		}
		
		
		else if ( 
				ds.transaction.state == 2 
					&&
				
				// Don't sell if climbing the ladder
				ds.states.alarms.climb_ladder == false
		){
			ds.states.alarms.check_sell = true
			
			if ( ds.stats.ticker.price >= ds.transaction.sell_price ){
				callback( true )
			}
		}
		
		/*
		 * If selling on the curve
		 */
		else if ( config.bot.buy_type == "curve" ){
		
			// Move to sell once we are at peak close
			//ds.test_field = ds.states.alarms.peak_close+ " && " + parseFloat( ds.stats.ticker.price ) + " > " + ( parseFloat( ds.transaction.buy_price ) + ( parseFloat( ds.transaction.buy_price ) * ( parseFloat( config.bot.profit_pct ) / 100 ) ) )
			if ( 
					ds.states.alarms.peak_close
						&&
					parseFloat( ds.stats.ticker.price ) > parseFloat( ds.transaction.buy_price ) + ( parseFloat( ds.transaction.buy_price ) * ( parseFloat( config.bot.profit_pct ) / 100 ) )
			){
				ds.transaction.sell_reason = "peak_close"
				callback( true )
			}
			
			else if ( 
					ds.states.curves.dropping
						&&
					parseFloat( ds.stats.ticker.price ) > parseFloat( ds.transaction.buy_price ) + ( parseFloat( ds.transaction.buy_price ) * ( parseFloat( config.bot.profit_pct ) / 100 ) )
	
			){
				ds.transaction.sell_reason = "dropping"
				callback( true )
			}
		}
		
		else {
			ds.states.alarms.check_sell = false
		}
		
		callback( false )
	}
	else {
		callback( false )
	}
}

exports.doICancel = function(){
	
}

exports.fillBuyOrder = function( id, callback ){

	var self = this
	
	if ( ds.states.getOrder == false && ds.buy_order.id ){
		
		if ( config.bot.test_mode == true ){
//			ds.test_field = ds.stats.ticker.price + " < " + ds.buy_order.price

			var order = { 
					"id": ds.buy_order.id,
					"price": ds.buy_order.price,
					"size": ds.buy_order.size,
					"product_id": ds.buy_order.product_id,
					"side": ds.buy_order.side,
					"stp": ds.buy_order.stp,
					"type": ds.buy_order.type,
					"time_in_force": ds.buy_order.time_in_force,
					"post_only": ds.buy_order.post_only,
					"created_at": ds.buy_order.created_at,
					"fill_fees": ds.buy_order.fill_fees,
					"filled_size": ds.buy_order.filled_size,
					"executed_value": ds.buy_order.executed_value,
					"status": ds.buy_order.status,
					"settled": "true"
			}
			
			var fill = function(){				
				// Change to return result of buy
				ds.buy_order = order
				ds.transaction.coins = ( parseFloat( ds.transaction.buy_amount ) / parseFloat( ds.stats.ticker.price ) )
				ds.buy_order.filled_size = parseFloat( ( parseFloat( ds.buy_order.amount ) / parseFloat ( ds.stats.ticker.price ) ) ).toFixed(8)
				ds.transaction.last_sell_price = 0
				//ds.transaction.last_buy_price = ds.states.last_buy_price
				ds.transaction.last_buy_price = ds.buy_order.price
				
				// Get the fees, target sell
				// change trend.last_price with return from the purchase api
				log.write( "Actual buy price:" + parseFloat( ds.transaction.last_buy_price ).toFixed(2) )
				
				if ( config.bot.buy_type == "market" ){
					f.calculateFees( ds.transaction.last_buy_price, function( fees ){
						ds.transaction.sell_price = fees.sell_price
						log.write( "Will try to sell@" + ds.transaction.sell_price )				
					})
					
					ds.transaction.total_earnings = parseFloat( ds.transaction.total_earnings ) - ( parseFloat( order.executed_value ) * ( parseFloat( config.bot.buy_fee ) / 100 ) )
				}
				else if ( config.bot.buy_type == "curve" ) {
					ds.transaction.sell_price = 0
				}
			}
			
			if (
						ds.transaction.state == 5
							&&
						parseFloat( ds.stats.ticker.price ) <= parseFloat( ds.buy_order.price )
							&&
						ds.buy_order.status != "open"
			){
				ds.buy_order.status = "rejected"
				callback( ds.buy_order.status )
			}
			else if ( 
					ds.transaction.state == 5
						&&
					parseFloat( ds.stats.ticker.price ) > parseFloat( ds.buy_order.price )
			){
				ds.buy_order.status = "open"
				callback( ds.buy_order.status )
			}
			else if ( 
					( 
							ds.transaction.state == 5
								&&
							parseFloat( ds.stats.ticker.price ) < parseFloat( ds.buy_order.price )
					)
						||
					ds.transaction.state == 3
			){
				self.logSlopes( function(){} )
				// Log transaction results
				dataStructures.getStatsParams( "buy", function( params ){
					log.write_stat(  params, function(){} )
				})
				
				dataStructures.getTransParams( "buy", function( params ){
					log.write_transaction( params, function(){} )
				})
						
				fill()
				ds.buy_order.status = "done"
				
				callback( ds.buy_order.status )
			}
		}
		else {
			ds.states.getOrder = true
			
			setTimeout( function(){ 
				ds.states.getOrder = false
			}, config.bot.rate_limit_timeout )
			
			gdax.getOrder( id, function(order){
				// For rate limiting control, wait a period of time before allowing
				// this to execute again				
				if ( order ){
					if ( order.status == "done" ){
						
						gdax.writeOrderToLog( order )	
						
						// Check the value of the return; if it's 0, we need to exit
						if ( order.filled_size == 0 ){
							log.write( "Problem with the response, value of return dollar amount is zero! Investigate, but will keep trying to lookup order")
							callback( false )
						}
						
						// Change to return result of buy
						ds.buy_order = order
						ds.transaction.coins = order.filled_size
						ds.transaction.last_sell_price = 0
						ds.transaction.last_buy_price = parseFloat( order.executed_value ) / parseFloat( order.filled_size )
						ds.transaction.buy_price = order.price
						
						// Get the fees, target sell
						// change trend.last_price with return from the purchase api
						log.write( "Last buy price:" + ds.transaction.last_buy_price )
						
						if ( ds.buy_type == "limit" || ds.buy_type == "market" ){
							f.calculateFees( ds.transaction.last_buy_price, function( fees ){
								ds.transaction.sell_price = fees.sell_price
								log.write("Will try to sell@" + ds.transaction.sell_price )				
							})
						}
						else if ( ds.buy_type == "curve" ) {
							ds.transaction.sell_price = parseFloat( ds.transaction.buy_price ) + ( parseFloat( ds.transaction.buy_price ) * ( parseFloat( config.bot.profit_pct ) / 100 ) )
							log.write( "Will sell at least at least @" + ds.transaction.sell_price + " or higher" )
						}
						
						self.logSlopes( function(){} )
						
						// Log transaction results
						dataStructures.getStatsParams( "buy", function( params ){
							log.write_stat(  params, function(){} )
						})
						
						dataStructures.getTransParams( "buy", function( params ){
							log.write_transaction( params, function(){} )
						})
						
						callback( order.status )
					}
					else if ( order.status == "open" ){
						callback( order.status )
					}
					else if ( order.status == "rejected" ){
						callback( order.status )
					}
					else if ( order.status == "pending" ){
						callback( order.status )
					}
					else {
						if ( config.bot.buy_type == "market" ){
							log.write( "Order placed, but not filled. Holding off other orders until filled. Order state is: " + order.status )
						}
						callback( false )
					}
				}
				callback( false )
			})
		}
	}
}

exports.fillSellOrder = function( id, callback ){
	
	var self = this
	
	if ( ds.states.getOrder == false && ds.sell_order.id ){
		
		ds.states.getOrder = true
		
		setTimeout( function(){ 
			ds.states.getOrder = false
		}, config.bot.rate_limit_timeout )
		
		if ( config.bot.test_mode == true ){
//			ds.test_field = ds.stats.ticker.price + " > " + parseFloat( ds.sell_order.price )
			
			var order = { 
					"id": ds.sell_order.id,
					"price": ds.sell_order.price,
					"size": ds.sell_order.size,
					"product_id": ds.sell_order.product_id,
					"side": ds.sell_order.side,
					"stp": ds.sell_order.stp,
					"type": ds.sell_order.type,
					"time_in_force": ds.sell_order.time_in_force,
					"post_only": ds.sell_order.post_only,
					"created_at": ds.sell_order.created_at,
					"fill_fees": ds.sell_order.fill_fees,
					"filled_size": ds.sell_order.filled_size,
					"executed_value": ds.sell_order.executed_value,
					"status": "done",
					"settled": "true"
			}
			
			var fill = function(){

				
				//transaction.last_buy_price = 0
				ds.sell_order = order
				ds.transaction.coins = 0
				ds.transaction.buy_price = 0
				ds.transaction.last_sell_price =  parseFloat( ds.transaction.sell_price )
				ds.states.alarms.bought = false
				f.incrementConsecutiveSells( function(response){} )
				
				
				// Change to make this the actual sell price from the gdax response
				log.write("SOLD AT: " + ds.sell_order.last_sell_price )
						
				ds.transaction.earnings = ( parseFloat( order.executed_value ).toFixed( 2 ) - parseFloat( ds.transaction.buy_amount ).toFixed( 2 ) ) - parseFloat( order.fill_fees ).toFixed(2)
				ds.transaction.total_earnings = ds.transaction.earnings + ds.transaction.total_earnings
				
				log.write("EARNINGS: " + ds.transaction.earnings.toFixed(2) )
				log.write("TOTAL EARNINGS: " + ds.transaction.total_earnings.toFixed(2) )
				self.logSlopes( function(){} )
				
				// Log transaction results
				dataStructures.getStatsParams( "sell", function( params ){
					log.write_stat(  params, function(){} )
				})
				
				dataStructures.getTransParams( "sell", function( params ){
					log.write_transaction( params, function(){} )
				})
				
				// Hold buys if configures
				if ( config.bot.hold_on_sell ){
					log.write( "Going to hold buys for " + config.bot.hold_on_sell_time_limit + " seconds due to sell" )
					self.buy_hold( config.bot.hold_on_sell_time_limit, function( response ){} )
				}
			}
			
			if ( 
					ds.transaction.state == 7
						&&
					parseFloat( ds.stats.ticker.price ) >= parseFloat( ds.buy_order.price )
						&&
					ds.sell_order.status != "open"
			){
				ds.sell_order.status = "rejected"
					callback( ds.sell_order.status )
			}
			else if (
					ds.transaction.state == 7
						&&
					parseFloat( ds.stats.ticker.price ) < parseFloat( ds.buy_order.price )
						&&
					ds.sell_order.status != "open"	
			){
				ds.sell_order.status = "open"
				callback( ds.sell_order.status )
			}
			else if ( 
					( 
							ds.transaction.state == 7
								&&
							parseFloat( ds.stats.ticker.price ) > parseFloat( ds.buy_order.price )
					)
						||
					ds.transaction.state == 4 
			){			
				fill()
				callback( "done" )
			}
		}
		else {
			gdax.getOrder( id, function(order){			
				if ( order ){
					if ( order.status == "done" ){
						
						gdax.writeOrderToLog( order )	
						
						// Check the value of the return; if it's 0, we need to exit
						if ( order.filled_size == 0 ){
							log.write( "Problem with the response, value of return dollar amount is zero! Continuing...")
							callback( false )
						}
						
						//transaction.last_buy_price = 0
						ds.sell_order = order
						ds.transaction.coins = 0
						ds.transaction.last_sell_price =  parseFloat( order.price )
						ds.states.alarms.bought = false
						f.incrementConsecutiveSells( function(response){} )
						
						// Change to make this the actual sell price from the gdax response
						log.write("SOLD AT: " + ds.transaction.last_sell_price )
						
						var fees = 0
						
						//ds.transaction.earnings = ( parseFloat( order.executed_value ) - parseFloat( ds.buy_orders[0].executed_value ) ) - parseFloat( calc_fees )
						
						if ( ds.transaction.state == 4 )
							fees = ( parseFloat( order.executed_value ) * ( parseFloat( config.bot.sell_fee ) / 100 ) )

						ds.transaction.earnings = ( parseFloat( order.executed_value ).toFixed( 2 ) - parseFloat( ds.transaction.buy_amount ).toFixed( 2 ) ) - parseFloat( order.fill_fees )
						ds.transaction.total_earnings = ds.transaction.earnings + ds.transaction.total_earnings
						
						log.write("EARNINGS: " + ds.transaction.earnings.toFixed(2) )
						log.write("TOTAL EARNINGS: " + ds.transaction.total_earnings.toFixed(2) )
						
						// Log transaction results
						dataStructures.getStatsParams( "sell", function( params ){
							log.write_stat(  params, function(){} )
						})
						
						dataStructures.getTransParams( "sell", function( params ){
							log.write_transaction( params, function(){} )
						})
						
						// Hold buys if configures
						if ( config.bot.hold_on_sell ){
							self.buy_hold( config.bot.hold_on_sell_time_limit, function( response ){} )
						}
						
						self.logSlopes( function(){} )
						callback( order.status )
					}
					else if ( order.status == "open" ){
						callback( order.status )
					}
					else if ( order.status == "pending" ){
						callback( order.status )
					}
					else if ( order.status == "rejected" ){
						ds.transaction.rejected_price = parseFloat( order.price ).toFixed(2)
						callback( order.status )
					}
					else {
						log.write( "Sell order placed, but not filled. Holding off other orders until filled. Order state is: " + order.status )
						callback( order.status )
					}
				}
				callback( false )
			})
		}
	}
}

exports.cancelOrder = function( order_id, callback ){
	
	var transaction_state = ds.transaction.state
	
	if( !ds.states.loops.cancelOrder ){
		ds.states.loops.cancelOrder = true
		ds.transaction.state = 0
		
		log.write( "Cancelling order" )
		gdax.cancelOrder( order_id, function( response ){
			setTimeout( function(){ 
				ds.states.loops.cancelOrder = false
			}, config.bot.rate_limit_timeout )
			
			if ( response == false ){
				log.write( "Cancel order failed, aborting" )
				ds.transaction.state = transaction_state
				callback( false )
			}
			else {
				log.write( "Cancel order completed" )
				// Clear any timers
	            if ( ds.states.loops.monitorOpenBoughtSetTimeout )
	                clearTimeout( ds.states.loops.monitorOpenBoughtSetTimeout )

	            ds.transaction.state = transaction_state
				callback( response )
			}
		})
	}
	else {
		ds.transaction.state = transaction_state
	}
	
	
	callback( false )
}

exports.cancelOpenBuyOrder = function( callback ){
	
	var transaction_state = ds.transaction.state
	
	if ( 
			ds.buy_order 
				&& 
			ds.states.alarms.open_buy_order
				&&
			!ds.states.loops.cancelOpenBuyOrder
	){
		ds.states.loops.cancelOpenBuyOrder = true
		ds.transaction.state = 0
		this.cancelOrder( ds.buy_order.id, function( response ){
			if ( response.statusCode == 200 ){
				log.write( "Canceled buy order with id " + ds.buy_order.id )
				ds.transaction.state = 1
				ds.states.alarms.open_buy_order = false
				ds.states.alarms.bought = false
				ds.states.buying = false
				ds.buy_order = null
				ds.transaction.buy_price = 0
				ds.transaction.sell_price = 0
			}
			
			else if ( response.statusMessage == "Not Found" ){
				log.write( "Order not found, not sure why... going back to buy cycle" )
				log.write( "Canceled buy order with id " + ds.buy_order.id )
				ds.transaction.state = 1
				ds.states.alarms.open_buy_order = false
				ds.states.alarms.bought = false
				ds.states.buying = false
				ds.buy_order = null
			}
			else {
				log.write( "Cancel order failed, keeping current buy order..." )
				ds.transaction.state = transaction_state
			}
			
			ds.states.loops.cancelOpenBuyOrder = false
		})
	}
}

exports.buy = function( price, amount, buy_type, callback ){
	
	var transaction_state = ds.transaction.state
	
	if ( !ds.states.buying ){
		ds.states.buying = true
		ds.transaction.buy_price = price 
		ds.transaction.state = 0
		
		gdax.buy( price, amount, buy_type, function( response ){
			
			setTimeout( function(){ 
				ds.states.buying = false
			}, config.bot.rate_limit_timeout )
			
			if ( response == false ){
				log.write( "Failed to place a buy" )
				
				ds.transaction.state = transaction_state
				callback( false )
			}
			else {
				// Clear any timers
	            if ( ds.states.loops.monitorOpenBoughtSetTimeout )
	                clearTimeout( ds.states.loops.monitorOpenBoughtSetTimeout )
	            
	            ds.transaction.state = transaction_state
				callback( response )
			}
		})
	}
}

exports.sell = function( price, amount, buy_type, callback ){

	var transaction_state = ds.transaction.state
	
	if ( !price || price == "undefined" ){
		log.write( "Price is undefined, can't sell" )
		callback( false )
	}
	else if ( !ds.states.selling ){
		ds.states.selling = true
		ds.transaction.state = 0
		
		gdax.sell( price, amount, buy_type, function( response ){
			setTimeout( function(){ 
				ds.states.selling = false
			}, config.bot.rate_limit_timeout )
			
			if ( response == false ){
				log.write( "Failed to sell " + amount + " @ " + price + ". Will stay in sell cycle and try again.")
				ds.transaction.state = transaction_state
				callback( false )
			}
			else {
				// Clear any timers
				log.write( "Sell successful" )
	            if ( ds.states.loops.monitorOpenBoughtSetTimeout )
	                clearTimeout( ds.states.loops.monitorOpenBoughtSetTimeout )
	            
	            ds.transaction.state = transaction_state
				callback( response )
			}
		})
	}
}

exports.getOrder = function( price, amount, callback ){
	
	var transaction_state = ds.transaction.state
	
	if ( !ds.states.loops.getOrder ){
		ds.states.loops.getOrder = true
		gdax.getOrder( price, amount, function( response ){
			setTimeout( function(){ 
				ds.states.loops.getOrder = false
			}, config.bot.rate_limit_timeout )
			if ( response == false ){
				log.write( "Failed to get order details")
				
				ds.transaction.state = transaction_state
				callback( false )
			}
			else {
				log.write( "Getting order info" )
				ds.transaction.state = transaction_state
				callback( response )
			}
		})
	}
}

exports.setState = function( state, callback ){
	if ( state ){
		ds.transaction.state = state
	}
}

exports.getHistory = function( seconds, gran, callback ){
	timestamp = Date.now()/1000|0
	start_seconds = timestamp - seconds

	params = {
			"start": new Date( start_seconds * 1000 ),
			"end": new Date(),
			"granularity": parseFloat( gran )
	}
	
	if ( !ds.states.loops.getHistory ) {
		ds.states.loops.getHistory = true
		
		gdax.getHistory( params, function( data ){
			setTimeout( function(){
				ds.states.loops.getHistory = false
			}, config.bot.rate_limit_timeout )
			ds.stats.ticker.history = data
		})
	}
}

exports.setCheckBuy = function( callback ){
	
	// Set check buy alarm
	
	if ( config.bot.buy_type == "market" ){
		if ( 
				(
					parseFloat( ds.trend.downchange_total ).toFixed(2) 
							+
					( 
						parseFloat( ds.trend.downchange_total * .01 ).toFixed(2)
					)
						>
				    ds.transaction.buy_threshold
				)
				
			    	&&
			    	
			    ds.trend.state == 1 
			    
		){
			ds.states.alarms.check_buy = true
		}
	}
		
		
	else if ( config.bot.buy_type == "limit" ){
		
		if ( ds.stats.total_slope_rate && ds.trend.state == 2 ){
			if ( 
					ds.stats.total_slope_rate 
						> 
					f.addPercent( config.bot.slope_limit_order_threshold, .01 )
			){
				
				ds.states.alarms.check_buy = true
			}
		}
	}
	else {
		ds.states.alarms.check_buy = false
	}
	
}

/*
 * Monitor open buys and reset them if not filled in time
 */
exports.monitorOpenBuyOrder = function( callback ){
	// If there's an open sale, we check the status of the fill. If a fill has not occured after config.bot.open_buy_order_stale
	// has passed, then we cancel the sale and then re-order it. 
	// The re-order will be done with the following conditions:
	//
	// 1) Get the current price. If it is within config.bot.open_buy_order_reset_threshold percent, then hold off on the reset.
	// 2) If it is greater than the condition above, get the optimal price using the current price as a baseline,
	//    and re-order using those parameters.
	var self = this
	var timeout
	
	//ds.test_field = ds.states.loops.monitorOpenBuyOrder + " && " +  ds.transaction.state == transaction_state + " && " +  ds.buy_order.id
	if ( !ds.states.loops.monitorOpenBuyOrder
			&&
		 ds.transaction.state == 5
		 	&&
		 ds.buy_order
	){
		ds.states.loops.monitorOpenBuyOrder = true
		
		timeout = setTimeout( function(){
			
			// Why again? Because after a sale is made, the state may have changed during the timeout and this executes when it technically shouldn't.
			if ( 
					ds.transaction.state == 5
						&&
					ds.buy_type == "limit"
			){
				current_price_mod = parseFloat( ds.stats.ticker.price ) - parseFloat( ds.stats.sinkrate_price )
				log.write( "Checking if we should cancel current buy order and re-order... (" + ds.buy_order.price + " < " + current_price_mod + ")" )
				if ( 
						ds.buy_order.price < current_price_mod 
							||
						ds.states.buy_hold
				){
					
					// Cancel the current order and make a new one
					
					// Check if order still valid and has not filled
					if ( ds.transaction.state == 5 ){
						
						if ( !ds.states.loops.cancelOrder ){
							
							self.cancelOrder( ds.buy_order.id, function( state ){
								
								if ( state ){
									log.write( "Canceled order with id " + ds.buy_order.id )
									
									// We need to re-engage a buy.
									//var price = f.setBuyThreshold( ds.stats.ticker.price )
									var price = ( parseFloat( ds.stats.ticker.price ) - parseFloat( ds.stats.sinkrate_price ) )
											
									if ( !ds.states.buy_hold ){
										log.write( "Re-ordering for price $" + price )
										self.buy( price, ds.transaction.buy_amount, config.bot.buy_type, function( response ){
											if ( response == false ){
												ds.transaction.state = 5
												log.write( "Re-order failed, will try to buy current order" )
											}
											else {
												ds.transaction.state = 5
												ds.states.alarms.reBought = true
												ds.states.order_added_to_db = false
												log.write( "Placed a new limit order for $" + config.bot.buy_amount + " of coins at " + ds.states.last_buy_price )
											}
										})

									}
									else {
										ds.transaction.state = 1
										ds.states.alarms.open_buy_order = false
										ds.states.alarms.bought = false
										ds.states.buying = false
										ds.buy_order = null
										ds.transaction.buy_price = 0
										ds.transaction.sell_price = 0
										log.write( "Unable to cancel buy order, will retry again next opportunity" )
									}
	
									
								}
								else {
									log.write( "Cancel order failed, keeping current order..." )
									ds.transaction.state = 5
								}
							})
						}
					}
				}
			}
			else if ( config.bot.buy_type == "curve" ){
				
				if ( ds.transaction.state == 5 ){
					
					log.write( "Too much time has passed without filling, canceling buy order" ) 
					self.cancelOpenBuyOrder()
				}
			}
			else {
				clearTimeout( timeout )
			}
			
			ds.states.loops.monitorOpenBuyOrder = false
		}, config.bot.open_buy_order_stale * 1000 )
	}
}

exports.monitorOpenSellOrder = function( callback ){
	// We need to decide how to recover if the sale looks like it won't happen anytime soon.
	//
	// Start checking for open sales and how long they have been open. Start checking after config.bot.sell_order_check_interval.
	//
	// If the price difference is greater than config.bot.sell_order_instant_recover_threshold, then check if selling instantly
	// would lose more than config.bot.acceptable_loss. If it is within the threshold, go into a state
	// where the order is made at config.bot.sell_order_instant_recover_rebuy_price. Check this sales status 
	// every config.bot.sell_order_instant_recover_interval. Otherwise, stay in the sales state and revert the flag for 
	// config.bot.sell_order_instant_recover_interval to config.bot.sell_order_check_interval
	//
	// If the price difference is less than config.bot.sell_order_instant_recover_threshold, then cancel the order and re-order
	// at a price that is sell_order_recover_rebuy_price of the original buy price. 
	// 
		
	if ( !ds.states.loops.monitorOpenSellOrder
			&&
		ds.transaction.state == 7
	){
		ds.states.loops.monitorOpenSellOrder = true
		var self = this
		
		
		ds.states.loops.monitorOpenSellOrderTimer = setTimeout( function(){
			if ( ds.transaction.state == 7 ){
				log.write( "Checking if we should cancel sell order and replace it...")
				
				if ( config.bot.buy_type == "limit" ){
					// Get the difference between the current price and the last sell order price
					var price_difference = parseFloat( ds.sell_order.price ) - parseFloat( ds.stats.ticker.price )
					var instant_sell_price_difference = ( parseFloat( ds.sell_order.price ) * ( parseFloat( config.bot.sell_order_instant_recover_threshold ) / 100 ) )
					var sell_price_difference =  ( parseFloat( ds.sell_order.price ) * ( parseFloat( config.bot.sell_order_recover_threshold ) / 100 ) )
					
					function reOrder( margin ){	
						
						// Get the new price we want to sell at
						ds.states.profit_adjusted = ( parseFloat( ds.states.profit_adjusted ) * ( parseFloat( margin ) / 100 ) )
						var new_price = parseFloat( ds.stats.ticker.price ) + parseFloat( ds.states.profit_adjusted )
		
						// Get the profit or loss
						var new_price_profit = f.getProfitBetweenPrices( ds.transaction.sell_price, ds.stats.ticker.price, config.bot.buy_amount )
						
						log.write( "Checking if new profit exceeds maximum loss... (" + new_price_profit + " > " + ( parseFloat( config.bot.acceptable_loss ) * -1 ) + ")" )
		
						if ( 
								parseFloat( new_price_profit ) > ( parseFloat( config.bot.acceptable_loss ) * -1 )
								
						){
							// Cancel order
							self.cancelOrder( ds.sell_order.id, function(){
								log.write( "Canceling sell order since it looks stuck, will re-order to sell at $ " + new_price + " with a profit/loss of " + new_price_profit )
								ds.states.alarms.open_sell_order = false
								
								ds.transaction.buy_price = 0
								ds.transaction.sell_price = 0
													
								if ( config.bot.sell_order_recover_rebuy ){
									// Rebuy sell order
									
									// Possible bug where buying too soon after a cancel fails, possibly
									// because of rate limiting. Control when the next buy executes
									setTimeout( function( response ){
										if ( response == false ){
											log.write( "Cancel order failed during auto-recovery, going back to sales cycle")
											ds.transaction.state = 7
										}
										self.sell( new_price, ds.sell_order.size, config.bot.buy_type, function( response ){
											ds.transaction.state = 7
											ds.states.order_added_to_db = false
											ds.transaction.sell_price = new_price
											log.write( "Canceled order and reordered to sell at $" + new_price + " with a difference of " + new_price_profit )
											return true
										})
									}, config.bot.rate_limit_timeout )
								}
							})
						}
						else {
							log.write( "Loss exceeds acceptable loss, aborting cancel")
							ds.transaction.state = 7
							return false
						}
					}
					
					
					log.write( "Checking sell price creep (" + price_difference + " > " + sell_price_difference + ")" )
		
					// check for an instant selloff
					if ( price_difference > instant_sell_price_difference ){
						log.write( "Instant selloff detected!" )
						
						// Set flag for instant sell
						ds.states.alarms.instant_sell = true
						
						// Set the new interval rate
						ds.states.sell_order_interval = config.bot.sell_order_instant_recover_interval
						
						// Cancel
						reOrder( config.bot.sell_order_instant_recover_rebuy_price )
						
		
					}
					else if ( price_difference > sell_price_difference ){
						log.write( "Canceling and re-ordering sell order")
						ds.states.alarms.instant_sell = false
						
						// Set the new interval rate
						ds.states.sell_order_interval = config.bot.sell_order_instant_recover_interval
		
						// Rebuy sell order
						reOrder( config.bot.sell_order_recover_rebuy_price )
					}
					else {
						// Make sure interval is reset to normal
						ds.states.sell_order_interval = config.bot.sell_order_check_interval
						
						// reset flags
						ds.states.alarms.instant_sell = false
					}
				}
				else if ( config.bot.buy_type == "curve" ){
					log.write( "Too much time has passed without filling, canceling sell order")
					self.cancelOrder( ds.sell_order.id, function( state ){
						if ( state ){
							log.write( "Canceled sell order with id " + ds.buy_order.id )
							ds.transaction.state = 5
							ds.transaction.buy_price = 0
							ds.transaction.sell_price = 0
							ds.states.alarms.open_buy_order = false
							ds.states.buying = false
							ds.sell_order = null
							
							ds.states.alarms.bought = true
							ds.states.alarms.sold = false
							ds.states.alarms.check_buy = false
						}
						else {
							log.write( "Cancel order failed, keeping current sell order..." )
							ds.transaction.state = 7
						}
					})
				}
				
				ds.states.loops.monitorOpenSellOrder = false
			}
		}, ds.states.sell_order_interval * 1000 )
	}
}

exports.monitorOpenBought = function( callback ){
	// Monitor orders that were "bought" and looking to sell
	//
	// If an oder was filled and is in bought state, it is waiting ot be sold. Check for stuck bought states
	// every config.bot.open_bought_check_interval and if the price falls lower than config.bot.open_bought_instant_sell_threshold percent,
	// then do an immediate market sell.
	var self = this
	
	if (
			config.bot.monitor_open_bought
				&&
			!ds.states.loops.monitorOpenBought
				&&
			ds.transaction.state == 8
	){
		ds.states.loops.monitorOpenBought = true		
		ds.states.loops.monitorOpenBoughtSetTimeout = setTimeout( function(){
			
			var state = ds.transaction.state
			ds.transaction.state = 0
			
			log.write( "Checking if we should sell immediately due to price drift..." )
			log.write( ( parseFloat( ds.transaction.last_buy_price ) - parseFloat( ds.stats.ticker.price ) ) + " > " + ( parseFloat( ds.transaction.last_buy_price ) * ( parseFloat( config.bot.open_bought_instant_sell_threshold ) / 100 ) ) )
			  
			if ( 
					( parseFloat( ds.transaction.last_buy_price ) - parseFloat( ds.stats.ticker.price ) )
						>
					( parseFloat( ds.transaction.last_buy_price ) * ( parseFloat( config.bot.open_bought_instant_sell_threshold ) / 100 ) )
					
			){
				// Do a market buy and nullify orders, change state
				log.write( "Within threshold, will do instant sell to get back on track" )
				
				
				// Set buy type to market
				var price = ds.stats.ticker.price
				self.sell( price, ds.transaction.coins, "market", function( response ){
					if ( response ){
						ds.transaction.state = 4
						ds.states.alarms.open_sell_order = false
						ds.states.order_added_to_db = false
						ds.states.alarms.check_sold = false
						ds.states.alarms.check_buy = false
						ds.states.alarms.bought = false
						ds.transaction.sell_price = price

						//ds.sell_order = null
						
						log.write( "Instant order sold, going back to fill" )
					}
					else {
						log.write( "Failed to instant sell, will retry again if applicable" )
						ds.transaction.state = state
					}
				})
			}
			else {
				ds.transaction.state = state
			}
			
			ds.states.loops.monitorOpenBought = false
		}, parseFloat( config.bot.open_bought_check_interval ) * 1000 )
		
	}
		
}

exports.monitorLiveProfit = function( callback ){
	var self = this
	
	if ( 
			ds.transaction.state == 8
				&&
			!ds.states.loops.monitorLiveProfit
				&&
			parseFloat( ds.states.live_profit )
				> 
			(
					parseFloat( ds.transaction.last_buy_price ) * ( parseFloat( config.bot.profit_pct ) / 100 )
			)
	){
		var prev_price = ds.states.live_profit
		setTimeout( function(){
			// If price is still the same as before, throw in a sell order
			if ( 
					ds.transaction.state == 8
						&&
					parseFloat( ds.states.live_profit ) <= parseFloat( prev_price ) 
			){
				log.write( "Live profit has stalled, throwing in a sell order")
				// Sell order
				ds.transaction.sell_price = parseFloat( parseFloat( ds.stats.ticker.price ) + parseFloat( config.bot.curve_sell_price ) ).toFixed(2)
				ds.transaction.state = 6
				ds.states.alarms.bought = true
				ds.states.live_profit = 0
				
				// Clear stale sell timeout
				if ( ds.states.loops.curve_sale_stale )
					clearTimeout( ds.states.loops.curve_sale_stale )
			}
			
			ds.states.loops.monitorLiveProfit = false
		}, config.bot.sell_order_live_profit_stale * 1000 )
	}
}

exports.dropRecovery = function( callback ){

	var self = this
	
	// If we have an open order, we will check if the price falls belows config.bot.drop_recovery_threshold
	// and instant sell any bought or open sell items
	if ( 
			config.bot.drop_recovery
				&&
			!ds.states.loops.dropRecovery
	){
		
		ds.states.loops.dropRecovery = true
	
		// Check open bought
	
		//ds.test_field = "range: " + ( parseFloat( ds.stats.ticker.price )	+ " < " + ( parseFloat( ds.transaction.sell_price ) - ( parseFloat( ds.transaction.sell_price ) * ( parseFloat( config.bot.drop_recovery_threshold ) / 100 ) ) ) )

		// Check if we are config.bot.drop_on_hold_recovery_threshold percent from last buy price and on hold
		if (	(
					parseFloat( ds.stats.ticker.price )
						<
					(
							parseFloat( ds.transaction.buy_price )
								-
							( parseFloat( ds.transaction.buy_price ) * ( parseFloat( config.bot.drop_on_hold_recovery_threshold ) / 100 ) )
					)
				)
					&&
				ds.states.buy_hold
					&&
				ds.stats.ticker.price
		){
			if (
					ds.transaction.state == 7
						||
					ds.transaction.state == 8 
			){
				this.instantCancelandSell( function( response ){
					//log.write( parseFloat( ds.stats.ticker.price )	+ " < " + ( parseFloat( ds.transaction.sell_price ) - ( parseFloat( ds.transaction.sell_price ) * ( parseFloat( config.bot.drop_recovery_threshold ) / 100 ) )) )
					
					log.write( "Sold due to buy hold drop recovery, price fell below " + config.bot.drop_on_hold_recovery_threshold + "%" )
					self.instantCancelandSell( function( response ){
						ds.transaction.consecutive_sells = 0
					} )
					self.buy_hold( config.bot.drop_recovery_buy_hold, function( response ){} )
					//self.countdown( config.bot.drop_recovery_buy_hold )
					ds.states.loops.dropRecovery = false
				})
			}
			else {
				//self.clearConsecutiveSells( function(){} )
				self.buy_hold( config.bot.drop_recovery_buy_hold, function( response ){} )
			}
		}

		
		// Check if we are config.bot.drop_recovery_threshold percent from last buy price
		else if (
				parseFloat( ds.stats.ticker.price )
					<
				(
						parseFloat( ds.transaction.sell_price )
							-
						( parseFloat( ds.transaction.sell_price ) * ( parseFloat( config.bot.drop_recovery_threshold ) / 100 ) )
				)
		){
			if ( 
					ds.transaction.state == 7
						||
					ds.transaction.state == 8 
			){
				self.instantCancelandSell( function( response ){
					//log.write( parseFloat( ds.stats.ticker.price )	+ " < " + ( parseFloat( ds.transaction.sell_price ) - ( parseFloat( ds.transaction.sell_price ) * ( parseFloat( config.bot.drop_recovery_threshold ) / 100 ) )) )
					
					log.write( "Sold due to drop recovery, price fell below " + config.bot.drop_recovery_threshold + "%" )
					self.instantCancelandSell( function( response ){
						ds.transaction.consecutive_sells = 0
					} )
					self.buy_hold( config.bot.drop_recovery_buy_hold, function( response ){} )
					//self.countdown( config.bot.drop_recovery_buy_hold )
					ds.states.loops.dropRecovery = false
				})
			}
			else {
				//self.clearConsecutiveSells( function(){} )
				self.buy_hold( config.bot.drop_recovery_buy_hold, function( response ){} )
			}
		}
		else {
			ds.states.loops.dropRecovery = false
		}
	}
}

/*
 * Check to see if we need to hold of on any buys
 */
exports.checkBuyHolds = function( callback ){
		var hold = null
	
	// Ensure we have enough history
	// timeout is set here
	if ( ds.trend.price_history ){
		if ( 
				!ds.trend.price_history[config.bot.start_hold_startup_delay]
					||
				(
						config.bot.hold_on_selloff
							&&
						ds.states.alarms.selloff
				)
		){
			hold = true
		}
		else {
			hold = false
		}
	}
		
	// Check alarms
	// Rules for limit
	if ( config.bot.buy_type == "limit" ){
		if (
				hold
					||
				ds.states.alarms.large_drop_detection
		){
			ds.states.buy_hold = true
		}
		else {
			ds.states.buy_hold = false
		}
	}
	
	// Rules for curve type
	if ( config.bot.buy_type == "curve" ){
		if (
				hold
					||
				ds.states.buy_hold_on_slope_rate
					||
				ds.states.buy_hold_on_detectSlopeRate_over
					||
				ds.states.buy_hold_on_detectSlopeRate_under
					||
				ds.states.buy_hold_trigger
					||
				ds.states.alarms.selloff
		){
			ds.states.buy_hold = true
			
			if ( ds.states.alarms.open_buy_order )
				this.cancelOpenBuyOrder( function(){} )
		}
		else {
			ds.states.buy_hold = false
		}
		
		// Check sell hold
		if ( 
				( 
					ds.states.sell_hold_on_slope_rate
						||
					ds.states.sell_hold_on_detectSlopeRate_over
				)
					&&
				ds.buy_order
			){
			ds.states.sell_hold = true
		}
		else {
			ds.states.sell_hold = false
		}
	}
	
	if ( 	
			config.bot.selloff_recovery
				&&
			ds.states.loops.selloff_recover_post_wait_trigger == true
				&&
			ds.states.alarms.selloff == false
	){
		var time = config.bot.selloff_recovery_post_wait_time * 1000
		ds.states.buy_hold = true
		this.countdown( time, function( response ){} )
		setTimeout( function(){
			ds.states.loops.selloff_recover_post_wait_trigger = false
			ds.states.buy_hold = false
		},  time )
		//this.countdown( time, function(){} )
	}
}

exports.clearConsecutiveSells = function( callback ){
	
	if ( parseFloat( ds.stats.ticker.price ) > parseFloat( ds.transaction.consecutive_sell_price ) )
		ds.transaction.consecutive_sell_price = ds.stats.ticker.price
		
    if ( parseFloat( ds.transaction.consecutive_sells ) >= parseFloat( config.bot.consecutive_sell_limit ) ){
       	
		// Check if over config.bot.drop_recovery_buy_hold percent to clear, from
		// last recorded peak price 
		if (		
			 	parseFloat( ds.transaction.consecutive_sells ) > 0
			 		&&
		           (			
		           		parseFloat( ds.stats.ticker.price )
		           			<
		           		(
		           				parseFloat( ds.transaction.consecutive_sell_price )
		           					-
		           				( parseFloat( ds.transaction.consecutive_sell_price ) * ( parseFloat( config.bot.consecutive_sell_limit_threshold ) / 100 ) )
		                )
		           )
		){
		   if (
		                   ds.transaction.state != 7
		                           ||
		                   ds.transaction.state != 8
		   ){
		                   log.write( "Clearing consecutive_sells due to price falling below " + config.bot.drop_recovery_threshold + "%" )
		           ds.transaction.consecutive_sells = 0
		   }
		}
    }
}

/*
 * Check to see if we should hold off on any sells
 */
exports.checkSellHolds = function( callback ){
	
}

exports.checkSellOff = function( callback ){
	var self = this
	
	if ( 
			config.bot.selloff_recovery
				&&
			!ds.states.loops.selloff_recovery_wait_time
				&&
			ds.states.alarms.selloff
	){	
		ds.states.loops.selloff_recovery_wait_time = true
		setTimeout( function(){
			// If still in selloff after timeout...
			if ( ds.states.alarms.selloff ){
			
				log.write( "Selloff detected! Cancel all buy orders and sell all open sell orders." )
				/*
				 * Cancel order on selloff
				 */
				if ( 
						ds.transaction.state == 2
							||
						ds.transaction.state == 5
							||
						ds.transaction.state == 7
							||
						ds.transaction.state == 8
				){
					var new_price_profit = f.getProfitBetweenPrices( ds.transaction.buy_price, ds.stats.ticker.price, config.bot.buy_amount )
					
					log.write( "Checking if instant selloff exceeds emergency maximum loss... (" + new_price_profit + " > " + ( parseFloat( config.bot.sell_order_emergency_instant_recover_max_loss ) * -1 ) + ")" )
			
					if ( parseFloat( new_price_profit ) > ( parseFloat( config.bot.sell_order_emergency_instant_recover_max_loss ) * -1 ) ){
						log.write( "Will try to market sell @" + ds.stats.ticker.price )
						this.instantCancelandSell( function( response ){} )
						this.buy_hold( config.bot.selloff_recovery_post_wait_time, function( response ){} )
						ds.states.loops.selloff_recovery_wait_time = false
					}
				}
			}
			else {
				ds.states.loops.selloff_recovery_wait_time = false
			}
			
		}, parseFloat( config.bot.selloff_recovery_wait_time * 1000 ) )
	}
}

exports.instantCancelandSell = function( callback ){
	var self = this
	
	if ( !ds.states.loops.instantCancelAndSell ){
		ds.states.loops.instantCancelAndSell = true
		
		/*
		 * Close any open buy orders immediately
		 */
		if ( ds.transaction.state == 5 ){
			var buy_order_id = ds.buy_order.id
			self.cancelOrder( ds.buy_order.id, function( response ){
				if ( response == false ){
					log.write( "Canceling on selloff failed!" )
				}
				else {
					log.write( "Canceled buy order " + buy_order_id + " due to selloff" )
					
					// Back to buy cycle
					ds.buy_order = null
					ds.states.alarms.open_buy_order = false		
					ds.transaction.state = 1
					ds.transaction.buy_price = 0
					ds.transaction.sell_price = 0
				}
				
				ds.states.loops.instantCancelAndSell = false
				callback( response )
			})
		}
	
	
		/*
		 * Sell any bought orders immediately
		 */
		var sell = function( _callback ){ 						
			// store the current buy type
			var return_response
			
			var price = ds.stats.ticker.price
			// Set buy type to market		
			self.sell( price, ds.transaction.coins, "market", function( response ){
				if ( response ){
					ds.transaction.state = 4
					ds.states.alarms.open_sell_order = false
					ds.states.order_added_to_db = false
					ds.states.alarms.check_sold = false
					ds.states.alarms.check_buy = false
					ds.states.alarms.bought = false
					ds.transaction.sell_price = price
					ds.transaction.consecutive_sells = 0
					
					return_response = response
					
					log.write( "Instant order sold, moving to fill" )
				}
				else {
					log.write( "Failed to instant sell " + ds.transaction.coins + " @" + price )
				}
				
				_callback( return_response )
			})
		}
	
		if ( 
					ds.transaction.state == 2
						||
					ds.transaction.state == 7
						||
					ds.transaction.state == 8
		){
			// Do a market sell of any open order
			// Sell and get back what we can. Do not sell beyond 
			// Calculate the loss, if within the loss threshold, sell it sell_order_emergency_instant_recover_max_loss

				
			if ( ds.transaction.state == 7 ){
				// We need to cancel the open sell order first
				log.write( "Need to cancel sell order first")
				self.cancelOrder( ds.sell_order.id, function( response ){
					if ( response ){
						log.write( "Canceled sell order " + ds.sell_order.id )
						
						ds.transaction.buy_price = 0
						ds.transaction.sell_price = 0
						
						// Try to market sell
						sell( function( response ){
							
							if ( !response ){
								log.write( "Failed to sell, will try again next cycle" )
							}
							else if ( response == true ){
								log.write( "Sell successful" )
							}
							
							ds.states.loops.instantCancelAndSell = false
							callback( response )
						})
					}
					else {
						log.write( "Canceling failed! Will try again next cycle" )
						ds.states.loops.instantCancelAndSell = false
						callback( false )
					}
				})
			}
			else {	
				// Try to market sell
				log.write( "Going to sell bought coins" )
				sell( function( response ){
					if ( !response ){
						log.write( "Failed to sell, will try again next cycle" )
					}
					else if ( response == true ){
						log.write( "Sold outstanding coins, going back to buy state" )
					}
					
					ds.states.loops.instantCancelAndSell = false
					callback( response )
				})
			}
		}
	}
	
	callback( true )
}

exports.buy_hold = function( hold_time, callback ){
	// Hold time is in seconds, not ms
	ds.states.buy_hold_trigger = true
	var time = parseFloat( hold_time ) * 1000
	log.write( "Holding for " + hold_time + " seconds..." )
	
	if ( ds.states.loops.buy_hold ){
		clearTimeout( ds.states.loops.buy_hold )
	}
	
	this.countdown( time, function( response ){} )
	ds.states.loops.buy_hold = setTimeout( function(){
		ds.states.buy_hold_trigger = false
		ds.states.loops.buy_hold = false
		
		if ( ds.states.buy_hold_timer ){
		    clearInterval( ds.states.buy_hold_timer );
		    ds.states.alarms.buy_hold_timer = null
		    ds.states.buy_hold_timer = null
		}
	}, time )
	
	callback( true )
}

exports.cancel_buy_hold = function( callback ){
	if ( ds.states.loops.buy_hold ){
		clearTimeout( ds.states.loops.buy_hold )
	
	if ( ds.states.buy_hold_timer ){
	    clearInterval( ds.states.buy_hold_timer );
	    ds.states.alarms.buy_hold_timer = null
	    ds.states.buy_hold_timer = null
	}
		
	ds.states.buy_hold_trigger = false
	ds.states.loops.buy_hold = false
		
		callback( true )
	}
	else {
		callback( false )
	}
}

exports.countdown = function( time, callback ){
	var countDownDate = new Date( new Date().getTime() + time );

	if ( ds.states.buy_hold_timer ){
	    clearInterval( ds.states.buy_hold_timer );
	    ds.states.alarms.buy_hold_timer = null
	    ds.states.buy_hold_timer = null
	}
		
	// Update the count down every 1 second
	ds.states.buy_hold_timer = setInterval(function() {

	  // Get todays date and time
	  var now = new Date().getTime();

	  // Find the distance between now an the count down date
	  var distance = countDownDate - now;
	  ds.states.loops.buy_hold_timer = distance;

	  // Time calculations for days, hours, minutes and seconds
	  var days = Math.floor(distance / (1000 * 60 * 60 * 24));
	  var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	  var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
	  var seconds = Math.floor((distance % (1000 * 60)) / 1000);

	  // Display the result in the element with id="demo"
	  ds.states.alarms.buy_hold_timer = hours + "h "
	  + minutes + "m " + seconds + "s ";

	  // If the count down is finished, write some text 
	  if (distance < 0) {
	    clearInterval( ds.states.buy_hold_timer );
	    ds.states.alarms.buy_hold_timer = null
	    ds.states.buy_hold_timer = null
	  }
	}, 1000)
	
	callback( true )
}

exports.logSlopes = function( callback ){
	log.write("SLOPES:\n" +
			"\t     1MIN SLOPE: " + ds.stats.oneMin_slope_rate + "\n" +
			"\t     5MIN SLOPE: " + ds.stats.fiveMin_slope_rate + "\n" +
			"\t	   15MIN SLOPE: " + ds.stats.tactical_slope_rate + "\n" +
			"\t    30MIN SLOPE: " + ds.stats.halfHr_slope_rate + "\n" +
			"\t      1HR SLOPE: " + ds.stats.oneHr_slope_rate + "\n" +
			"\t      2HR SLOPE: " + ds.stats.twoHr_slope_rate + "\n" +
			"\t      3HR SLOPE: " + ds.stats.threeHr_slope_rate + "\n" +
			"\t      4HR SLOPE: " + ds.stats.fourHr_slope_rate + "\n" +
			"\t     LAST SLOPE: " + ds.stats.last_slope_rate + "\n" +
			"\t  AVERAGE SLOPE: " + ds.stats.avg_slope_rate
			)
	
	callback( true )
}
