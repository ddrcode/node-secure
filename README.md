node-secure
===========

### Description
node-secure is a tiny module for Node.JS which protects global variables (like undefined, NaN, Infinity)
from being overridden. It also brings some additional mechanism for code protection. <br/>
Author: David de Rosier<br/>
License: public domain 

### Server-side must be secured!

Hope we all agree that server-side programming requires special attention. 
An error on this level can crash not only a single client (browser), but entire
server. Moreover we need to take an extra care of the security.
JavaScript is a super dynamic language that allows us to rapidly implement server functionality, 
but it also leaves open doors for hackers (through code injections from client). 
We can also often struggle from some strange/stupid/typo mistakes which are difficult to find. 

Example? Lets start from something simple. JavaScript does not protect 
global variables like `undefined`. Overriding such value can be dangerous -
in example the _http_ module of Node.JS uses insecure comparisons with `undefined` value,
so following example:

```js
undefined = 666;
var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(1337, "127.0.0.1");
```

will kill the entire server after first HTTP request with 
"_Cannot call method 'slice' of null_" error. Not easy to find a real source of 
problem with such message, isn't it?


### V8 means ECMAScript 5

Fortunately ECMAScript 5 brings some features, which can limit
an access to object properties. They can be even used on standard global properties, 
like `undefined`. And we don't have to bother about backward-compatibility on Node.JS. 
The basic code snippet presented below can protect the standard global variables for
entire application:

```js
Object.defineProperty && (function(){
   // take global object
   var global = (function(){return this;})();
   
   // when "strict mode' is on we can leave - globals are protected by default
   if(!global) return;
   
   // first lets redefine proper values in case they got overridden
   undefined = void 0;
   NaN = 0/0;
   Infinity = 1/0;
   
   // make globals read only and not-configurable
   ["undefined", "NaN", "Infinity"].forEach(function(key){
      Object.defineProperty(global, key, {writable: false, configurable: false});
   });
})();
```

The code above is quite universal and will work on all environments (browsers, SSJS, Rhino, etc)
which provide property descriptor functionality. I would recommend to copy-paste such
code to the main modules of all your applications. 


### spoon="strict mode"; there is no spoon!

Some developers might say that we shouldn't bother of global variables in Node.JS, because 
we have strict mode. Theoretically true, but... currently V8 supports all features of ECMAScript 5 excluding...
the strict mode! Doors for insecurity remains open!


### What is node-secure?

node-secure is a tiny module for Node.JS which gives some protection mechanisms to your code.
In particular:

1. It protects the standard global variables (`undefined`, `NaN`, `Infinity`, `isNaN`) from being overridden.
2. It gives an extra control on most insecure element of the language - `eval` function. With
node-secure you will be able to track each execution of `eval` with typical for Node.JS 
behavior - events. Every time someone executes `eval`, the module will emit an event with
reference to executor function. Why to bother about events - wouldn't be better to just
override the evil `eval` with empty function? Wel.. some of the modules you use may operate on `eval`. Better not to
break existing functionality.   
3. The module provides two utility functions - `secureMethods` and `securePrivates`.
First one protects all methods of given object from being overridden. Why? In most of the cases
you wouldn't like to override your methods, so is better to keep them read-only - especially 
in your custom modules.
Second method makes all private-like elements of an object (named with underscore prefix) non-enumerable. 
If you don't want to hide elements fully (using closures) and just use naming convention for it,
you can add extra protection by hiding the private elements from being enumerable.
4. There is risky situation when someone override and protect `eval` or standard globals before
you even load the node-secure module. In such case the module won't be able to secure
the application. You can control such situation by calling `isSecure` method or by checking 
`status` object, which will tell you exactly which element couldn't be secured. Moreover
every time when protection of global elements will fail, the module will produce an _insecure_ event.   


#### Examples

Just load the module to protect standard globals and `eval` function 
```js
require("node-secure");
undefined = 666; // nothing happen (in non strict mode there is no error, however the value won't be overridden)
```

To control execution of `eval`, add the listener:
```js
var secure = require("node-secure");
secure.on("eval", function(caller){
   console.log("Evel executed in following function: "+caller);
});
```

To check whether the module managed to protect all elements you can define another listener:
```js
var secure = require("node-secure");
secure.on("insecure", function(problems){
   console.log("Some of globals couldn't be protected: "+problems);
});
```

eventually you can directly check the statuses:
```js
if( !secure.isSecure() ) {
   console.log("There are some security issues");
   if(secure.status.UNDEFINED_VALUE && secure.status.UNDEFINED_PROTECTION) {
      console.log("Fortunately undefined is secured");
   } 
}
```

Finally you can protect your own objects. Consider it especially for your custom modules.
```js
var secure = require("node-secure");
exports.test = function(){...};
// at the end of the module code
secure.secureMethods(exports);
```

Code above just sets the writable flag to _false_ for all methods in given object. So you can always
redefine the access with property descriptor, unless you make the methods non-configurable:
```js
secure.secureMethods(exports, {configurable: false});
```

Remember to hide the private-like elements of your object for `for..in` or `Object.keys` operations:
```js
var secure = require("node-secure");
obj = {
   __salary: 1024,
   __utilMethod: function(){},
   getSalary: function(){ return this.__salary }
}; 
secure.securePrivates(obj);
```

In practice `securePrivates` and `secureMethods` can fail for already non-configurable members.
Fortunately node-secure allows you to track such situation. Lets take example code:

```js
var secure = require("node-secure");

var obj = {
  test: function(){},
  __prv1: 0
};

Object.defineProperty(obj, "test", {configurable:false});
Object.defineProperty(obj, "__prv1", {configurable:false});
```

and consider some cases:

```js
secure.secureMethods(obj);
```

everything is fine here. According to ECMAScript 5 specification you can change the value of _writable_ 
property from _true_ to _false_ (but not opposite) even if the property is marked as non-configurable.
However:

```js
secure.secureMethods(obj, {enumerable: false, configurable: true});
```

will not work, because there is not possible to change `enumerable` and `configurable` attributes
of non-configurable property. You can track such situation with node-secure:

```js
secure.secureMethods(obj, {enumerable: false, configurable: true}, function(errors){
   console.log("not all methods were properly protected. Reasons: " + errors);
});
```

Listener function takes as an attribute an array of objects. Each object contains 
property and error attributes. `secureMethods` and `securePrivates` never fail when
they can't protect some of the object elements. They continue and produce a report
which you can check with callback function. 


### New to property descriptors?

If your are new to the concept of ECMAScript 5 property descriptors and the things here seem to 
be bit strange for you - just see the great 
[ECMAScript 5 Object methods cheatsheet](http://kasia.drzyzga.pl/2011/06/ecmascript-5-object-methods-cheatsheet/) 
written by Kasia Drzyzga. 
 