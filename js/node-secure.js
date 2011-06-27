/**
 * This simple module allows to protect the code using ECMAScript 5 features,
 * even when strict mode is not available.
 * 
 * First it makes all global constants (undefined, NaN, Infinity) non-writable.
 * and non-configurable. 
 * How important it is you can check by running basic example:
 * - override undefined with real value
 * - run http server and make request
 * Due to unprotected comparisons to undefined value in http module, the entire 
 * server will fail with TypeError (tested on node.js 0.4.8)
 * Such basic code can be intentionally injected to a server by a hacker
 * or created by mistake by unexperienced developer. 
 * 
 * Secondly - the module allows you to protect your own code from
 * intentional/unintentional overriding. The main element which you should
 * protect are your methods. In most of the cases your code won't work properly
 * if your methods will be overridden. 
 * Other important thing is to hide private-like members from being enumerable.
 * Especially when they are not physically private (i.e by usage of closures), 
 * but marked as private with naming convention (using single or double 
 * underscore prefix). 
 * 
 * Third thing is to control execution of eval function - which brings the bigger
 * risk of potential attacks (execution of injected code fragments). Theoretically
 * there is possible to override eval (i.e. with empty function), however it can
 * break other modules which operate on eval function. This module extends eval
 * with notification mechanism - every time when someone execute eval your program
 * will be notified about it with "eval" event. The event takes reference to 
 * executor function.
 * 
 * The dynamic nature of JavaScript gives to developer a freedom of quick
 * and smart programming. However server-side code should be protected as much
 * as possible from code injections and hacking. The visibility of code and 
 * easy code inspection mechanism often can leave open doors for bad
 * intensions and code replacements. 
 * 
 * ------------------------------------------------------------------------------
 * 
 * USAGE
 * 
 * 1. Just load the module to protect global statics (undefined, NaN, Infinity)
 *    example: require('node-secure');
 *    
 * 2. Just load the module to control execution of eval (evil?) function.
 *    With this module eval will work as previously, but every time someone
 *    execute it, you will get an event notification
 *    Example: 
 *       var secure = require("node-secure");
 *       secure.on("eval", function(code){"Evaluation executed: "+code});
 *       eval("6*7); // will emit the "eval" event before code execution
 *       
 * 3. Protect your object method for being overridden. Iti is especially 
 *    important in case of custom modules.
 *    Example:
 *       var secure = require("node-secure");
 *       secure.secureMethods(exports); // protects all methods from current module
 * 
 * ------------------------------------------------------------------------------
 * 
 * Public domain
 * @author David de Rosier
 * 
 * You use this software at your own risk.
 */



// required modules 
var EventEmitter = require("events").EventEmitter,
	util = require("util")
	;




/**
 * Specifies which feature become protected after module load
 * Values available through 'status' property of the module
 * @example require('node-secure').status.NAN_VALUE
 * @private
 */
var __status = {
		EVAL: 					false,
		UNDEFINED_VALUE: 		false,
		UNDEFINED_PROTECTION: 	false,
		NAN_VALUE: 				false,
		NAN_PROTECTION: 		false,
		INFINITY_VALUE: 		false,
		INFINITY_PROTECTION: 	false,
		ISNAN_VALUE: 			false,
		ISNAN_PROTECTION: 		false
	};



/**
 * The code snippet below protects JavaScript globals from being overridden. 
 * It also reverts original values if they already got changed. 
 * To start the protection just load the module to a project. 
 * @example require('node-secure');
 */
(function(){
	
	// global object in non-strict mode 
	// (to avoid potentially overridden global variable of node.js)
	var global = (function(){ return this; })();
	
	// if strict mode is on - globals are protected by default
	if( !global ) {
		return;
	}

	// proper values of globals
	var values = {
			undefined: void 0,
			Infinity: 1/0,
			NaN: +"!"
		};
	
	// restore values and protect them
	Object.keys(values).forEach(function(e){
		try {
			Object.defineProperty(global,e,{ writable: false, enumerable: false, configurable: false, value: values[e] });
		} finally {
			var dsc = Object.getOwnPropertyDescriptor(global, e);
			__status[e.toUpperCase()+"_PROTECTION"] = !dsc.writable && !dsc.configurable;
			__status[e.toUpperCase()+"_VALUE"] = e!=="NaN" ? dsc.value===values[e] : String(dsc.value)==="NaN" && typeof dsc.value === "number";
		}
	});

	// restore isNaN function if overridden
	try {
		if( !global.isNaN || !global.isNaN(values.NaN) ) {
			global.isNaN = function(n) {
				return String(+n) === "NaN";
			};
		}
		Object.defineProperty(global, "isNaN", { writable: false, enumerable: false, configurable: false });
	} finally {
		dsc = Object.getOwnPropertyDescriptor(global, "isNaN");
		__status.ISNAN_PROTECTION = !dsc.writable && !dsc.configurable;
		__status.ISNAN_VALUE = typeof global.isNaN === "function" && global.isNaN(NaN);
	}
	
})();



/**
 * Local instance of EventEmitter
 * @private
 */
var __ddrSecure = (function(){
	
	var Constr = function(){
		EventEmitter.call(this);
	};
	
	util.inherits(Constr, EventEmitter);
	
	return new Constr();
})(); 



/**
 * This code snippet overrides the original eval function for better control
 * of unexpected execution. Every time the eval function will be called
 * the application will emit "eval" event, passing the code for execution
 * as an argument.
 *   
 * @example
 *    var secure = require("node-secure");
 *    secure.on("eval", function(code){"Evaluation executed: "+code});
 *    eval("6*7); // will emit the "eval" event before code execution
 *    
 */
(function(){
	var evalDsc = Object.getOwnPropertyDescriptor(global,"eval");
	if( evalDsc.configurable && evalDsc.writable ) {
		var __eval = global.eval,
			__canEmit = false;
		
		Object.defineProperty(global, "eval", { 
			get: function(){
					(__canEmit = !__canEmit) &&  __ddrSecure.emit("eval", arguments.callee.caller);
					return __eval;
				}, 
			configurable: false });
		
		__status.EVAL = true;
	} 
})();



// builder of secureMethods and securePrivates methods
(function(){

	/**
	 * @private
	 * @throws TypeError
	 */
	var __secure = function(obj, config, errorCallback, protectedAttribute, test){
		if( typeof obj !== 'object' || obj === null ) {
			throw new TypeError( "Obj is not an object" );
		}
		
		// case when callback is a second parameter (config not provided)
		if( config instanceof Function && !errorCallback ) {
			errorCallback = config;
			config = null;
		}
		
		config = config || {};
		if( typeof config !== "object" ) {
			throw new TypeError( "config is not an object" );
		}
	
		if( errorCallback && !(errorCallback instanceof Function) ) {
			throw new TypeError( "errorCallback is not a function" );
		}
	
		var cfg = {};
		cfg[protectedAttribute] = false;
		["writable", "enumerable", "configurable"].forEach(function(key){
			if( key !== protectedAttribute && key in config ) {
				cfg[key] = !!config[key];
			}
		});
		
		// array of errors
		var errors = [];
		
		for(var o in obj) { if(obj.hasOwnProperty(o)){
			if( test(o) ) {
				try {
					Object.defineProperty( obj, o, cfg );
				} catch(ex) {
					errors.push( { property: o, error: ex } );
				}
			}
		}}
		
		// execute callback when errors
		errorCallback && errors.length > 0 && errorCallback( Object.freeze(errors) );
		
		return obj;	
	};
	
	
	
	/**
	 * Makes all methods of given object non-writable. Additional protection can be provided
	 * with second attribute. 
	 * @param obj {object} Object 
	 * @param config {object} configuration object. Can take enumerable and configurable
	 *        parameters. By default both of them are set to true
	 * @returns {object} object from input arguments (obj)
	 * @throws {TypeError} when obj parameter is not an object
	 * @example
	 */
	exports.secureMethods = function(obj, config, errorCallback) {
		
		return __secure(obj, config, errorCallback, "writable", function(key){
				return obj[key] instanceof Function;
			});
		
	};
	
	
	
	/**
	 * Marks all private-like members (starting from _ or __ prefix) as not enumerable
	 * Additional protection can be added (read-only, configurability)
	 * @param obj {object} Object to protect 
	 * @param config {object} (optional) configuration object
	 * @param errorCallback {function} callback executed when protection of some 
	 *        private members will fail
	 * @returns {object} object from input arguments (obj)
	 * @throws {TypeError} when obj parameter is not an object
	 * @example
	 */
	exports.securePrivates = function(obj, config, errorCallback) {
		
		return __secure(obj, config, errorCallback, "enumerable", function(key){
			return key[0] === '_';
		});	
		
	};

})();



/**
 * Event listener. Possible events:
 * - "eval" - emitted when eval function executed
 * - "insecure" - emitted when the module failed to protect at least one of globals
 * 
 * @function
 * @param name {string} event name
 * @param callback {function} callback function
 * @example require("ddr-secure").on("eval", function(caller){ console.log("Eval executed in function: "+caller); });
 */
exports.on = __ddrSecure.on.bind(__ddrSecure);



/**
 * Statuses of protection level
 * @frozen
 */
exports.status = Object.freeze(__status);



/**
 * Checks the status global variables protection
 * @return {boolean} true if the module managed to protect all globals, false otherwise
 */
exports.isSecure = function(){
	return Object.keys(__status).every( function(s){ return __status[s]; } );
};



// Protects the module itself
exports.secureMethods( exports, { enumerable: true, configurable: false } );



// notifies that some of globals are not secure. Event notification happen
// as the nearest callback execution. If direct test is required
// call manually isSecure() method directly after module load
!exports.isSecure() && process.nextTick(function(){
	var failures = Object.keys(__status).filter( function(s){ return !__status[s]; });
	__ddrSecure.emit("insecure", failures);
}); 

