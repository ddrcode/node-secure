/*
 * Test of the situation when all globals were originally overridden 
 * with fake values, but their property descriptors aren't changed. 
 * @author David de Rosier
 */

var assert = require("assert");
var test = require("./test-commons");
var secure = null;


// override globals
(function(){
	undefined = 666;
	NaN = "this is not a number";
	Infinity = /42/;
	isNaN = function(){ return "maybe" };
	eval = function(){ return "eval is evil" };
})();



var tests = {
		
	"default values": function(){
		assert.notEqual( undefined, void 0, "undefined" );
		assert.notEqual( Infinity, 1/0, "infinity" );
		assert.notEqual( String(NaN), "NaN", "NaN" );
		assert.notEqual( isNaN(+"!"), true, "isNaN" );
		assert.notEqual( eval("2+1"), 3, "eval" );
		
		assert.notEqual( typeof undefined, "undefined", "typeof undefined" );
		assert.notEqual( typeof Infinity, "number", "typeof Infinity" );
		assert.notEqual( typeof NaN, "number", "typeof NaN" );
	},
	
	"node-secure module load": function(){
		secure = test.standardTests.moduleLoad();
	},

	"secureStandardMethods": function(){
		
		Array.prototype.reduceRight = 666;
		Object.defineProperty(Object.prototype, "toString", {configurable: false});
		
		var callback = function(problems){
			assert.ok( true, "callback method should be executed due to some problems" );
			assert.equal(problems.length, 2, "Function should identify two issues");
		};
		
		secure.secureStandardMethods(callback);
		
		// problems shouldn't stop proetecting other methods
		var dsc = Object.getOwnPropertyDescriptor(Object.prototype, "valueOf");
		assert.equal( dsc.writable, false );
		assert.equal( dsc.configurable, false );
		
		// tests if the function overrode itself. Second execution should throw error, because
		// all standard methods are already protected
		secure.secureStandardMethods(callback);
	}
	
};


test.start(tests);


