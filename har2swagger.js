var fs = require('fs')
var url = require('url')
var Type = require('type-of-is');
var assert = require('assert');

// Set those:
apiTitle = "Example API";
apiURL = "api.example.com";
apiSchemes = ["https"];

inputFile = process.argv[2];

fs.readFile(inputFile, 'utf8', function (err,data) {
	if (err) {
	return console.log(err);
	}

	// Parse HAR file
	log = JSON.parse(data).log;
	entries = log.entries;

	var paths = {}
	var definitions = {}

	// For each request in the HAR file...
	for (var i = 0, len = entries.length; i < len; i++) {
		entry = entries[i];
		
		pathname = url.parse(entry.request.url).pathname;
		method = entry.request.method.toLowerCase();
		status = entry.response.status*1;
		statusText = entry.response.statusText;
		properties = {};
		// extract the request JSON object's structure
		// but only if there is JSON request object...
		if(entry.request.postData) {
			properties = json2swaggerProperties(entry.request.postData.text, '');
		}
		
		// have we already processed a request for this path?
		if(paths[pathname]) {
			// TODO: Support more than two different JSON paramter sets per endpoint?
			if(method == "post") {
				try {
					// check if the request is equal to the one already on file
					assert.deepEqual(definitions[name + "Request"].properties,properties);
					// We already have this path but the request JSON is different this time.
					// This is weird API design but has been observed in the wild.
					// It needs manual work after code generation, because SWAGGER
					// can not model this properly.
					// Removing the "Stage2" suffix of all request URLs should be enough though.
					pathname = pathname + "Stage2";
					console.log("WARNING: This API is weird! Same endpoint accepts JSON objects of different structure.")
				} catch(err) {
					// JSON is the same as before 
					// so no need to do all this again, go on to the next entry
					continue;
				}
			} else {
				// no POST data and the path is the same
				// so no need to do all this again, go on to the next entry
				continue;
			}
		}
		name = pathname.split('/').pop()
		

		// Construct a swagger "path" from the request data
		var statusDescriptionCont = {};
		statusDescriptionCont["description"] = statusText;
		var statusCont = {}
		statusCont[status] = statusDescriptionCont
		var methodCont = {};
		methodCont["responses"] = statusCont;
		var pathnameCont = {};
		pathnameCont[method] = methodCont;

		if(method == "post") {
			// if the mehtod is POST we also add the JSON paramters
			// first we set a reference to the parameter definition
			// we construct later on
			pathnameCont[method]["parameters"] = [
						{
									"in": "body",
									"name": "body",
									"required": false,
									"schema": {
											"$ref": "#/definitions/" + name + "Request"
									}
							}
					]
		}
		
		

		// The response JSON description is refrenced regardless of request type
		pathnameCont[method]["responses"][status]["schema"] = {"$ref": "#/definitions/" + name + "Response"}
		
		// insert it in the tree
		paths[pathname] = pathnameCont;

		// build the parameters definition
		if(method == "post") {
			definitions[name + "Request"] = {
				"type": "object",
				"properties": properties
			}
		}
		
		// Support base64 encoded responses
		if(entry.response.content.encoding == "base64") {
			response = new Buffer(entry.response.content.text, 'base64').toString("ascii");
		} else {
			response = entry.response.content.text;
		}
		
		// build the response definition
		definitions[name + "Response"] = {
			type: "object",
			properties: json2swaggerProperties(response, '')
		}
	}

	
	template = {
	    "swagger": "2.0",
	    "info": {
	        "version": "0.0.1",
	        "title": apiTitle
	    },
			"schemes": apiSchemes,
			"host": apiURL,
	    "paths": {}
	}
	template["paths"] = paths;
	template["definitions"] = definitions;

	console.log(JSON.stringify(template));
});


function json2swaggerProperties(jsonstring) {
	try {
		content = JSON.parse(jsonstring);
	} catch (e) {
		return {};
	}

	var properties = {}
	// iterate over the object properties
	for (var property in content) {
		// exclude inherited properties
		if (content.hasOwnProperty(property)) {
			// determine the property's type
			var type = Type.string(content[property]).toLowerCase()
			// file it in our object description
			properties[property] = {"type": type};
			if(type == "object") {
					// property is an object, we need to recurse deeper...
					properties[property]["properties"] = json2swaggerProperties(JSON.stringify(content[property]));
			}
			if(type == "array") {
					// property is an array we have to find the element type
					var type = Type.string(content[property][0]).toLowerCase()
					// damn, the elements are objects. further down the recursion rabbithole...
					if(type == "object") {
						properties[property]["items"]= {schema: json2swaggerProperties(JSON.stringify(content[property][0]))}
					}
					// swagger has no support for "undefined" types, so we make it an object
					if(type == "undefined"){
						type = "object"
					}
					// ok, its just an array. set the element type and we're good.
					properties[property]["items"] = {type: type}
			}
		}
	}
	return properties
}
