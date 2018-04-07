

# bitbot



## Usage



## Developing
TODO

- add peak detection
- detect turnaround in trend to be upwards when price becomes higher than the last peak
- analyze price change during drop. during drop, hold off on buying before analyzing how fast the drop is occuring to decide if sink rate should be lowered
- need to measure the top price, the low price, and average going back in history. This is important to determine up and downtrend. In a downtrend, need to either hold off on buys, or wait until a certain
  type of large drop to occur before buying. need to determine how long back to look. 
  
  - In an instant selloff, hold off all buys for a certain amount of time to determine the new trend.

- immediate sell and stop buying if total slope over -30
- For limit orders, a buy strategy: Set a modifier to buy x% more than the regular sink rate. Then, start a loop that runs every x amount of time, and if the order is not filled,
  cancel and slowly increase the buy price. This will help with large drops.
  
  This method can also be coupled with checking the slopes, on upslopes, modify lesss or not at all; on downslopes, increase the factor.
  
  Also consider adding a "confidence" facot. The more a sale needs to be terminated to cash out on a downslope, the more confidence is lowered. Lower confidence incorporates a larger 
  modifier when buying, until it's built back up.
  
- Add a new price counter, "last order price change total" and keep the total change in price from the starting point, and both up 
  and down until the next order. Use to detect super large spikes.

- Add a "spike" meter, use the last order price change total metric. catalog the change over time, in percent, 
  over a 5 OR 10 minute period. If it goes up config.bot.spike_detect_threshold, then throw alarm

- "Get what I can take" - Add this option to sell as close as possible to the profit point. When detecting a downturn, if the price is at a point where any profit is possible, make a decision to sell or wait until the max profit price is reached. Base the decision on:

  - slope factors
  - volatility index
  - volume

- "Never lose" - Add this option to always sell during a drop before the price drops below a minimum profit point. May require adding "minimum profit" in the config file

** when developing new rules, be paranoid in the testing; for example, if detecting a downtrend, make it detect it way too soon at first, 
   so as to be paranoid about detecting it too late. Refine from this point to a comfortable level.

- Teach bot how to detect flapping at top. Flapping at the top fluctuates the price from up to down rapidly. Need to check for very rapid up and down swings, and increase the flap
  so the trend increases to compensate

- On a sale, check the upswing before it happen. The steeper the upswing, the more the sink rate should be increased before buying again, if that increase is a high for the day

- Add dynamic config loading, allow params to be edited and honored real time, for certain params

- Add a way to detect an uptrend. Make an option so after a buy, use a combination of the up and down flags coupled with the current price to determine the sale. If there is a downtrend, instead of instantly selling, hold onto the buy until it is within a few percentage of the sell price (for protection on the sale). Make sure there is a sale if there is risk the downtrend will fall below the optimale sale period. This way, if the trend turns around and climbs again, there will be more.

When a drop is detected, determine the distance from the current price to the optimal sale price. measure the total sink rate size for the original buy price. If the distance from the buy price to the current price exceeds the sink rate, allow it to drop and sell to within 20% of the distance from the current price to the starting price + adding the sink rate.

- Calculate the amount to get profit, and couple that with the downtrend slope value, and alter the sink rate/buy decisions based on this

- Add a way to read history and determine a slope trend, and alter the buy price and/or the sink rate
to accomodat the trend

- Look into detecting large drops and increasing the trend gap, to avoiid buying to soon

- Add acceptable loss algorithm to prevent being stuck holding coins and not making buys

- Add database to hold order info, create id for bots to id them

- Detect sellofs and suspend buys while it's happening; possibly do a quick sell before the drop increases

- Alter the buy price in downward trends

- Detect up and downswings, and their slopes. Dynamically alter other values to match the current trend, for performance

- Detect extreme volatility and adjust trend gap and sink rate accordingally

- Once an order sells, it sometimes wants to buy right away but can't because the order is not yet filled.

 need to find out why and fix this


Things to consider:

- Stop buying at
    1hr slope < -50
    4 hr slope < -40
    tacticla_slope < -20
### Tools

Created with [Nodeclipse](https://github.com/Nodeclipse/nodeclipse-1)
 ([Eclipse Marketplace](http://marketplace.eclipse.org/content/nodeclipse), [site](http://www.nodeclipse.org))   

Nodeclipse is free open-source project that grows with your contributions.
