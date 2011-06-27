/*
 * Common tests adn utils used by other tests from the same folder.
 * Don't use it separately.
 * @author David de Rosier
 */

var assert = require("assert");


exports.start = function(tests) {
	Object.keys(tests).forEach(function(f){
		console.log( "Running test: " + f );
		tests[f]();
	});
};


exports.standardTests = {

	correctValues: function(){
		assert.equal( undefined, void 0, "undefined" );
		assert.equal( Infinity, 1/0, "infinity" );
		assert.equal( String(NaN), "NaN", "NaN" );
		
		assert.equal( typeof undefined, "undefined", "typeof undefined" );
		assert.equal( typeof Infinity, "number", "typeof Infinity" );
		assert.equal( typeof NaN, "number", "typeof NaN" );
	},
	
	
	moduleLoad: function() {
		
		var secure;
		
		assert.doesNotThrow( function(){
			secure = require("../js/node-secure");
		});
		
		this.correctValues();
		
		assert.equal( typeof secure.secureMethods, "function", "typeof secure.secureMethods" );
		assert.equal( typeof secure.securePrivates, "function", "typeof secure.securePrivates" );
		assert.equal( typeof secure.isSecure, "function", "typeof secure.isSecure" );
		assert.equal( typeof secure.status, "object", "typeof secure.status" );
		
		assert.equal( secure.isSecure(), true, "secure.isSecure()");
		
		return secure;
	}
};

