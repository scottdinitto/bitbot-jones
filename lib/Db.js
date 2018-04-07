// For mongodb for now
const ds = require( './DataStructures.js' ).data
const data_structures = require( './DataStructures.js' )
const log = require( "../bitbot.js" ).log
const formulas = require('./Formulas.js')
const config = require( "../bitbot.js" ).config
const MongoClient = require('mongodb').MongoClient
const url = "mongodb://" + config.db.host + ":" + config.db.port + "/"
const crypto = require('crypto');
var db = null
var dbo = null

exports.init = function( callback ){
	var self = this
	
	// Connect to db
	this.connect( url, function( _db ){
		if ( _db ){
			log.write( "DB connection successful" )
			dbo = _db
			
			// default db to use
			db = dbo.db( config.db.name )
			
			self.createCollection( config.db.col_orders, function( status ){
				if ( status == false ){
					log.write( "Initializing collection failed, aborting" )
					process.exit()
				}
			})
			
			self.loadLastOrder( () => {} )
		}
		else {
			log.write( "Check db connection, aborting" )
			process.exit()
		}
	})
}

exports.connect = function( url, callback ){
	MongoClient.connect( url, function( err, db ){
		  if ( err ){
			  log.write( "ERROR: connecting to db " + url + ": " + err );
			  callback( false )
		  }
		  
		  log.write( "db " + url + " initialized" )
		  callback( db )
		});
}

exports.createCollection = function( name, callback ){
	  db.createCollection( name, function( err, res ) {
	    if ( err ){
	    	log.write( "ERROR: Cannot create collection " + name + ": " + err )
	    	callback( false )
	    }
	    
	    log.write( "Collection " + name + " initialized" )
	    callback ( true )
	  });
}

exports.addOrder = function( order, callback ){
	
	try {
		data_structures.createOrder( order, "active", function( data ){
			db.collection( config.db.col_orders ).insertOne( data, function( err, res ){
				if ( err ){
					log.write( "There was a problem adding the order to the database: " + err )
					//log.write( " problem, aborting" )
					//process.exit()
				}
				else {
					callback( true )
				}
			})
		})
	}
	catch( err ){
		log.write( "There was a problem writing to the database: " + err )
	}
}

exports.addOrderIfNotExist = function( order, callback ){
	var self = this
	
	try {
		self.getOrder( order.id, function( state ){
			if ( state != false ){
				self.addOrder( order )
				callback( true )
			}
		})
	}
	catch( err ){
		log.write( "There was a problem writing to the database: " + err )
	}
}

exports.getOrder = function( order_id, callback ){
	try {
		db.collection( config.db.col_orders ).find({ "bot_id": ds.bot_id, "order.id": order_id }).limit( 1 ).toArray( function( err, res ){
			if ( err ){
				log.write( "There was a problem finding the order with id " + order_id + "from the database")
				callback( false )
			}
	
			if ( res[0] ){
				log.write( res[0] )
				callback( res[0] )
			}
		})
	}
	catch( err ){
		log.write( "There was a problem writing to the database: " + err )
	}
}

exports.loadLastOrder = function( callback ){
	try {
		db.collection( config.db.col_orders ).find({ "bot_id": ds.bot_id }).sort( { "date": -1 } ).limit( 1 ).toArray( function( err, res ){
			if ( err ){
				log.write( "There was a problem loading the last record from the database")
				callback( false )
			}
	
			if ( res[0] ){
				if ( res[0].order ){
					ds.transaction = res[0].transaction
					ds.states = res[0].states
					
					
					if ( res[0].order.side == "buy" ){
						ds.buy_order = res[0].order
					}
					else if ( res[0].order.side == "sell" ){
						ds.sell_order = res[0].order
					}
					
					callback( true )
				}
			}
		})
	}
	catch( err ){
		log.write( "There was a problem writing to the database: " + err )
	}
}

exports.updateOrderState = function( order, status, callback ){
	try {
		db.collection( config.db.col_orders ).update({ "bot_id": ds.bot_id, "order.id": order.id }, { $set: { "states": ds.states, "order": order } }, ( err, count, status ) => {
			if ( err ){
				log.write( "There was a problem updating the db: " + err )
				callback( false )
			}
			
			log.write( "Order updated in db" )
			callback( true )
		})
	}
	catch( err ){
		log.write( "There was a problem writing to the database: " + err )
	}
}


