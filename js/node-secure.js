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
 *       secure.on("eval", function(f){"Evaluation executed in function "+f.name});
 *       eval("6*7"); // will emit the "eval" event before code execution
 *       
 * 3. Protect your object method for being overridden. It is especially 
 *    important in case of custom modules.
 *    Example:
 *       var secure = require("node-secure");
 *       secure.secureMethods(exports); // protects all methods from current module
 *       secure.securePrivates(myObj); // makes all properties starting from "_" non-enumerable
 *       
 * 4. Protect standard JavaScript methods from being overridden.  
 *    Example:
 *       var secure = require("node-secure");
 *       secure.secureStandardMethods();
 * 
 * ------------------------------------------------------------------------------
 * 
 * API
 * 		SecurityError(msg, problems)			: constructor
 * 		secureStandardMethods(problemHandler)	: function
 * 		secureMethods(obj, config, callback)	: function
 * 		securePrivates(obj, config, callback)	: function
 * 		on(callback)							: function
 * 		once(callback)							: function
 * 		removeListener(callback)				: function
 * 		isSecure()								: function
 * 		status									: object
 * 		eval									: event
 * 		insecure								: event
 * 
 * ------------------------------------------------------------------------------
 * 
 * Public domain
 * @author   David de Rosier
 * @version  0.3.0alpha
 * 
 * This version is under development.
 * Latest stable version is 0.2.0 
 * Use GIT tags for it or npm: npm install node-secure 
 * 
 * You use this software at your own risk.
 */


// required modules 
var EventEmitter = require("events").EventEmitter,
	util = require("util")
	;


var nodeSecure = exports;


/**
 * Specifies which feature become protected after module load
 * Values available through 'status' property of the module
 * @exports __status as status
 * @private
 * @example require('node-secure').status.NAN_VALUE
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
var __eventEmitter = (function(){
	
	var Constr = function(){
		EventEmitter.call(this);
	};
	
	util.inherits(Constr, EventEmitter);
	
	return new Constr();
})(); 



/**
 * Error object constructor dedicated to security issues.
 * @constructor
 * @augments Error
 * @param {string} msg error message
 * @param {Array} [problems] an array of problems
 */
exports.SecurityError = SecurityError = (function(){
	var SecurityError = function(msg, problems) {
		Error.call(this, msg);
		this.message = msg;
		this.problems = problems;
	};
	SecurityError.prototype = Object.create( Error.prototype );
	SecurityError.prototype.name = "SecurityError";
	SecurityError.prototype.constructor = SecurityError;
	return SecurityError;
})(); 



/**
 * Tests whether the input parameter is a function. Additional test is required because
 * V8 returns "function" as a result of typeof operator also for RegExps.
 * @returns {boolean}
 * @private
 */
var __isFunction = function(test){
	return typeof test === "function" && test.call && test.apply && test.bind;
};



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
					(__canEmit = !__canEmit) &&  __eventEmitter.emit("eval", arguments.callee.caller);
					return __eval;
				}, 
			configurable: false 
		});
		
		__status.EVAL = true;
	} 
})();



/**
 * Protects methods of standard JavaScript objects from being overridden. 
 * The optional parameter of the method defines how to handle situations when
 * function recognize some issues (ie. already overridden method). Three options
 * available here:
 * a) function run without input attribute - "insecure" event will be emitted
 * b) function run with boolean attribute true - SecurityError will be thrown.
 * c) function run with function as an attribute - the callback will be invoked.
 * In all three cases an array of problems will be passed as an attribute.
 * 
 * Function returns the module object which means it can be invoked directly
 * after require, without overlapping the module context (see example).
 * 
 * Function does not break when internal error happen. It tries to protect as 
 * many standard methods as possible. Finally it produces the list of problems.  
 * 
 * Function executes only once. After that it replaces itself with an empty
 * function to avoid situation with multiple attempts of standard object
 * protection. It also means that after first execution the function releases
 * its resources. 
 *  
 * @param {boolean|function} [problemHandler] 
 * @returns module object
 * @throws {SecurityError} when problems found and function invoked with 
 * 		   boolean argument set to true
 * @example
 * 			var secure = require("node-secure").secureStandardMethods(
 * 				function(problems){
 * 					console.log("Can't continue due to security threats");
 * 					console.log(problems);
 *					process.exit(1); 			   
 * 				});
 */
exports.secureStandardMethods = (function(prototypes, objects){
	
		var __problems = (function(){
				var arr = [];
				arr.add = function(key, desc){
					arr.push( "Problem in "+key+". "+desc );
				};
				return arr;
			})();
	
		var __iterator = function(elems){
			var proto = elems===prototypes;
			Object.keys(elems).forEach(function(p){

				proto && elems[p].push('constructor');
				
				elems[p].forEach(function(f){
					try {
						var obj = proto ? global[p].prototype : global[p],
							dsc = Object.getOwnPropertyDescriptor(obj, f),
							key = (proto ? p+".prototype" : p) + "." + f,
							problem = true, error = false;
						
						if( !dsc ) {
							__problems.add( key, "Method does not exist" );
						} else if( !dsc.writable || !dsc.configurable ) {
							__problems.add( key, "Method already protected" );
						} else if( !__isFunction(obj[f]) ) {
							__problems.add( key, "Method is not a function" );
						} else {
							problem = false;
							Object.defineProperty(obj, f, {writable: false, configurable: false});
						}
						
					} catch(ex) {
						error = true;
					} finally {
						if( !problem && !error ) {
							dsc = Object.getOwnPropertyDescriptor(obj, f);
						}
						if( !problem && (error || dsc.writable || dsc.configurable) ){
							__problems.add( key, "Method couldn't be protected for unknown reason" );
						}
					}
				});
			});
		};
		
		var __secureStandardMethods = function(problemHandler){
			
				if( arguments.length > 0 && typeof problemHandler !== "boolean" && !__isFunction(problemHandler) ) {
					throw new TypeError( "problemHandler must be either boolean or a function" );
				}
			
				__iterator(prototypes);
				__iterator(objects);
				
				if( __problems.length > 0 ) {
					var problems = Object.freeze( __problems.slice() );
					if( typeof problemHandler === "boolean" ) {
						throw new SecurityError( "Securing standard ECMAScript methods failed. See problems property for details.", problems );
					} else if( __isFunction(problemHandler) ) {
						problemHandler( problems ); 
					} else {
						__eventEmitter.emit( "insecure", problems );
					}
				}
				
				// override itself after first execution
				__secureStandardMethods = function(){
					return nodeSecure;
				};
				
				return nodeSecure;
			};
			
		return function(){
				return __secureStandardMethods.apply(nodeSecure, arguments);
			};
		
	})({
			'Object': ['toString', 'toLocaleString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable'],
			'Array': ['toString','toLocaleString','concat','join','pop','push','reverse','shift','slice','sort','splice','unshift',
			          'indexOf','lastIndexOf','every','some','forEach','filter','map','reduce','reduceRight'],
			'Function': ['call','apply','bind','toString'],
			'Number': ['toString','toLocaleString','valueOf','toFixed','toExponential','toPrecision'],
			'Boolean': ['toString','valueOf'],
			'String': ['trim','toString','valueOf','charAt','charCodeAt','concat','indexOf','lastIndexOf',/*'localCompare',*/
			           'match','replace','search','slice','split','substring','toLowerCase','toLocaleLowerCase','toUpperCase','toLocaleUpperCase'],
			'Date': ['toUTCString', 'setMinutes', 'setUTCMonth', 'getMilliseconds', 'getTime', 'getMinutes', 'getUTCHours', 
         	        'toString', 'setUTCFullYear', 'setMonth', 'getUTCMinutes', 'getUTCDate', 'setSeconds', 'toLocaleDateString', 'getMonth', 
        	        'toTimeString', 'toLocaleTimeString', 'setUTCMilliseconds', 'setYear', 'getUTCFullYear', 'getFullYear', 'getTimezoneOffset', 
        	        'setDate', 'getUTCMonth', 'getHours', 'toLocaleString', 'toISOString', 'toDateString', 'getUTCSeconds', 'valueOf', 
        	        'setUTCMinutes', 'getUTCDay', 'toJSON', 'setUTCDate', 'setUTCSeconds', 'getYear', 'getUTCMilliseconds', 'getDay', 
        	        'setFullYear', 'setMilliseconds', 'setTime', 'setHours', 'getSeconds', 'toGMTString', 'getDate', 'setUTCHours'],
			'RegExp': ['toString', 'exec', 'compile', 'test'],
			'Error': ['toString']
		},{
			'JSON': ['parse', 'stringify'],
			'Object': ['keys','getPrototypeOf','create','preventExtensions','seal','freeze','isSealed','isFrozen',
			           'isExtensible', 'defineProperty', 'defineProperties', 'getOwnPropertyDescriptor', 'getOwnPropertyNames'],
			'Array': ['isArray'],
			'String': ['fromCharCode'],
			'Date': ['now','UTC','parse'],
			'Math': ['abs','acos','asin','atan','atan2','ceil',
			         'cos','exp','floor','log','max','min','pow','random','round','sin','sqrt','tan']
		}
	); // end of exports.secureStandardMethods factory



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
		if( __isFunction(config) && !errorCallback ) {
			errorCallback = config;
			config = null;
		}
		
		config = config || {};
		if( typeof config !== "object" ) {
			throw new TypeError( "config is not an object" );
		}
	
		if( errorCallback && !__isFunction(errorCallback) ) {
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
				return __isFunction(obj[key]);
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
["on", "once", "removeListener"].forEach(function(mth){
	exports[mth] = __eventEmitter[mth].bind(__eventEmitter);
});



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
		__eventEmitter.emit("insecure", failures);
	}); 

