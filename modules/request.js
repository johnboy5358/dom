import { choose, compose, id } from '../../fn/module.js';

const assign = Object.assign;

/*
config

```{
	headers:    fn(data),    // Must return an object with properties to add to the header
	body:       fn(data),    // Must return an object to send as data
	onresponse: function(response)
}```
*/

export const config = {
    // Takes data, returns headers
	headers: function(data) { return {}; },

	// Takes data (can be FormData object or plain object), returns data
	body: id,

	// Takes response, returns response
	onresponse: function(response) {
		// If redirected, navigate the browser away from here. Can get
		// annoying when receiving 404s, maybe not a good default...
		if (response.redirected) {
			window.location = response.url;
			return;
		}

		return response;
	}
};

const createHeaders = choose({
	'application/x-www-form-urlencoded': function(headers) {
		return assign(headers, {
			"Content-Type": 'application/x-www-form-urlencoded',
			"X-Requested-With": "XMLHttpRequest"
		});
	},

	'application/json': function(headers) {
		return assign(headers, {
			"Content-Type": "application/json; charset=utf-8",
			"X-Requested-With": "XMLHttpRequest"
		});
	},

	'multipart/form-data': function(headers) {
		return assign(headers, {
			"Content-Type": 'multipart/form-data',
			"X-Requested-With": "XMLHttpRequest"
		});
	},

	'audio/wav': function(headers) {
		return assign(headers, {
			"Content-Type": 'audio/wav',
			"X-Requested-With": "XMLHttpRequest"
		});
	},

	'default': function(headers) {
		return assign(headers, {
			"Content-Type": 'application/x-www-form-urlencoded',
			"X-Requested-With": "XMLHttpRequest"
		});
	}
});

const createBody = choose({
	'application/json': function(data) {
		return data.get ?
			formDataToJSON(data) :
			JSON.stringify(data);
	},

	'application/x-www-form-urlencoded': function(data) {
		return data.get ?
			formDataToQuery(data) :
			dataToQuery(data) ;
	},

	'multipart/form-data': function(data) {
		// Mmmmmhmmm?
		return data.get ?
            data :
            dataToFormData(data) ;
	}
});

const responders = {
	'text/html':           respondText,
	'application/json':    respondJSON,
	'multipart/form-data': respondForm,
	'application/x-www-form-urlencoded': respondForm,
	'audio':               respondBlob,
	'audio/wav':           respondBlob,
	'audio/m4a':           respondBlob
};


function assignConfig(target, object, data) {
	// Assigns value unless value is a function, in which case assigns
	// the result of running value(data)
	for (name in object) {
		target[name] = typeof object[name] === 'function' ?
			object[name](data) :
			object[name] ;
	}

	return target;
}

function formDataToJSON(formData) {
	return JSON.stringify(
		// formData.entries() is an iterator, not an array
		Array
		.from(formData.entries())
		.reduce(function(output, entry) {
			output[entry[0]] = entry[1];
			return output;
		}, {})
	);
}

function formDataToQuery(data) {
	return new URLSearchParams(data).toString();
}

function dataToQuery(data) {
	return Object.keys(data).reduce((params, key) => {
		params.append(key, data[key]);
		return params;
	}, new URLSearchParams());
}

function dataToFormData(data) {
    throw new Error('TODO: dataToFormData(data)');
}

function urlFromData(url, data) {
	// Form data
	return data instanceof FormData ?
		url + '?' + formDataToQuery(data) :
		url + '?' + dataToQuery(data) ;
}

function createOptions(method, mimetype, data, controller) {
	return method === 'GET' ? {
		method:  method,
		headers: createHeaders(mimetype, config.headers ? config.headers(data) : {}),
		credentials: 'same-origin',
		signal: controller && controller.signal
	} : {
		method:  method,
		// Process headers before body, allowing us to read a CSRFToken,
        // which may be in data, in createHeaders() before removing it
        // from data in body().
		headers: createHeaders(mimetype, config.headers ? config.headers(data) : {}),
		body:    createBody(mimetype, config.body ? config.body(data) : data),
		credentials: 'same-origin',
		signal: controller && controller.signal
	} ;
}

function throwError(object) {
	throw object;
}

function respondBlob(response) {
	return response.blob();
}

function respondJSON(response) {
	return response.json();
}

function respondForm(response) {
	return response.formData();
}

function respondText(response) {
	return response.text();
}

function respond(response) {
	if (config.onresponse) {
		response = config.onresponse(response);
	}

	if (!response.ok) {
		throw new Error(response.statusText + '');
	}

	// Get mimetype from Content-Type, remembering to hoik off any
	// parameters first
	const mimetype = response.headers
		.get('Content-Type')
		.replace(/\;.*$/, '');

	return responders[mimetype](response);
}


/*
request(type, mimetype, url, data)
*/

export default function request(type = 'GET', mimetype = 'application/json', url, data) {
	const method = type.toUpperCase();

	// If this is a GET and there is data, append data to the URL query string
	if (method === 'GET' && data) {
		url = urlFromData(url, data);
	}

	// param[4] is an optional abort controller
	return fetch(url, createOptions(method, mimetype, data, arguments[4]))
	.then(respond);
}

/*
requestGet(url)
A shortcut for `request('get', 'application/json', url)`
*/

export function requestGet(url) {
	return request('GET', 'application/json', url, {});
}

/*
requestPatch(url, data)
A shortcut for `request('patch', 'application/json', url, data)`
*/

export function requestPatch(url, data) {
	return request('PATCH', 'application/json', url, data);
}

/*
requestPost(url, data)
A shortcut for `request('post', 'application/json', url, data)`
*/

export function requestPost(url, data) {
	return request('POST', 'application/json', url, data);
}

/*
requestDelete(url, data)
A shortcut for `request('delete', 'application/json', url, data)`
*/

export function requestDelete(url, data) {
	return request('DELETE', 'application/json', url, data);
}

/*
throttledRequest(type, mimetype, url)
*/

function ignoreAbortError(error) {
	// Swallow AbortErrors, since we generate one every time we use
	// the AbortController.
	if (error.name === 'AbortError') {
		console.log('Request aborted by throttle. Nothing to worry about.');

		// JS promises have no machanism to conditionally catch different
		// types of error – throw undefined to fall through to the next
		// catch without a value.
		throw undefined;
	}

	// Rethrow all other errors
	throw error;
}

export function throttledRequest(type, mimetype, url) {
	var promise, controller;

	return function throttle(data) {
		var p;

		if (promise) {
			// Cancel previous request
			controller.abort();
		}

		controller = new AbortController();

		return promise = p = request(type, mimetype, url, data, controller)
		.finally(() => {
			// Promise may not be the same promise by the time we get here
			if (promise !== p) { return; }
			promise    = undefined ;
			controller = undefined ;
		})
		.catch(ignoreAbortError);
	};
};