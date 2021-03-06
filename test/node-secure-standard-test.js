/*
 * Test of standard situation.
 * No overridden globals, no property descriptor changes
 * @author David de Rosier
 */

var assert = require("assert");
var test = require("./test-commons");
var secure = null;

var tests = {
		
	"default values": function(){
		assert.equal( undefined, void 0, "undefined" );
		assert.equal( Infinity, 1/0, "infinity" );
		assert.equal( String(NaN), "NaN", "NaN" );
		
		assert.equal( typeof undefined, "undefined", "typeof undefined" );
		assert.equal( typeof Infinity, "number", "typeof Infinity" );
		assert.equal( typeof NaN, "number", "typeof NaN" );
	},
	
	
	"default eval": function(){
		var a = 5;
		var eq = eval("a+1");
		assert.equal( eq, 6, 'eval("a+1")' );
	},
	
	
	"node-secure module load": function() {
		assert.doesNotThrow( function(){
			secure = require("../js/node-secure");
		});
		
		this["default values"]();
		
		assert.equal( typeof secure.secureMethods, "function", "typeof secure.secureMethods" );
		assert.equal( typeof secure.securePrivates, "function", "typeof secure.securePrivates" );
		assert.equal( typeof secure.isSecure, "function", "typeof secure.isSecure" );
		assert.equal( typeof secure.status, "object", "typeof secure.status" );

		assert.ok( secure.status.EVAL, "status.EVAL" );
		assert.ok( secure.status.UNDEFINED_VALUE, "status.UNDEFINED_VALUE" );
		assert.ok( secure.status.UNDEFINED_PROTECTION, "status.UNDEFINED_PROTECTION" );
		assert.ok( secure.status.NAN_VALUE, "status.NAN_VALUE" );
		assert.ok( secure.status.NAN_PROTECTION, "status.NAN_PROTECTION" );
		assert.ok( secure.status.INFINITY_VALUE, "status.INFINITY_VALUE" );
		assert.ok( secure.status.INFINITY_PROTECTION, "status.INFINITY_PROTECTION" );
		assert.ok( secure.status.ISNAN_VALUE, "status.ISNAN_VALUE" );
		assert.ok( secure.status.ISNAN_PROTECTION, "status.ISNAN_PROTECTION" );
		
		assert.equal( secure.isSecure(), true, "secure.isSecure()");
	},
	
	
	"property definitions of globals": function(){
		["undefined", "Infinity", "NaN", "isNaN", "eval"].forEach(function(a){
			var def = Object.getOwnPropertyDescriptor(global, a);
			assert.equal( def.configurable, false, "'configurable' property of " + a );
			a!=='eval' 
				? assert.equal( def.writable, false, "'writable' property of " + a )
				: assert.equal( typeof def.set, 'undefined', "'writable' property of " );
		});
	},
	
	
	"status": function() {
		assert.equal( Object.isFrozen(secure.status), true, "Object.isFrozen(secure.status)" );
	},
	
	
	"secure eval": function(){
		var evalTest = this["default eval"];
		secure.on("eval", function(caller){
				assert.equal(caller, evalTest);
			});
		this["default eval"]();
	},

	
	"secureMethods": function(){
		var callback = function(){
			assert.ok( false, "callback method should not be executed" );
		};
		obj = {
			mth: function(){}
		};
		secure.secureMethods(obj, {}, callback);
	},
	
	
	"secureStandardMethods": function(){
		var callback = function(){
			assert.ok( false, "callback method should not be executed" );
		};
		
		secure.secureStandardMethods(callback);
		
		var dsc = Object.getOwnPropertyDescriptor(Object.prototype, "toString");
		assert.equal( dsc.writable, false );
		assert.equal( dsc.configurable, false );
		
		// tests if the function overrode itself. Second execution should throw error, because
		// all standard methods are already protected
		secure.secureStandardMethods(callback);
	}
		
};

test.start(tests);