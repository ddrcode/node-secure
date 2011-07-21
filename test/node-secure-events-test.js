/*
 * Test whether the events are emit when some problems occur
 * during the code protection. 
 * @author David de Rosier
 */

var assert = require("assert");
var test = require("./test-commons");
var secure = null;

// Modifies some standard values before loading the node-secure module
// The code protects the changes (configurable: false), so the module
// won't be able to apply protection. An event should be emitted. 
(function(){

	Object.defineProperty(global, "undefined", {
		value: 42,
		enumerable: false,
		configurable: false,
		writable: false
	});
	
	Object.defineProperty(global, "isNaN", {
		value: function(){ return 2 },
		configurable: false,
		enumerable: false,
		writable: false
	});

	Object.defineProperty(Object.prototype, "toString", {
		writable: false,
		configurable: false
	});
	
	Date.now = 123;
	
})();


// tests
(function(){
	
	console.log( "Running test: events" ); 
	
	try {
		secure = require("../js/node-secure");
		
		var cnt = 0;
		secure.on( "insecure", function(problems){
			++cnt;
			assert.equal( problems.length, 2, "Two problems should be found" )
		});
		
		secure.secureStandardMethods();
		
		process.on('exit', function(){
			assert.equal( cnt, 2, "Event should be emitted two times" );
		});
		
	} catch(ex) {
		if( ex.name === "AssertionError" )
			throw ex;
		assert.ok( false, "No error should happen" );
	}
	
})();
