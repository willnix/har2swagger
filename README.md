# har2swagger
har2swagger extracts JSON swagger.io descriptions from a log file in the HTTP Archive format (HAR).
It has been created to speed up the process of reverse engineering JSON REST APIs.
Logging the normal use of an API with a software like Charles Proxy - which can export HAR files - and then using har2swagger to create a swagger description can be a quick and easy way to document an unknown API.
Since there are several code genration tools for swagger, even the creation of client/server software can be automated.


#### *WARNING*

I suck at node.js and only used it because it seemed most suitable for parsing and generating JSON.
The tool is a very basic proof of concept and is mainly released as inspiration.
