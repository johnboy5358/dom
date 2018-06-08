var mimetypes = {
	xml:  'application/xml',
	html: 'text/html',
	svg:  'image/svg+xml'
};

export default function parse(type, string) {
	if (!string) { return; }

	var mimetype = mimetypes[type];
	var xml;

	// From jQuery source...
	try {
		xml = (new window.DOMParser()).parseFromString(string, mimetype);
	} catch (e) {
		xml = undefined;
	}

	if (!xml || xml.getElementsByTagName("parsererror").length) {
		throw new Error("dom: Invalid XML: " + string);
	}

	return xml;
}
