// dom.switchable
//
// Extends the default behaviour of the activate and deactivate
// events with things to do when they are triggered on nodes.

(function(window) {
	"use strict";

	var Fn      = window.Fn;
	var dom     = window.dom;

	// Define

	var name = 'switchable';

	// Functions

	var noop            = Fn.noop;
	var on              = dom.events.on;
	var off             = dom.events.off;
	var trigger         = dom.events.trigger;

	function activate(e) {
		if (!e.default) { return; }

		var target = e.target;
		if (!dom.classes(target).contains(name)) { return; }

		var data  = e.data;
		var nodes = dom('.switchable', target.parentNode).toArray();
		var i     = nodes.indexOf(target);

		nodes.splice(i, 1);
		var active = nodes.filter(dom.matches('.active'));

		e.default();

		// Deactivate the previous active pane AFTER this pane has been
		// activated. It's important for panes who's style depends on the
		// current active pane, eg: .slide.active ~ .slide
		Fn(active).each(dom.trigger('deactivate'));
	}

	function deactivate(e) {
		if (!e.default) { return; }

		var target = e.target;
		if (!dom.classes(target).contains(name)) { return; }

		e.default();
	}

	on(document, 'activate', activate);
	on(document, 'deactivate', deactivate);

})(this);