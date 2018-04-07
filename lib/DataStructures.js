/*
 * Holds trending data
 */
var config = require( "../bitbot.js" ).config
if ( config.bot.dynamic_config ){
	// Add a timeout so we're not reading the fs every millisecond
	setInterval( function(){
		config = require( "../bitbot.js" ).config
	}, 500 )
}

const log = require( "../bitbot.js" ).log
const db = require('./Db.js')
const crypto = require('crypto');


data = {
		
		trend: {
			"state": 0,
			"price": 0,
			"states": {
				0: "flat",
				1: "up",
				2: "down"
			},
			"flap": {
				"up": 0,
				"down": 0,
				"flat": 0
			},
			"upchange": 0,
			"downchange": 0,
			"upchange_total": 0,
			"downchange_total": 0,
			"last_price": 0,
			"max_uptick": 0,
			"max_downtick": 0,
			"threshold": 0,
			"slope_interval": 500,
			"price_history": [],
			"volatility": {
				"spike": 0,
				"large_spike": 0,
				"drop": 0,
				"large_drop": 0
			},
			"curves": {
				"price_bottom": 0,
				"last_price_bottom": 0,
				"price_peak": 0,
				"last_price_peak": 0,
				"last_price": 0,
				"price_history": [],
				"peaks": [],
				"bottoms": []
			}
			
		},
		
		/*
		 * Holds transactional data
		 */
		transaction: {
				"state": 0,
				"states": {
					0: "hold",
					1: "buy",
					2: "sell",
					3: "buy_fill",
					4: "sell_fill"
				},
				"last_buy_price": 0,
				"last_sell_price": 0,
				"buy_amount": 0,
				"buy_fee": 0,
				"sell_fee": 0,
				"coins": 0,
				"buy_price": 0,
				"sell_price": 0,
				"buy_price": 0,
				"earnings": 0,
				"total_earnings": 0,
				"buy_threshold": 0,
				"buy_order_response": false,
				"sell_order_response": false,
				"cancel_order_response": false,
				"get_order_response": false,
				"consecutive_sells": 0,
				"consecutive_sell_price": 0,
				"rejected_price": 0,
				"sell_retry": 0,
				"buy_reason": false,
				"sell_reason": false
		},
		
		states: {
			"alarms": {
				"check_buy": false,
				"check_sell": false,
				"climb_ladder": false,
				"bought": false,
				"reBought": false,
				"sold": false,
				"drop_detection": false,
				"large_drop_detection": false,
				"spike_detection": false,
				"large_spike_detection": false,
				"open_buy_order": false,
				"instantSell": false,
				"price_history_warning": false,
				"drop_warning": false,
				"drop_started": false,
				"dropping": false,
				"bottom_close": false,
				"bottom_reached": false,
				"rise_warning": false,
				"rise_started": false,
				"rising": false,
				"peak_close": false,
				"peak_reached": false,
				"selloff": false,
				"curve_decrement": false
			},
			
			"loops": {
				"monitorOpenBuyOrder": false,
				"monitorOpenBuyOrderTimer": false,
				"monitorOpenSellOrder": false,
				"monitorOpenSellOrderTimer": false,
				"monitorOpenBought": false,
				"monitorOpenBoughtTimer": false,
                "monitorOpenBoughtSetTimeout": false,
                "monitorLiveProfit": false,
                "dropRecovery": false,
				"cancelOrder": false,
				"cancelOpenBuyOrder": false,
				"dropDetection": false,
				"spikeDetection": false,
				"getOrder": false,
				"getHistory": false,
				"spike_detection": false,
				"large_spike_detection": false,
				"drop detection": false,
				"large_drop_detection": false,
				"selloff_recovery_wait_time": false,
				"selloff_recover_post_wait_trigger": false,
				"curve_sale_stale": false,
				"instantCancelAndSell": false,
				"buy_hold": false,
				"buy_hold_timer": false
			},
			
			"curves": {
				"dropping": false,
				"rising": false
			},
			
			"deciding": false,
			"buy_hold": false,
			"buy_hold_timer": null,
			"buy_hold_trigger": false,
			"sell_hold": false,
			"last_buy_price": 0,
			"last_sell_price": 0,
			"getOrder": false,
			"buying": false,
			"selling": false,
			"order_added_to_db": false,
			"order_updated_to_db": false,
			"sell_order_interval": false,
			"proft_adjusted": config.bot.profit_usd,
			"live_profit": 0,
			"hold_on_slope_rate_over": false,
			"hold_on_slope_rate_under": false,
			"slope_rate_over": false,
			"slope_rate_under": false,
			"buy_hold_on_slope_rate": false,
			"sell_hold_on_slope_rate: false": false,
			"buy_hold_on_detectSlopeRate": false,
			"sell_hold_on_detectSlopeRate": false,
			"buy_hold_on_slope_detectSlopeRate_over": false,
			"sell_hold_on_slope_detectSlopeRate_under": false,
			"slope_type": "start",
			"last_slope_type": "over",
			"screenClear": false
		},
		states_history: [],
		
		stats: {
			"ticker": {
				"price": 0,
				"history": null
			},
			"sinkrate_price": 0,
			"tactical_slope_rate": 0,
			"oneMin_slope_rate": 0,
			"fiveMin_slope_rate": 0,
			"halfHr_slope_rate": 0,
			"oneHr_slope_rate": 0,
			"twoHr_slope_rate": 0,
			"threeHr_slope_rate": 0,
			"fourHr_slope_rate": 0,
			"last_slope_rate": 0,
			"total_slope_rate": 0,
			"avg_slope_rate": 0,
			"oneHr_avg_slope_rate": 0,
			"twoHr_avg_slope_rate": 0,
			"threeHr_avg_slope_rate": 0,
			"fourHr_avg_slope_rate": 0,
			"halfHr_avg_slope_rate": 0
			
		},
		
		status_codes: {
				"400": "Bad Request",
				"401": "Unauthorized",
				"403": "Forbidden",
				"404": "Not Found",
				"500": "Internal Server Error",
				"getOrder_response": false
		},

		test_order: {
				"id": "0",
				"price": "0",
				"size": "0",
				"product_id": "BTC-USD",
				"side": null,
				"stp": "",
				"type": "market",
				"time_in_force": "",
				"post_only": false,
				"created_at": "",
				"fill_fees": "0",
				"filled_size": "0",
				"executed_value": "0",
				"status": "done",
				"settled": true
		},

//		test_sell: {
//				"id": "0",
//				"price": "0",
//				"size": "0",
//				"product_id": "BTC-USD",
//				"side": "buy",
//				"stp": "",
//				"type": "market",
//				"time_in_force": "",
//				"post_only": false,
//				"created_at": "",
//				"fill_fees": "0",
//				"filled_size": "0",
//				"executed_value": "0",
//				"status": "done",
//				"settled": true
//		},
		
		gdax: {
			websocket: null,
			ticker: {
			    "type": null,
			    "trade_id": null,
			    "sequence": null,
			    "time": null,
			    "product_id": null,
			    "price": null,
			    "side": null, // Taker side
			    "last_size": null,
			    "best_bid": null,
			    "best_ask": null
			}
		},
		
		//buy_orders: [],
		//sell_orders: [],
		buy_order: null,
		sell_order: null,
		log: null,
		products: {
			"Bitcoin": [
				'BTC-USD'
			],
			
			"Litecoin": [
				'LTC-USD'
			],
			
			"Etherium": [
				'ETH-USD'
			],
			
			"Bitcoin Cash": [
				'BCH-USD'
			]
		},
		
		display: {
			"layout": null,
			"screen": null
		},
		
		bot_id: crypto.createHash('md5').update( config.bot.bot_id ).digest("hex"),
		test_field: null
}		

exports.data = data

/*
 * This creates an order to stash into mongo
 */
exports.createOrder = function( order, status, callback ){
	var states = {
		"bot_id": this.data.bot_id,
		"date": new Date().toISOString(),
		"transaction": this.data.transaction,
		"order": order,
		"states": this.data.states,
		"status": status
	}
	
	// Reset stuff we don't need
	states.states.loops = {}
	
	callback({
		states
	})
}

exports.getStatsParams = function( side, callback ){
	
	var order = null;
	if ( side == "buy" ){
		order = data.buy_order
	}
	else if ( side == "sell" ){
		order = data.sell_order
	}
	
	var params = {
		"oneMin_slope_rate": data.stats.oneMin_slope_rate,
		"fiveMin_slope_rate": data.stats.fiveMin_slope_rate,
		"tactical_slope_rate": data.stats.tactical_slope_rate,
		"halfHr_slope_rate": data.stats.halfHr_slope_rate,
		"oneHr_slope_rate": data.stats.oneHr_slope_rate,
		"twoHr_slope_rate": data.stats.twoHr_slope_rate,
		"threeHr_slope_rate": data.stats.threeHr_slope_rate,
		"fourHr_slope_rate": data.stats.fourHr_slope_rate,
		"oneHr_slope_avg": data.stats.oneHr_avg_slope_rate,
		"twoHr_slope_avg": data.stats.twoHr_avg_slope_rate,
		"threeHr_slope_avg": data.stats.threeHr_avg_slope_rate,
		"fourHr_slope_avg": data.stats.fourHr_avg_slope_rate,
		"price": order.price,
		"price_diff": ( parseFloat( data.trend.curves.price_peak ) - parseFloat( data.stats.ticker.price ) ),
		"sink_rate": data.stats.sinkrate_price,
		"peak_price": data.trend.curves.price_peak,
		"bottom_price": + data.trend.curves.price_bottom,
		"consecutive_sell":  data.transaction.consecutive_sells,
		"upchange_total": data.trend.upchange_total,
		"downchange_total": data.trend.downchange_total,
		"side": side,
		"earnings": data.transaction.earnings,
		"buy_reason": data.transaction.buy_reason,
		"sell_reason": data.transaction.sell_reason,
		"ticker_price": data.stats.ticker.price
	}

	if ( side == "sell" ){
		if ( parseFloat( data.transaction.earnings ) < 0 ){
			params.status = "^^^ LOSS :("
		}
		else {
			params.status = "^^^ !!! WIN !!!"
		}
	}
	
	callback( params )
}

exports.getTransParams = function( side, callback ){
	
	var order = null
	
	if ( side == "buy" ){
		order = data.buy_order
	}
	else if ( side == "sell" ){
		order = data.sell_order
	}
	
	var params = {
			"usd": order.executed_value,
			"coins": order.amount,
			"price": order.price,
			"type": config.bot.product_id,
			"side": side
	}
	
	callback( params )
}


//Set the starting buy amount

if ( !config.bot.buy_amount ){
	log.write( "Buy amount not defined in config file")
	process.exit()
}
else if ( !config.bot.buy_fee ){
	log.write( "Buy fee not defined in config file")
	process.exit()
}
else if ( ! config.bot.sell_fee ){
	log.write( "Sell fee not defined in config file")
	process.exit()
}
else if ( !config.bot.profit_usd ){
	log.write( "Profit not defined in config file")
	process.exit()
}
else if ( !config.bot.trend_tick_threshold ){
	log.write( "trend_threshold not defined in config file")
	process.exit()
}


data.transaction.buy_amount = config.bot.buy_amount
data.transaction.buy_fee = config.bot.buy_fee
data.transaction.sell_fee = config.bot.sell_fee
data.transaction.profit = config.bot.profit_usd
data.transaction.consecutive_sells = config.bot.consecutive_sell_limit

data.trend.slope_interval = config.bot.slope_interval
data.trend.threshold = config.bot.trend_tick_threshold

data.states.sell_order_interval = config.bot.sell_order_check_interval
data.transaction.sell_retry = parseFloat( config.bot.sell_order_retry )

