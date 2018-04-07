const ds = require( './DataStructures.js' ).data
const log = require( "../bitbot.js" ).log
const charm = require( 'charm' )()
const f = require('./Formulas.js')

var config = require( "../bitbot.js" ).config
if ( config.bot.dynamic_config ){
	// Add a timeout so we're not reading the fs every millisecond
	setInterval( function(){
		config = require( "../bitbot.js" ).config
	}, 500 )
}


charm.pipe( process.stdout )
var states = {}

exports.clear = function( callback ){
	if ( !ds.states.screenClear ){
		process.stdout.write('\033c')
		ds.states.screenClear = true
	}
}

exports.screen = function( callback ){
	
	this.clear()
	charm.cursor( 0 )
	this.arrowUp()
	this.arrowFlat()
	this.arrowDown()
//	this.slope()
	this.price()
	this.consecutiveSells()
	this.slopeRates()
	this.sinkRate()
	this.lastSlopeType()
	this.state()
	this.transState()
	this.totalProfit()
	this.holdTimer()
	this.priceChange()
	this.product()
	this.checkBuy()
	this.checkSell()
	this.openBuyOrder()
	this.openSellOrder()
	this.considerSell()
	this.bought()
	this.sold()
	this.buyHold()
	this.slopeHold()
	this.timeHold()
	
	this.climbLadder()
	this.dropDetection()
	this.spikeDetection()
	this.selloffDetection()
	
	this.curveDrop()
	this.curveRise()
	
	this.testField()
	//this.clearZeroState()
}

exports.price = function( callback ){
	
	
	charm.foreground( "red" )
	charm.position( 10,20 )
	charm.write( "CURRENT PRICE: " )
	
	if ( ds.stats.ticker.price ){
		var price = parseFloat( ds.stats.ticker.price ).toFixed( 2 )
		charm.foreground( "black" )
		charm.position( 25,20 )
		charm.write( "                " )
		charm.position( 25,20 )
		charm.write( price.toString() )
	}
	
	this.reset()
}

exports.consecutiveSells = function( callback ){
	
	
	charm.foreground( "red" )
	charm.position( 6,21 )
	charm.write( "CONSECTUIVE SELLS: " )
	
	if ( ds.stats.ticker.price ){
		var price = parseFloat( ds.stats.ticker.price ).toFixed( 2 )
		charm.foreground( "black" )
		charm.position( 25,21 )
		charm.write( "                " )
		charm.position( 25,21 )
		charm.write( ds.transaction.consecutive_sells + " of " + parseFloat( config.bot.consecutive_sell_limit ).toString() )
	}
	
	this.reset()
}

exports.sinkRate = function( callback ){
	charm.foreground( "red" )
	charm.position( 14,22 )
	charm.write( "SINK RATE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.sinkrate_price ){
		charm.position( 25,22 )
		charm.write( "         " )
		charm.position( 25,22 )
		var price = parseFloat( ds.stats.sinkrate_price ).toFixed( 2 ) + "     "
		charm.write( price.toString() )
	}

	this.reset()
}

exports.lastSlopeType = function( callback ){
	charm.foreground( "red" )
	charm.position( 14,23 )
	charm.write( "HOLD TYPE: " )
	charm.foreground( "black" )
	
	if ( ds.states.slope_type ){
		charm.position( 29,23 )
		charm.write( "                " )
		charm.position( 25,23 )
		var price = ds.states.slope_type.toString() + "            "
		charm.write( price.toString() )
	}

	this.reset()
}

exports.slopeRates = function( callback ){

	charm.foreground( "red" )
	charm.position( 54,16 )
	charm.write( "1MIN SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.oneMin_slope_rate )
		charm.write( ds.stats.oneMin_slope_rate.toString() + "     " )

	this.reset()
	
	
	charm.foreground( "red" )
	charm.position( 54,17 )
	charm.write( "5MIN SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.fiveMin_slope_rate )
		charm.write( ds.stats.fiveMin_slope_rate.toString() + "     " )

	this.reset()

	charm.foreground( "red" )
	charm.position( 53,18 )
	charm.write( "15MIN SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.tactical_slope_rate )
		charm.write( ds.stats.tactical_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 53,19 )
	charm.write( "30MIN SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.halfHr_slope_rate )
		charm.write( ds.stats.halfHr_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 55,20 )
	charm.write( "1HR SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.oneHr_slope_rate )
		charm.write( ds.stats.oneHr_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 55,21 )
	charm.write( "2HR SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.total_slope_rate )
		charm.write( ds.stats.twoHr_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 55,22 )
	charm.write( "3HR SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.total_slope_rate )
		charm.write( ds.stats.threeHr_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 55,23 )
	charm.write( "4HR SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.tactical_slope_rate )
		charm.write( ds.stats.fourHr_slope_rate.toString() + "     " )

	this.reset()
	
	
	charm.foreground( "red" )
	charm.position( 54,24 )
	charm.write( "LAST SLOPE: " )
	charm.foreground( "black" )
	
	if ( ds.stats.tactical_slope_rate )
		charm.write( ds.stats.last_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 54,25 )
	charm.write( "1AVG SLOPE: " )
	charm.foreground( "black" )
	charm.write( ds.stats.oneHr_avg_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 54,26 )
	charm.write( "2AVG SLOPE: " )
	charm.foreground( "black" )
	charm.write( ds.stats.twoHr_avg_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 54,27 )
	charm.write( "3AVG SLOPE: " )
	charm.foreground( "black" )
	charm.write( ds.stats.threeHr_avg_slope_rate.toString() + "     " )

	this.reset()
	
	charm.foreground( "red" )
	charm.position( 54,28 )
	charm.write( "4AVG SLOPE: " )
	charm.foreground( "black" )
	charm.write( ds.stats.avg_slope_rate.toString() + "     " )

	this.reset()
	
	

}

exports.state = function( callback ){
	charm.foreground( "red" )
	charm.position( 18,24 )
	charm.write( "STATE: " )
	charm.foreground( "black" )
	
	if ( ds.trend.state ){
		charm.position( 25,24 )
		charm.write( "    " )
		charm.position( 25,24 )
		charm.write( ds.trend.states[ds.trend.state] )
	}

	this.reset()
}

exports.transState = function( callback ){
	charm.foreground( "red" )
	charm.position( 6,25 )
	charm.write( "TRANSACTION STATE: " )
	charm.foreground( "black" )
	

	charm.position( 25,25 )
	charm.write( "    " )
	charm.position( 25,25 )
	charm.write( ds.transaction.state.toString() )


	this.reset()
}

exports.totalProfit = function( callback ){
	charm.foreground( "red" )
	charm.position( 6,28 )
	charm.write( "     TOTAL PROFIT: " )
	charm.foreground( "black" )
	

	charm.position( 25,28 )
	charm.write( "            " )
	charm.position( 25,28 )
	charm.write( parseFloat( ds.transaction.total_earnings ).toFixed(2).toString() )

	this.reset()
	
	if ( parseFloat( ds.states.live_profit ) > 0 ){
		charm.foreground( 172 )
		charm.position( 6,27 )
		charm.write( "      LIVE PROFIT: " )
		charm.foreground( "black" )
		
	
		charm.position( 25,27 )
		charm.write( "             " )
		charm.position( 25,27 )
		charm.write( parseFloat( ds.states.live_profit ).toFixed(2).toString() )
	}
	else {

		charm.position( 6,27 )
		charm.write( "                   " )
		charm.foreground( "black" )
		
	
		charm.position( 25,27 )
		charm.write( "             " )
		charm.position( 25,27 )

	}

	this.reset()
}

exports.holdTimer = function( callback ){

	if ( ds.states.alarms.buy_hold_timer ){
		charm.foreground( "red" )
		charm.position( 1,29 )
		charm.write( "      BUY HOLD EXPIRES: " )
		charm.foreground( "black" )
		
	
		charm.position( 25,29 )
		charm.write( "             " )
		charm.position( 25,29 )
		charm.write( ds.states.alarms.buy_hold_timer.toString() )
	}
	else {

		charm.position( 1,29 )
		charm.write( "                        " )
		charm.foreground( "black" )
		
	
		charm.position( 25,29 )
		charm.write( "             " )
		charm.position( 25,29 )

	}

	this.reset()
}

exports.arrowUp = function( callback ){
	
	charm.foreground( "black")
	charm.display( "dim" )
	
	if ( ds.trend.state == 1 ){
		charm.foreground( "green")
		charm.display( "bright" )
	}
	
	// Arrow
	charm.position( 20,10 )
	charm.write( "*" )
	charm.position( 15,11 )
	charm.write("************")
	charm.position( 9,12 )
	charm.write("********** " + ds.trend.flap.up + "  **********")
	charm.position( 5,13 )
	charm.write("**********************************")

	
	this.reset()
}


exports.arrowDown = function( callback ){
	
	charm.foreground( "black")
	charm.display( "dim" )
	
	if ( ds.trend.state == 2 ){
		charm.foreground( "green")
		charm.display( "bright" )
	}
	
	charm.position( 5,15 )
	charm.write("**********************************")
	charm.position( 9,16 )
	charm.write("********** " + ds.trend.flap.down + "  **********")
	charm.position( 15,17 )
	charm.write("************")
	charm.position( 20,18 )
	charm.write( "*" )
	
	this.reset()
}

exports.arrowFlat = function( callback ){
	charm.foreground( "red")
	charm.display( "dim" )
	
	if ( ds.trend.state == 0 ){
		charm.foreground( "red")
		charm.display( "bright" )
	}
	
	charm.position( 5,14 )
	charm.write("**********************************")

	
	this.reset()
}

exports.slope = function( callback ){
	
	// Grid
	var top = 10
	for ( i=0; i < 9; i++ ){
		charm.position( 50, i + top )
		charm.write( "|" )
	}
	
	charm.write( "_________________________________________")
}



exports.priceChange = function( callback ){

	charm.foreground( "white" ).background( "black" ) 
	charm.position( 30, 42 )
	charm.write( "          UP          |        DOWN        " )
	
	this.reset()
	
	charm.position( 11, 43 ).write( "TREND PRICE CHANGE" )
	charm.position( 11, 44 ).write( "PRICE CHANGE TOTAL" )
	
	this.reset()
	
	charm.position( 40, 43 ).write( "                                             ")
	charm.position( 40, 43 ).write( ds.trend.upchange.toFixed( 2 ).toString() + "     ")
	charm.position( 60, 43 ).write( ds.trend.downchange.toFixed( 2 ).toString() + "     ")

	charm.position( 40, 44 ).write( "                                             ")
	charm.position( 40, 44 ).write( ds.trend.upchange_total.toFixed( 2 ).toString() + "     " )
	charm.position( 60, 44 ).write( ds.trend.downchange_total.toFixed( 2 ).toString() + "     " )
	this.reset()
	
	charm.foreground( "white" ).background( "black" ) 
	charm.position( 30, 45 )
	charm.write( "      PEAK PRICE      |    BOTTOM PRICE    " )
	
	this.reset()
	
	charm.position( 40, 46 ).write( "                                             ")
	charm.position( 60, 46 ).write( parseFloat( ds.trend.curves.price_bottom ).toFixed(2).toString() + "     ")
	charm.position( 40, 46 ).write( parseFloat( ds.trend.curves.price_peak ).toFixed(2).toString() + "     ")
	
	this.reset()
	
	charm.foreground( "white" ).background( "black" ) 
	charm.position( 30, 47 )
	charm.write( "      PRICE DIFF      >      SINKRATE      " )
	
	this.reset()
	
	charm.position( 40, 48 ).write( "                                             ")
	charm.position( 36, 48 ).write( "    " + ( parseFloat( ds.trend.curves.price_peak ) - parseFloat( ds.stats.ticker.price ) ).toFixed(2).toString() + "     ")
	charm.position( 56, 48 ).write( "    " + parseFloat( ds.stats.sinkrate_price ).toFixed(2).toString() + "     ")
	
	this.reset()
}

exports.product = function( callback ){
	var product
	var i = 0
	
	for ( var p in ds.products ){
		for ( var c in ds.products[p] ){
			i++
			if ( ds.products[p] == config.bot.product_id )
			charm.position( 2, 2 ).write( "Buying/Selling for " ).foreground( "blue" ).display( "bright" ).write( p.toString() )
		}
	}
	
	this.reset()
}

exports.checkBuy = function( callback ){
	
	if ( ds.states.alarms.check_buy == true ){

		charm.position( 5, 30 ).background( "red" ).display( "bright" ).foreground( "white" ).display( "blink" ).write( "       CONSIDERING BUY        " )				
		this.reset()
		
//		if ( config.bot.buy_type == "market" ){
//			charm.position( 5, 31 ).write( parseFloat( ds.trend.downchange_total ).toFixed( 2 ).toString() + " > " + parseFloat( ds.transaction.buy_threshold ).toFixed( 2 ).toString() + "        " )
//		}
//		else if ( config.bot.buy_type == "limit" ){
//			charm.position( 5, 31 ).write( ds.stats.total_slope_rate + " > " + f.addPercent( config.bot.slope_limit_order_threshold, .01 ) )
//		}
	}
	else if ( ds.states.alarms.check_buy == false ) {
		charm.position( 5, 30 ).write( "                              " )
		//charm.position( 5, 31 ).write( "                              " )
		states.check_buy = false
	}
	
	this.reset()
}

exports.openBuyOrder = function( callback ){
	
	if ( ds.states.alarms.open_buy_order == true ){
		
		if ( !states.check_buy ){
			charm.position( 5, 30 ).background( 25 ).display( "bright" ).foreground( "white" ).display( "blink" ).write( "        OPEN BUY ORDER        " )
		}
				
		this.reset()

		if ( config.bot.buy_type == "limit" || config.bot.buy_type == "curve" ){
			if ( ds.buy_order && !states.check_buy )
				charm.position( 5, 31 ).write( "Buy order at $" + parseFloat( ds.buy_order.price ).toFixed(2) )
		}
	}
	else if ( ds.states.alarms.open_buy_order == false ) {
		//charm.position( 5, 30 ).write( "                              " )
		charm.position( 5, 31 ).write( "                              " )
		states.check_buy = false
	}
	
	this.reset()
}

exports.checkSell = function( callback ){
	
	if ( ds.states.alarms.open_sell_order == true && ds.sell_order ){
		charm.position( 35, 30 ).background( 208 ).display( "bright" ).foreground( "white" ).write( "       OPEN SELL ORDER        " )
		this.reset()
		charm.position( 35, 31 ).write( "Selling at " + parseFloat( ds.sell_order.price ).toFixed(2).toString() )
	}
	else if ( ds.states.alarms.open_sell_order == false ){
		charm.position( 35, 30 ).write( "                              " )
		charm.position( 35, 31 ).write( "                              " )
	}
	this.reset()
}

exports.openSellOrder = function( callback ){
	
	if ( ds.transaction.state == 2 ){
		charm.position( 35, 30 ).background( 208 ).display( "bright" ).foreground( "white" ).write( "           SELLING            " )
		this.reset()
		charm.position( 35, 31 ).write( "Selling at " + parseFloat( ds.transaction.sell_price ).toFixed(2).toString() )
	}
	else if ( ds.states.alarms.check_sell == false && ds.transaction.state == 2 ){
		charm.position( 35, 30 ).write( "                              " )
		charm.position( 35, 31 ).write( "                              " )
	}
	this.reset()
}

exports.considerSell = function( callback ){
	
	if ( ds.states.alarms.check_sell == true && ds.transaction.state == 2 ){
		charm.position( 35, 30 ).background( "red" ).display( "bright" ).foreground( "white" ).display( "blink" ).write( "       CONSIDERING SELL       " )
		this.reset()
		charm.position( 35, 31 ).write( parseFloat( ds.stats.ticker.price ).toFixed(2).toString() + " >=  " + parseFloat( ds.transaction.sell_price ).toFixed(2).toString() )
	}
	else if ( ds.states.alarms.check_sell == false && ds.transaction.state == 2 ){
		charm.position( 35, 30 ).write( "                              " )
		charm.position( 35, 31 ).write( "                              " )
	}
	this.reset()
}

exports.bought = function( callback ){
	
	if ( ds.transaction.state == 2 || ds.transaction.state == 8 ){	
		if ( ds.states.alarms.bought == true ){
			charm.position( 5, 30 ).background( "green" ).display( "bright" ).foreground( "white" ).write( "           BOUGHT             " )
		}
		
		this.reset()
		//charm.position( 5, 31 ).write( "               " )
		charm.position( 5, 31 ).write( "Bought @" + parseFloat( ds.transaction.last_buy_price ).toFixed(2).toString() )
	}
	this.reset()
}

exports.sold = function( callback ){
	
	this.reset()
	if ( ds.states.alarms.sold == true ){
		charm.position( 35, 30 ).background( "green" ).display( "bright" ).foreground( "white" ).write( "             SOLD             " )
		this.reset()
		charm.position( 35, 31 ).write( "@" + parseFloat( ds.transaction.last_sell_price ).toFixed(2).toString() + " e: " + parseFloat( ds.transaction.earnings ).toFixed(2).toString() )
	}
	else if ( ds.states.alarms.check_sell == false && ds.transaction.state == 2 ){
		charm.position( 35, 30 ).write( "                              " )
		charm.position( 35, 31 ).write( "                              " )
	}
	this.reset()
}

exports.climbLadder = function( callback ){
	this.reset()
	
	if ( ds.states.alarms.climb_ladder == true && ds.trend.state == 1 ){
		charm.position( 5, 35 ).background( 208 ).display( "bright" ).foreground( "white" ).display( "blink" ).write( "     CLIMBING THE LADDER      " )
	}
	else {
		charm.position( 5, 35 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "     CLIMBING THE LADDER      " )
	}
	
	this.reset()
}

exports.reset = function( callback ){
	charm.foreground( "black" )
	charm.background( "white" )
	charm.display( "reset" )
}

exports.clearZeroState = function( callback ){
	if ( ds.transaction.state == 0 ){
		charm.position( 5, 30 ).write( "                              " )
		charm.position( 5, 31 ).write( "                              " )
	}
}




exports.dropDetection = function( callback ){
	
	this.reset()

	if ( ds.states.alarms.drop_detection == true ){	
		charm.position( 5, 33 ).background( 208 ).display( "bright" ).foreground( "white" ).write( "        DROP DETECTED         " )
	}
	else {
		charm.position( 5, 33 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "        DROP DETECTED         " )
	}
	
	if ( ds.states.alarms.large_drop_detection == true ){	
		charm.position( 5, 34 ).background( "red" ).display( "bright" ).foreground( "white" ).display( "blink" ).write( "     LARGE DROP DETECTED      " )
	}
	else {
		charm.position( 5, 34 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "     LARGE DROP DETECTED      " )
	}
	
	this.reset()
}

exports.spikeDetection = function( callback ){
	
	this.reset()

	if ( ds.states.alarms.spike_detection == true ){	
		charm.position( 35, 33 ).background( 10 ).display( "bright" ).foreground( "white" ).write( "        SPIKE DETECTED        " )
	}
	else {
		charm.position( 35, 33 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "        SPIKE DETECTED        " )
	}
	
	if ( ds.states.alarms.large_spike_detection == true ){	
		charm.position( 35, 34 ).background( "green" ).display( "bright" ).foreground( "white" ).display( "blink" ).write( "     LARGE SPIKE DETECTED     " )
	}
	else {
		charm.position( 35, 34 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "     LARGE SPIKE DETECTED     " )
	}
	
	this.reset()
}

exports.curveDrop = function( callback ){
	
	this.reset()

	if ( ds.states.alarms.drop_warning == true ){	
		charm.position( 5, 36 ).background( 11 ).display( "bright" ).foreground( 136 ).write( "        DROP POSSIBLE         " )
	}
	
	else if ( ds.states.alarms.drop_started == true ){	
		charm.position( 5, 36 ).background( 208 ).display( "bright" ).foreground( "white" ).write( "        DROP STARTED          " )
	}
	
	else if ( ds.states.alarms.dropping == true ){	
		charm.position( 5, 36 ).background( "red" ).display( "bright" ).foreground( "white" ).write( "           DROPPING           " )
	}

	else if ( ds.states.alarms.bottom_close == true ){	
		charm.position( 5, 36 ).background( 166 ).display( "bright" ).foreground( "white" ).write( "         BOTTOM CLOSE         " )
	}
	
	else if ( ds.states.alarms.bottom_reached == true ){	
		charm.position( 5, 36 ).background( 215 ).display( "bright" ).foreground( "white" ).write( "        BOTTOM REACHED        " )
	}
	
	else {
		charm.position( 5, 36 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "        DROP POSSIBLE         " )
	}
	
	
	this.reset()
}

exports.curveRise = function( callback ){
	
	this.reset()

	if ( ds.states.alarms.rise_warning == true ){	
		charm.position( 5, 36 ).background( 46 ).display( "bright" ).foreground( 136 ).write( "        RISE POSSIBLE         " )
	}
	
	else if ( ds.states.alarms.rise_started == true ){	
		charm.position( 5, 36 ).background( 76 ).display( "bright" ).foreground( "white" ).write( "        RISE STARTED          " )
	}
	
	else if ( ds.states.alarms.rising == true ){	
		charm.position( 5, 36 ).background( "green" ).display( "bright" ).foreground( "white" ).write( "            RISING            " )
	}

	else if ( ds.states.alarms.peak_close == true ){	
		charm.position( 5, 36 ).background( 46 ).display( "bright" ).foreground( "white" ).write( "          PEAK CLOSE          " )
	}
	
	else if ( ds.states.alarms.peak_reached == true ){	
		charm.position( 5, 36 ).background( 48 ).display( "bright" ).foreground( "white" ).write( "         PEAK REACHED         " )
	}
	
//	else {
//		charm.position( 5, 36 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "        DROP POSSIBLE         " )
//	}
	
	
	this.reset()
}

exports.buyHold = function( callback ){
	
	this.reset()

	if ( ds.states.buy_hold == true ){	
		charm.position( 66, 33 ).background( 148 ).display( "bright" ).foreground( "white" ).write( "           BUY HOLD           " )
	}
	else {
		charm.position( 66, 33 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "           BUY HOLD           " )
	}
	
	this.reset()
	
	if ( ds.states.sell_hold == true ){	
		charm.position( 66, 34 ).background( 220 ).display( "bright" ).foreground( 136 ).write( "          SELL HOLD           " )
	}
	else {
		charm.position( 66, 34 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "          SELL HOLD           " )
	}
	
	this.reset()
}

exports.slopeHold = function( callback ){
	
	this.reset()

	if ( 
			ds.states.buy_hold_on_slope_rate
				||
			ds.states.buy_hold_on_detectSlopeRate_over
				||
			ds.states.buy_hold_on_detectSlopeRate_under
				||
			ds.states.sell_hold_on_slope_rate
				||
			ds.states.sell_hold_on_detectSlopRate_over	
	){	
		charm.position( 66, 35 ).background( 166 ).display( "bright" ).foreground( "white" ).write( "          SLOPE HOLD          " )
	}
	else {
		charm.position( 66, 35 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "          SLOPE HOLD          " )
	}
	
	this.reset()
	
	if ( ds.states.slope_rate_over ){	
		charm.position( 66, 37 ).background( 36 ).display( "bright" ).foreground( "white" ).write( "           SLOPE UP           " )
	}
	else {
		charm.position( 66, 37 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "           SLOPE UP           " )
	}
	
	this.reset()
	
	if ( ds.states.slope_rate_under ){	
		charm.position( 66, 38 ).background( 215 ).display( "bright" ).foreground( "white" ).write( "          SLOPE DOWN          " )
	}
	else {
		charm.position( 66, 38 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "          SLOPE DOWN          " )
	}
	
	this.reset()
}

exports.timeHold = function( callback ){
	
	this.reset()

	if ( ds.states.alarms.buy_hold_timer ){	
		charm.position( 66, 36 ).background( 166 ).display( "bright" ).foreground( "white" ).write( "          TIME HOLD           " )
	}
	else {
		charm.position( 66, 36 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "          TIME HOLD           " )
	}
	
	this.reset()
}

exports.selloffDetection = function( callback ){
	
	this.reset()

	if ( ds.states.alarms.selloff == true ){	
		charm.position( 66, 39 ).background( "red" ).display( "bright" ).foreground( "white" ).display( "blink" ).write( "           SELLOFF            " )
	}
	else {
		charm.position( 66, 39 ).background( 254 ).display( "bright" ).foreground( 255 ).write( "           SELLOFF            " )
	}
	
	this.reset()
}




exports.testField = function( callback ){
	charm.foreground( "black")
	charm.position( 18,50 )
	
	charm.write( "                                                                                  " )
	charm.position( 18,50 )

	if ( ds.test_field )
			charm.write( "test: "+ ds.test_field.toString() )
}



