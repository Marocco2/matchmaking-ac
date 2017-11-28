/// <reference path="../../js/ui.js" />

(function (UIOnline, $, __ACc, undefined) {

	/*
	Note to modders:
	It'll be much easier to create a stand-alone module for any modifications you require.
	This will guarantee that any additions you make aren't overwritten by updates.
	As an example look at the "Clock" module in the modules folder.
	*/

	var _container, _language, _searchtimer, _msgtimer,
	    _sortby, _inverse = false, _servers,
	    _selectedServerEntry = null,
		_bookedServer, _onlineTimer = 0, _detailTimer, _onlinecar, _refreshing = false, _makingbooking = false, _refreshlingplayers = false, _displayedwarning = true, _pingingservers = false, _debouncetimer = {}, _pingtimers = [], _currentrequest, _joinedservers = [];

	var $container,
		$serverdetails = $(".list .serverdetails", _container),
		$msg = $(".serverdetails .container .message", _container),
		$btnBook = $(".serverdetails .servercontrols .button[data-mode=booking]", _container),
		$btnCancel = $(".serverdetails .servercontrols .button[data-mode=unsubscribe]", _container),
		$onlineTimer, $dialogPassword;

	var cars = __AC.Cars,
	    tracks = __AC.Tracks;

	var timerPosition = { x: null, y: null };

	function initOnline(c, l) {
		_container = c;
		_language = l;

		$container = $(c);

		$("<link/>", {
			rel: "stylesheet",
			type: "text/css",
			href: "modules/online/online.css?" + Date.now()
		}).appendTo("head");

		if ($("#wrapper > div.onlineTimer").length == 0) {
			$onlineTimer = $("div.onlineTimer", _container);
			$onlineTimer.appendTo("#wrapper");

			$onlineTimer.enabledrag({
				mouseup: function (x, y) {
					timerPosition.x = x, timerPosition.y = y;
					$onlineTimer.removeClass("drag").css("-webkit-transition", "");
				}
			}).mousedown(function () {
				$onlineTimer.addClass("drag").css("-webkit-transition", "box-shadow 0.5s");
			});
		}

		bindControls();
		console.log(">>> UIOnline init", _container);
	}

	var filter = {
		getmask: function () {
			var m = 0;
			$.each(this, function (i, b) {
				if (typeof (i) === "function") return true;
				if (b.v) m += b.i;
			});
			return m;
		}
	};

	function initDialogs() {

	}

	var isChecked = function (option) {
		return $(".controls input[type=checkbox][data-mode='" + option + "']", _container).prop("checked");
	};

	var updateFilter = function () {
		var x = 1;
		$(".controls input[type=checkbox][data-mode]", _container).each(function () {

			var mode = $(this).data("mode");
			if (mode) {
				filter[mode] = {}; filter[mode].v = $(this).prop("checked"); filter[mode].i = x;
				x += x;
			}
		});

	};

	function buildmask(array) {
		var m = 0;
		var x = 1;
		$.each(array, function (i, b) {
			if (b) m += x;
			x = x + x;
		});

		return m;
	}

	var applyFilter = function () {

		if (filter.pickup.v) {
			$(".online .list .item:not(.pickuprace)").addClass("hidden");
			$("input[type=checkbox][data-mode=booking]").prop("checked", false);
			filter.booking.v = false;
		}

		console.log(filter, filter.getmask());

		$("input[type=checkbox][data-mode=booking]").prop("disabled", filter.pickup.v);

		var totalitems = $(".online .list .item").length;

		var $items = filter.pickup.v ?
			$(".online .list .item.pickuprace") :
			$(".online .list .item");

		$items.each(function () {
			var $this = $(this),
				server = $this.data("server");

			var mainfilter = ((server.clients == 0 && !filter.empty.v) ||
					(server.clients == server.maxclients && !filter.full.v) ||
					(server.session != 0 && filter.booking.v) ||
					(server.pass && !filter.locked.v) ||
					(_joinedservers.indexOf(server.ip + "_" + server.port) == -1 && filter.joined.v) ||
					$this.is(".unknowntrack,.unknowncar") && filter.known.v					);
			
			//if ($this.is(".unknowntrack,.unknowncar")) $this.toggleClass("hidden", filter.known.v);

			$this.toggleClass("hidden", mainfilter);
			

			if ($this.hasClass("selected") && $this.hasClass("hidden"))
				hideServerDetails();
		});



		$("thead .name span > span", _container).html($(".online .list .item:not(.hidden)").length + "/" + totalitems);
	};

	function doDebounce(timer, target, time, extrafunction) {
		if (!time) time = 5000;
		_debouncetimer[timer] = setTimeout(function () {
			_debouncetimer[timer] = null;
			target.removeClass("disabled");
			if (typeof extrafunction === "function") extrafunction();
		}, time);
	}

	function bindControls() {

		$(document).on("click", _container + " .link", function () {
			$.ACCall("browseto", "url=" + $(this).data("url"));
		})

		UI.bind.widgets(_container + " .list .controls");

		updateFilter();

		$(document).on("mousewheel", _container + " .tdatalist", function (e) {
			var e0 = e.originalEvent,
				delta = e0.wheelDelta;

			this.scrollTop += (delta < 0 ? 1 : -1) * 30;
			e.preventDefault();
		});

		$(document).on({
			click: function () {
				var $this = $(this);

				if ($this.hasClass("selected")) {
					$this.removeClass("selected");
					hideServerDetails();
				} else {
					$this.selected();
					_selectedServerEntry = $this;
					showServerDetails($this.data("server"));
					focusOnSelected();
					//$(".tdatalist", _container).animate({ scrollTop: $this.position().top }, 500);
				}
			}
		}, _container + " .tdatalist .item");

		$(document).on("click", ".online .serverdetails .servername", focusOnSelected);

		$("div.message", _container).on("click", function () {
			clearTimeout(_msgtimer);
			$(this).removeClass("active");
		});

		$container.on("click", ".controls .button:not(.disabled), .servercontrols .button:not(.disabled)", function (event) {
			var mode = $(this).data("mode");
			var $this = $(this);
			var server = getSelectedServerEntry().data("server");
			var handler = {
				ping: function () {
					//if (!_debouncetimer[mode]) {
					pingAll();

					//}
					//doDebounce(mode, $this);
				},
				refresh: function () {

					//if (!_debouncetimer.refresh) {
					refreshServers();
					//$this.addClass("disabled");
					//}

					//doDebounce(mode, $this);

				},
				help: function () {
					if (UIHelp) UIHelp.show("online");
				},
				booking: function () {
					if (server.cars.length == 1)
						$(".serverdetails .carlist .value > div", _container).eq(0).click();
					subscribe(
						server,
						UI.player.car(),
						UI.player.skin(),
						UIProfile.getFullName(),
						"",
						__AC.getPlayerGuid(),
						server.pass ? $(".serverdetails .serverpass").val() : ""
					);
					$(".disabled[data-mode=unsubscribe]").removeClass(".disabled");
				},
				reloadserver: function () {
					if (!_debouncetimer.reloadserver) {
						refreshSelectedServer();
						$this.addClass("disabled");
					}
					doDebounce(mode, $this);

				},
				playerlist: function () {

					if (!_debouncetimer.playerlist) {
						updatePlayerList(getSelectedServerEntry().data("server"));
						$this.addClass("disabled");
					}
					doDebounce(mode, $this);
				},
				unsubscribe: function () { unsubscribe(false, server) },
				join: function () {
					join(server);
				}
			}[mode]();
		});

		$container.on({
			click: function () {
				$(this).selected();
				UI.player.setCar(cars[$(this).data("id")]);
				_onlinecar = $(this).data("id");
			}
		}, ".carlist .value > div:not(.unknown):not(.disabled)");

		$onlineTimer.on("click", ".controls span", function () {
			var mode = $(this).data("mode");
			var handler = {
				unsubscribe: unsubscribe,
				join: join
			}[mode]();
		});

		function focusOnSelected() {
			var offset = $(".tdatalist .item.selected", _container).position().top;
			$(".tdatalist", _container).animate({ scrollTop: "+=" + offset }, 500);
		};

		function applyTextFilter() {
			var searchbox = $(".controls .serversearch", _container);
			$(".tdatalist .item:not(.selected):not(.hidden)", _container).each(function () {
				//var search = $(".name", $(this)).text().toLowerCase();

				var search = [];
				search.push($(".name", $(this)).text());
				//search.push(c.brand);
				//if ($(this).hasClass("selected")) search.push("selected");
				//search = search.concat(c.tags);
				search = search.toString().toLowerCase();
				var fullstr = searchbox.val().toLowerCase();
				var splitstr = fullstr.replace(/(!\S+)/g, "").match(/\S+/g);
				var excludestr = fullstr.match(/(!\S+)/g);

				var tofind = splitstr ? "(" + splitstr.join("|") + ")" : "";

				var exclude = excludestr ? "(" + excludestr.join("|").replace(/!/g, "") + ")" : "NONEEXCLUDED";

				if (splitstr) {

					if (search.match(new RegExp(tofind, 'g')) && !search.match(new RegExp(exclude, 'g')))
						$(this).removeClass("keyfiltered");
					else
						$(this).addClass("keyfiltered");
				}
				else {

					if (search.match(new RegExp(exclude, 'g')))
						$(this).addClass("keyfiltered");
					else
						$(this).removeClass("keyfiltered");
				}

				/*if (search.indexOf(searchbox.val().toLowerCase()) > -1)
					$(this).removeClass("keyfiltered");
				else
					$(this).addClass("keyfiltered");*/
			});
		}

		$(".controls .serversearch", _container).on({
			keyup: function (e) {
				var searchbox = $(this);
				if (searchbox.val().length > 1) {
					window.clearTimeout(_searchtimer);

					if (e.isTrigger) applyTextFilter();
					else
						_searchtimer = window.setTimeout(applyTextFilter, 500);
				} else {
					window.clearTimeout(_searchtimer);
					$(".tdatalist .item", _container).removeClass("keyfiltered");
				}
				$(".serversearch", _container).not(this).val($(this).val());
			}
		});

		$("thead td", _container).on("click", function () {

			_sortby = $(this).data("mode");

			$(this).selected().toggleClass("inverted", (_sortby == "clients") ? !_inverse : _inverse)
					.siblings().removeClass("inverted");

			

			sortBy(_sortby, (_sortby == "clients") ? !_inverse : _inverse);


			_inverse = !_inverse;

		});

		$("input[type=checkbox][data-mode]", _container).on("click", function () {
			var mode = $(this).data("mode");
			filter[mode].v = isChecked(mode);

			applyFilter();
		});
	}

	function sortBy(colname, invert) {
		console.log("UIOnline >>> sorting by:", colname, invert);
		$(".tdatalist", _container).addClass("sorting");
		$(".tdatalist td." + colname, _container).sortElements(function (a, b) {

			a = $(".value", a).text();
			b = $(".value", b).text();
			a = isNaN(a) ? a : +a;
			b = isNaN(b) ? b : +b;
			if (colname == "ping") {
				a = isNaN(a) ? (invert ? -1 : 1) * 90000 : a;
				b = isNaN(b) ? (invert ? -1 : 1) * 90000 : b;
			}
			return (a > b) ? (invert ? -1 : 1) : (invert ? 1 : -1);
		}, function () {
			return this.parentNode;
		});
		$(".tdatalist", _container).removeClass("sorting");
		if ($("item.selected", _container).length > 0)
			$(".tdatalist", _container).animate({ scrollTop: $(".item.selected", _container).position().top }, 500);
	}

	function showMsg(msgtext, timeout, cssclass) {
		console.log(msgtext);
		if (!timeout) timeout = 3000;
		$msg.html(msgtext).addClass("active");
		if (cssclass) $msg.addClass(cssclass);
		_msgtimer = window.setTimeout(function () {
			$msg.removeClass("active");
			if (cssclass) $msg.removeClass(cssclass);
		}, timeout);
	}

	function resetTimerPanel() {
		$onlineTimer.removeClass("active ready").removeAttr("style");
	}

	var _canjoin;

	function join(server) {
		var targetserver, guid = __AC.getPlayerGuid();

		if (server) {
			if (server.pickup === true) _canjoin = true;
			if ($(".carlist .value > div.selected", _container).length == 0) {
				showMsg("Please select a car supported by the server.");
				$(".serverdetails .carlist", _container).removeClass("highlight", 2000).addClass("highlight");
				return;
			}
			if (_canjoin === true) {
				if (_bookedServer
					&& _bookedServer.ip != server.ip
					&& _bookedServer.port != server.port) unsubscribe();

				$.ACClearSections("REMOTE");

				$.ACSet("race?REMOTE/SERVER_IP", server.ip);

				$.ACSet("race?REMOTE/SERVER_PORT", server.tport && server.tport != 0 ? server.tport : server.port);
				$.ACSet("race?REMOTE/SERVER_NAME", encodeURIComponent(server.name.replace(/[\[\]\;]/gi," ")));
				$.ACSet("race?REMOTE/SERVER_HTTP_PORT", server.cport);
				$.ACSet("race?REMOTE/REQUESTED_CAR", $(".carlist .value > div.selected", _container).data("id"));
				$.ACSet("race?REMOTE/NAME", UIProfile.getFullName());
				$.ACSet("race?REMOTE/TEAM", "");

				var password = server.pass === true ? __AC.getDbValue("serverpass_" + server.name) : "";
				password = server.pickup === true ? $(".serverdetails .serverpass").val() : password;
				if (server.pickup === true) __AC.setDbValue("serverpass_" + server.name, password);

				$.ACSet("race?REMOTE/PASSWORD", password);


				$.ACSet("race?CAR_0/SETUP", "");
				$.ACSet("race?CAR_0/MODEL", "-");
				$.ACSet("race?CAR_0/SKIN", UI.player.skin());
				$.ACSet("race?CAR_0/DRIVER_NAME", UIProfile.getFullName());
				$.ACSet("race?CAR_0/NATIONALITY", UIProfile.getCountry());
				$.ACSet("race?CAR_0/NATION_CODE", UIProfile.getCountryCode());

				$.ACSet("race?REMOTE/GUID", guid);
			}
			targetserver = server;
		} else {
			if (!$onlineTimer.hasClass("ready")) return;
			targetserver = _bookedServer;
		}

		if (!_canjoin)
			msgServer(targetserver, "CANJOIN", guid, function (response) {
				_canjoin = response == "YES";
				if (_canjoin) join(targetserver);
				else showMsg("Cannot join server currently, please refresh the server info.");
			});

		if (typeof _canjoin === "undefined") return;

		if (_canjoin === false) {
			showMsg("Cannot join server currently, please refresh the server info.");
			return;
		}

		$.ACSet("race?REPLAY/ACTIVE", 0);
		$.ACSet("race?REMOTE/ACTIVE", 1);

		$("html,body").addClass("ACactive");
		_canjoin = undefined;

		$.ACCall("start");
		resetTimerPanel();
		_joinedservers.push(server.ip + "_" + server.port);

		console.log("UIOnline >>> joining " +
					targetserver.name + " ::: " +
					targetserver.ip + ":" + targetserver.port);
		if (!targetserver.pickup) {
			hideServerDetails();
			_bookedServer = null;
		}
	}

	function isBookedServer(server) {
		if (!server) return false;
		return (_bookedServer &&
			(_bookedServer.ip == server.ip && _bookedServer.port == server.port) ? true : false);
	}

	function doTimers() {
		$(".tdatalist .item").each(function () {
			var $this = $(this),
			    server = $this.data("server");
			if (server.session == 3 || (isBookedServer(server) && server.session == 0)) return;
			if (server.timeleft > 0) server.timeleft--;
			if ($this.hasClass("selected")) updateSessionList(server);
		});
	}

	function subscribe(server, car, skin, driver, team, guid, password) {

		if (_makingbooking) return;

		var params = [car.id, skin, driver.replace(/\|/g, "."), team.replace(/\|/g, "."), guid, password];

		var url = "http://" + server.ip + ":" + server.cport + "/SUB|" + encodeURIComponent(params.join("|"));
		console.log("UIOnline >>>", "SUB", "prev", _bookedServer);
		console.log("UIOnline >>>", "booking", server.name);
		_makingbooking = true;

		_currentrequest = $.ajax({
			url: url,
			async: true,
			timeout: 30000,
			cached: false
		}).done(function (data) {

			var response = data.split(",");
			var timeleft = isNaN(response[1]) ? null : parseInt(response[1]);
			console.log("server responds: " + timeleft, timeleft * 1000);

			var h = {

				"ILLEGAL CAR": function () {
					showMsg("Please select a car supported by the server.");
					$(".serverdetails .carlist", _container).removeClass("highlight", 2000).addClass("highlight");

				},

				"INCORRECT PASSWORD": function () {
					showMsg("The password you have provided is not valid.");
				},

				CLOSED: function () {
					showMsg("Server not currently accepting bookings.");
					$btnBook.addClass("disabled");
				},
				BLACKLISTED: function () {
					showMsg("You have been blacklisted on this server.");
					$btnBook.addClass("disabled");
				},
				OK: function () {
					if (password) {
						__AC.setDbValue("serverpass_" + server.name, password);
					}

					unsubscribe(true, _bookedServer, function () {
						if (timeleft)
							showMsg("Booking made, next session starts in " + $.formatTime(timeleft * 1000, true) + "");

						$(".servername", $onlineTimer).text(server.name);
						$(".trackname", $onlineTimer).text(tracks[server.track].name);
						$(".carname", $onlineTimer).text(cars[_onlinecar].name);
						$(".bgr", $onlineTimer).css("background-image", "url('" + tracks[server.track].preview + "')");


						_bookedServer = server;
						if (timeleft)
							_bookedServer.timeleft = timeleft;
						if (timerPosition.x != null && timerPosition.y != null)
							$onlineTimer.css("top", timerPosition.y).css("left", timerPosition.x);
						$onlineTimer.addClass("active");
						//$btnBook.addClass("disabled");
						$btnCancel.removeClass("disabled");

						//$.ACSet("race?REMOTE/SERVER_IP", server.ip);
						//$.ACSet("race?REMOTE/SERVER_PORT", server.port);
						//$.ACSet("race?REMOTE/NAME", UIProfile.getFullName());
						//$.ACSet("race?REMOTE/GUID", guid);

						//_selectedServerEntry = getSelectedServerEntry();
						_selectedServerEntry.data("server").clients++;
						//console.log("selected", _selectedServerEntry.data("server"));
						updateServerEntry(_selectedServerEntry, null, null, true);
						startOnlineTimer();
						console.log("UIOnline >>>", "booking success", server.name);
					}, _bookedServer == server);
				},

				"SERVER FULL": function () {
					showMsg("Server full.");
					//$btnBook.addClass("disabled");
				}
			};
			if (h[response[0].toUpperCase()]) h[response[0].toUpperCase()]();
			else {
				showMsg("Server responded with: " + response[0]);
				console.log(">>> Online " + response);
				console.log(">>> Online " + url);
			}

			_makingbooking = false;

		}).error(function (err) {
			unableToContact(server.name);
			_makingbooking = false;
		});
	}

	function unableToContact(servername) {
		showMsg("Unable to contact server: " + servername);
	}

	function unsubscribe(show, server, callback, condition) {

		if ((!_bookedServer && !server) || condition) {
			if (typeof callback === "function") callback();
			console.log("unsub not required");
			return;
		}

		var targetserver = server ? server : _bookedServer;


		var unsubname = targetserver.name;
		var url = "http://" + targetserver.ip + ":" + targetserver.cport + "/UNSUB|" + __AC.getPlayerGuid();
		console.log("UIOnline >>>", "unsub request", unsubname);

		_currentrequest = $.ajax({
			url: url,
			async: true,
			timeout: 30000,
			cached: false
		}).done(function (data) {
			if (server && _bookedServer != server) {
				console.log("UIOnline >>>", "unsub success", unsubname);
				updatePlayerList(targetserver);
				delete server.hasPlayer;
				return;
			}

			clearInterval(_onlineTimer);

			if (!show) {
				resetTimerPanel();
				hideServerDetails();
				$(".tdatalist .item", _container).removeClass("selected");
			}

			_bookedServer = null;

			var bookedserverentry = getBookedServerEntry();

			var bookedserverentryserver = getBookedServerEntry().data("server");
			//console.log(bookedserverentry, bookedserverentryserver);

			bookedserverentryserver.clients--;
			updateServerEntry(bookedserverentry, bookedserverentryserver, null, true);

			bookedserverentry.removeClass("currentlybooked");

			console.log("UIOnline >>>", "unsub success", unsubname);

			if (typeof callback === "function") callback();
		}).error(function (err) {
			unableToContact(unsubname);
		});;
	}

	function startOnlineTimer() {

		clearInterval(_onlineTimer);

		_onlineTimer = setInterval(function () {
			if (!_bookedServer) {
				clearInterval(_onlineTimer);
				resetTimerPanel();
			}

			if (_bookedServer.timeleft > 0) {
				_bookedServer.timeleft--;
			} else {
				$onlineTimer.addClass("ready");
				clearInterval(_onlineTimer);
				_bookedServer.session = _bookedServer.sessiontypes[1];
				_bookedServer.timeleft = _bookedServer.durations[1];
				updatePlayerList(getSelectedServerEntry().data("server"));
				//refreshServers();
				return;
			}
			$(".timer .value", $onlineTimer).html($.formatTime((_bookedServer.timeleft) * 1000, true));
			if (isBookedServer(getSelectedServerEntry().data("server")))
				updateSessionList(_bookedServer);

		}, 1000);
	}

	function refreshSelectedServer() {
		var server = getSelectedServerEntry().data("server");
		console.log("refreshing ", server);
		$(".serverdetails", _container).addClass("loading");

		_currentrequest = $.ajax({
			url: UIOnline.LAN ? "http://" + server.ip + ":" + server.cport + "/INFO" : "ac://getserver",

			async: true,
			timeout: 120000,
			data: { async: true, ip: server.ip, port: server.port },
			dataType: "json",
			cache: false
		}).done(function (data) {
			//var server = data;
			if (UIOnline.LAN) {
				data.ip = server.ip;
				data.l = true;

				$.each(data.durations, function (i, o) {
					if (data.sessiontypes[i] != 3 && o < 60) {
						data.durations[i] = o * 60;
					}

					if (data.sessiontypes[i] == 3 && data.timed) {
						data.durations[i] = o * 60;
					}
				});
			}
			getSelectedServerEntry().data("server", data);
			updateServerEntry(getSelectedServerEntry(), data);
		}).error(function (xhr, status, error) {
			unableToContact(server.name);
		}).always(function () {
			$(".serverdetails", _container).removeClass("loading");
		});

	}

	function refreshServers() {
		if (_refreshing) {
			console.log(">>> UIOnline : currently refreshing");
			return;
		}

		if (!__AC.getDbValue("onlinedisclaimer")) {
			UI.closeOverlay(true);
			UI.displayDialog(
				".yesno",
				$(".disclaimer", _container).clone(),
				function () {
					UI.closeDialog(true, "withlogo onlinedisclaimer");
					UI.closeOverlay(true);
					__AC.setDbValue("onlinedisclaimer", true);
					refreshServers();
				}, function () {
					$("#drive .tabs div[data-mode=practice]").click();
					UI.closeDialog();
				}, "I agree", "I disagree", "withlogo onlinedisclaimer");
			return;
		}

		if (!_displayedwarning) {
			UI.closeOverlay(true);
			UI.displayDialog(
				".notice",
				$(".featurewarning", _container).clone(),
				function () {
					UI.closeDialog(true, "withlogo featurewarning");
					UI.closeOverlay(true);
					_displayedwarning = true;
					refreshServers();
				},
				null, "continue", null, "withlogo featurewarning", true);
			return;
		}

		_refreshing = true;

		if (!_bookedServer)
			hideServerDetails();

		var list = $(".tdatalist", _container);
		var template = $("table.template .item", _container);
		list.html("<tr class='spacer'></tr>");
		$container.addClass("loading");
		$(".button[data-mode=ping], .button[data-mode=refresh]", _container).addClass("disabled");

		_currentrequest = $.ajax({
			url: UIOnline.LAN ? "ac://getlanservers?async=true" : "ac://getserverlist?async=true",
			async: true,
			timeout: 120000,
			dataType: "json",
			cache: false
		}).done(function (data) {
			_servers = data;

			$.each(data, function (index, server) {
				if (UIOnline.LAN) {
					$.each(server.durations, function (i, o) {
						if (server.sessiontypes[i] != 3 && o < 60) {
							server.durations[i] = o * 60;
						}
						if (server.sessiontypes[i] == 3 && server.timed) {
							server.durations[i] = o * 60;
						}
					});
				}
				try {
					var item = template.clone(false);
					updateServerEntry(item, server);
					list.append(item);
				} catch (err) {
					console.log(err.stack);
				}
			});

			if ($(".currentlybooked", list).length == 0) {
				if (_bookedServer) $("#msg").addMsg($.getl18n("previously booked server unavailable", _language), "controller_msg", true, 6000);
				resetTimerPanel();
				_bookedServer = null;
				clearInterval(_onlineTimer);
				hideServerDetails();

			}

			applyFilter();

			//if (_sortby == "name")
			sortBy(_sortby, (_sortby == "name") ? !_inverse : _inverse);



			
			$(".controls .serversearch", _container).keyup();

			if (_servers.length > 0)
				setTimeout(pingAll, 1000);
			else {
				if (UIOnline.LAN)
					$("#msg").addMsg($.getl18n("No servers found on LAN. Please check firewall configuration and set server UDP port in the 9000 to 10000 range.", _language), "controller_msg", true, 15000);
				$(".button[data-mode=ping], .button[data-mode=refresh]", _container).removeClass("disabled");
				_pingingservers = false;
			}

			clearInterval(_detailTimer);
			_detailTimer = setInterval(doTimers, 1000);
			_refreshing = false;


			//$("thead .name span > span", _container).html(data.length);

		}).error(function (xhr, status, error) {
			$(".button[data-mode=refresh]", _container).removeClass("disabled");

			if (status != "abort") {
				console.log("Cannot contact lobby " + xhr.responseText + " // " + status + " // " + error);
				$("#msg").addMsg($.getl18n("cannot retrieve list of servers", _language), "controller_msg", true, 6000);
			}

		}).always(function () {
			_refreshing = false;
			$container.removeClass("loading");
		});

	}

	function updateServerEntry(item, server, silent, ignoreoffset) {

		if (!server) server = item.data("server");

		var timeoffset = Math.round(server.timestamp / 1000);

		//console.log("offset", timeoffset, "timeleft", server.timeleft, "diff", server.timeleft - timeoffset);

		//if (server != _bookedServer)
		if (!ignoreoffset)
			server.timeleft = server.timeleft - timeoffset;

		if (server.timeleft < 0) server.timeleft = 0;

		var stypes = ["B", "P", "Q", "R"];

		item.addClass("sessiontype" + server.session);

		$(".name .value", item).text(server.name);
		$(".clients .value", item).text(server.clients);
		$(".clients .max", item).text(server.maxclients);
		$(".trackname", item).text(tracks[server.track] ? tracks[server.track].name : server.track);

		$(".servercars", item).html("");
		$(".sessiontypes", item).html("");

		var knowntrack = typeof (tracks[server.track]) != "undefined";
		knowntrack = knowntrack ? tracks[server.track].dlc == false : knowntrack;


		if (!knowntrack) {
			$(".trackname", item).addClass("unknown");
			item.addClass("unknowntrack");
			server.unknowntrack = true;
		}

		if (tracks[server.track] && tracks[server.track].pitboxes) {
			if (tracks[server.track].pitboxes < server.maxclients) item.addClass("pitslotsexceeded");
		}


		$(".serverlocation", item).text(server.country ? server.country[0] : "");

		$.each(server.sessiontypes, function (stindex, sessiontype) {
			var st = $("<span/>").text(stypes[sessiontype]);
			if (sessiontype == server.session) st.addClass("active");
			$(".sessiontypes", item).append(st);
		});

		$.each(server.cars, function (carindex, carid) {
			carid = carid.toLowerCase();

			var knowncar = typeof (cars[carid]) != "undefined";
			knowncar = knowncar ? cars[carid].dlc == false : knowncar;

			var cr = $("<span/>");
			if (!knowncar) {
				cr.addClass("unknown");
				item.addClass("unknowncar");
				server.unknowncar = true;
			}
			var c = cars[carid] ? cars[carid].name : carid;
			cr.text(c);
			$(".servercars", item).append(cr);
		});

		if ($(".ping .value", item).text() == "...")
			$(".ping .value", item).addClass("loading");

		if (isBookedServer(server)) {
			_bookedServer = server;
			item.addClass("currentlybooked");
		}

		item.toggleClass("passprotected", server.pass);
		item.toggleClass("pickuprace", server.pickup === true);

		if (!silent && (item.hasClass("currentlybooked") || item.hasClass("selected"))) {
			showServerDetails(server);
			item.selected();
		}

		if (silent && item.hasClass("currentlybooked") && item.hasClass("selected")) {
			showServerDetails(server);
		}


		//item.data("index", index);
		item.data("server", server);
	}

	function pingAll() {
		var sum = 0;
		var $items = $(".tdatalist .item:not(.hidden):not(.keyfiltered)", _container);
		var total = $items.length;
		var time = 50;
		var $pingcounter = $(".pingcount", _container);
		if ($items.length == 0) {
			$(".button[data-mode=ping], .button[data-mode=refresh]", _container).removeClass("disabled");
			return;
		}
		$(".button[data-mode=ping]", _container).addClass("disabled");
		$(".button[data-mode=refresh]", _container).addClass("disabled");
		if (!_pingingservers)
			$items.each(function (index, item) {
				var $this = $(this);
				var server = $this.data("server");

				var $ping = $(".ping", item).addClass("loading");
				$pingcounter.addClass("selected");
				//if (getPingAbort()) return;
				_pingtimers.push(
					setTimeout(function () {

						_pingingservers = true;
						//console.log("Pinging " + server.ip);

						_currentrequest = $.ajax({
							url: "ac://pingserver?async=true&ip=" + server.ip + "&port=" + server.port,
							async: true,
							cache: false,
							timeout: 10000
						}).done(function (pingdata) {
							//if (getPingAbort()) return;
							var pingresponse = pingdata[0];
							if (pingresponse != "-1") {
								$this.removeClass("noping");
								$ping.removeClass("loading");
								$(".value", $ping).text(pingresponse);
							} else {
								$this.addClass("noping");
								$(".value", $ping).text("n/a");
							}
							$(".pingcount > span", _container).html(sum + "/" + total);
							//console.log(sum, "Pinged " + server.ip + " : " + pingresponse + "ms");
						}).error(function () {

							$this.addClass("noping");
							$(".value", $ping).text("n/a");
							console.log(sum, "Error pinging " + server.ip);
						}).always(function () {
							//if (getPingAbort()) return;
							if (_sortby == "ping") {
								if (_debouncetimer.pingsort) clearTimeout(_debouncetimer.pingsort);
								_debouncetimer.pingsort = setTimeout(function () {
									sortBy(_sortby, !_inverse);
								}, 200);
							}
							sum++;
							if (sum == total) {
								_pingingservers = false;
								$(".button[data-mode=ping], .button[data-mode=refresh]", _container).removeClass("disabled");

								$pingcounter.removeClass("selected");
								_pingtimers = [];
							}
						});
					}, time));
				if (index % 10 == 0)
					time = time + 500;
			});

	}

	function ping(server) {

	}

	function hideServerDetails(noparent) {
		$serverdetails.removeClass("active");
		if (!noparent) $container.removeClass("showingdetails");
	}

	function showServerDetails(server) {
		console.log("Showing details for server: " + server.name + " " + server.pickup);
		var $p = $serverdetails;
		$p.data("server", server);

		var knowntrack = typeof (tracks[server.track]) != "undefined";
		knowntrack = knowntrack ? tracks[server.track].dlc == false : knowntrack;
		$(".servername .value", $p).html(server.name);
		console.log(">>> server data", server);
		$p.toggleClass("unknowntrack", server.unknowntrack === true);

		if (tracks[server.track]) {
			$(".trackname", $p).text(tracks[server.track].name);
			$(".trackoutline", $p).css("background-image", "url('" + tracks[server.track].outline + "')");
			$p.css("background-image", "url('" + tracks[server.track].preview + "')");
		} else
			$(".trackname", $p).text(server.track);

		$(".country .value", $p).html(server.country[0]);

		var unknowncar = false;

		$(".carlist", $p).removeClass("highlight");
		$(".carlist .value", $p).html("");
		if (server.pickup !== true)
			$.each(server.cars, function (carindex, carid) {
				carid = carid.toLowerCase();
				var cr = $("<div/>"),
					knowncar = typeof (cars[carid]) != "undefined";

				knowncar = knowncar ? cars[carid].dlc == false : knowncar;

			cr.toggleClass("unknown", !knowncar);

				if (!knowncar && !unknowncar)
					unknowncar = true;

				var c = knowncar ? cars[carid].name : carid;
				cr.html("<span>" + c + "</span>");
				cr.data("id", carid);

				if (!_onlinecar) _onlinecar = UI.combo().car.id;
				if (carid == _onlinecar) cr.addClass("selected");


				$(".carlist .value", $p).append(cr);
			});

		$p.toggleClass("pickupmode", server.pickup === true);
		$p.toggleClass("unknowncar", server.unknowncar === true);

		updateSessionList(server);
		window.setTimeout(function () {
			updatePlayerList(server);
		}, 250);

		if (server.unknowncar || server.unknowntrack)
			$(".message", _container).text("Server Contains Unavailable Content");

		var serverunavailable = (getCurrentSession(server) != 0 || server.maxclients == server.clients) && !isBookedServer(server);
		var currentserver = (isBookedServer(server)) ? false : true;

		$(".servercontrols div[data-mode=booking]").toggleClass("disabled", serverunavailable);
		$(".servercontrols div[data-mode=unsubscribe]").toggleClass("disabled", currentserver || (isBookedServer(server) && server.session != 0));


		if (server.pickup !== true) {
			$(".servercontrols div[data-mode=join]").toggleClass("hidden", !(isBookedServer(server) && server.session != 0));
			/*
			var $joinbtn = $(".servercontrols div[data-mode=join]");
			
			$joinbtn.addClass("disabled");
			doDebounce("joinbutton", $joinbtn, 25000);
			if (_debouncetimer.joinButtonCountdown)
				clearInterval(_debouncetimer.joinButtonCountdown);
			var cnt = 25;
			_debouncetimer.joinButtonCountdown = setInterval(function () {
				$("span", $joinbtn).text(cnt + "sec");
				cnt--;
				if (cnt == 0) {
					$("span", $joinbtn).text("");
					clearInterval(_debouncetimer.joinButtonCountdown);
				}
			}, 1000);
			*/

			$(".servercontrols div[data-mode=booking]").toggleClass("hidden", isBookedServer(server) && server.session != 0);
		}
		//console.log(server.session, isBookedServer(server) && server.session != 0, isBookedServer(server));

		//console.log(isBookedServer(server), server.session, isBookedServer(server) && server.session != 0);

		$serverdetails.addClass("active").toggleClass("passprotected", server.pass);
		var prevpass = __AC.getDbValue("serverpass_" + server.name);
		if (!prevpass) prevpass = "";
		$(".serverpass", $serverdetails).val(prevpass);

		if (tracks[server.track] && tracks[server.track].pitboxes) {
			if (tracks[server.track].pitboxes < server.maxclients) showMsg("<span>WARNING</span> This server's available slots exceed the number of pitboxes for " + tracks[server.track].name, 7000, "smaller");
		}

		$container.addClass("showingdetails");
	}

	function getCurrentSession(server) {
		console.log(" >>>> ", server.sessiontypes[server.session]);
		return server.sessiontypes[server.session];
	}

	function updatePlayerList(server) {
		console.log("Updating player list " + server.ip + ":" + server.cport + " " + server.pickup, server);
		$(".playerlist .value", $serverdetails).html("");
		$(".playerlist h3 span", $serverdetails).html("");

		var total = 0, connected = 0;
		_currentrequest = $.ajax({
			url: "http://" + server.ip + ":" + server.cport + "/JSON|" + __AC.getPlayerGuid(),
			async: true,
			timeout: 10000,
			dataType: "json",
			cache: false
		}).done(function (data) {

			if (data.Cars && data.Cars.length > 0) {

				data.Cars.sort(function (a, b) {
					try {
						var na = a.DriverName.toLowerCase(), nb = b.DriverName.toLowerCase();
						if (na < nb) return -1;
						if (na > nb) return 1;
					} catch (ex) {
						console.log("error sorting!");
						return 0;

					}
				});
			}

			delete server.hasPlayer;

			var availablecars = {};

			$.each(data.Cars, function (i, o) {

				if (typeof (availablecars[o.Model]) === "undefined") availablecars[o.Model] = { l: 0, t: 0 };
				availablecars[o.Model].t += 1;

				if (server.pickup) {

					if (!o.IsConnected) {
						availablecars[o.Model].l += 1;
						return true;
					}
				}



				total++;
				var car = cars[o.Model];
				car = (!car) ? o.Model : car.name;
				var $row = $("<div/>", {
					title: o.IsEntryList ? $.getl18n("Pre-booked by server entry list", _language) : "",
					html: "<span>" + $('<div>').text(o.DriverName).html() + "</span><span>" + $('<div>').text(car).html() + "</span>",
					"class": o.IsConnected ? "connected" : ""
				}).toggleClass("isplayer", o.IsRequestedGUID)
					.toggleClass("entrylist", o.IsEntryList);
				if (o.IsRequestedGUID) server.hasPlayer = o.IsRequestedGUID;
				if (o.IsConnected) connected++;

				$(".playerlist .value", $serverdetails).append($row);
			});

			if (server.pickup) {
				$.each(availablecars, function (i, o) {
					carid = i.toLowerCase();
					var cr = $("<div/>"),
						knowncar = typeof (cars[carid]) != "undefined";

					cr.toggleClass("unknown", !knowncar);

					if (!knowncar && !unknowncar)
						unknowncar = true;

					var c = knowncar ? cars[carid].name : carid;
					cr.html("<span>" + c + " <span>" + o.l + "/" + o.t + "</span></span>");
					if (o.l == 0) cr.addClass("disabled");
					cr.data("id", carid);

					if (!_onlinecar) _onlinecar = UI.combo().car.id;
					if (carid == _onlinecar) cr.addClass("selected");

					$(".carlist .value", $serverdetails).append(cr);

					//$(".carlist .value", $serverdetails).append($row);
				});
			}

			$(".playerlist h3 span", $serverdetails).html("" + connected + "/" + total + "");

			$(".servercontrols div[data-mode=unsubscribe]").toggleClass("disabled", !server.hasPlayer || getCurrentSession(server) != 0);
			$(".servercontrols div[data-mode=join]").toggleClass("hidden", (server.hasPlayer !== true || getCurrentSession(server) == 0) && server.pickup !== true);
			$(".servercontrols div[data-mode=booking]")
					.toggleClass("hidden", ((server.hasPlayer === true) && getCurrentSession(server) != 0))
					.toggleClass("disabled", getCurrentSession(server) != 0);

		}).error(function (err) {
			unableToContact(server.name, err);
		});

	}

	function updateSessionList(server) {
		var stypes = ["Booking", "Practice", "Qualifying", "Race"];

		$(".sessionlist", $serverdetails).html("");
		if (!server.sessiontypes) return;
		server.sessiontypes.forEach(function (s, si) {
			var offset = 0;
			var sr = $("<div/>");
			sr.html(stypes[s] + (s==3 && server.inverted ? " x2" : ""));
			var dur = $("<div/>", { "class": "duration" });
			dur.html(
				(s != 3) ?
					((server.session == s) ?
						$.formatTime(server.timeleft * 1000, true) :
						$.formatTime(server.durations[si] * 1000, true))
				:
				((server.timed === true) ? 
				$.formatTime(server.durations[si] * 1000, true) + (server.extra === true ? "+" : "")
				:
				server.durations[si] + " Laps")

				+ (server.pit ? "<div class='pit'>+Pit</div>" : "")
			);

			sr.toggleClass("current", server.session == s);
			sr.toggleClass("endoftime", server.session == s && server.timeleft <= 0);

			sr.append(dur);
			$(".sessionlist", $serverdetails).append(sr);
		});
	}

	function getSelectedServerEntry() {
		_selectedServerEntry = $(".tdatalist .item.selected", _container);
		return _selectedServerEntry;
	}

	function getBookedServerEntry() {
		return $(".tdatalist .item.currentlybooked", _container);
	}

	function msgServer(server, command, parameters, callback) {
		var output = "";

		_currentrequest = $.ajax({
			url: "http://" + server.ip + ":" + server.cport + "/" + command + "|" + parameters,
			async: true,
			cache: false,
			timeout: 2000
		}).done(function (msg) {
			output = msg;
			callback(output);
		}).fail(function (j, t, e) {
			callback("NO");
			console.log("ERROR > msgServer failed");
		});

		//return output;
	}

	function getPingAbort() {
		return UIOnline.pingAbort;
	}

	UIOnline.Init = initOnline;
	UIOnline.refreshServers = refreshServers;
	UIOnline.getServersList = function () { return _servers; };
	//UIOnline.serverTimers = function () { return servertimers; };
	UIOnline.pingAll = pingAll;
	UIOnline.selectedServer = function () { return _selectedServerEntry; };
	UIOnline.bookedServer = function () { return _bookedServer; };
	UIOnline.filter = filter;
	UIOnline.updateFilter = updateFilter;
	UIOnline.applyFilter = applyFilter;
	UIOnline.updateServerEntry = updateServerEntry;
	UIOnline.refreshSelectedServer = refreshSelectedServer;
	UIOnline.LAN = false;
	UIOnline.pingAbort = false;
	UIOnline.Abort = function (value) {
		if (_currentrequest) _currentrequest.abort();
		$(".button[data-mode=ping]", _container).removeClass("disabled");
		$(".button[data-mode=refresh]", _container).removeClass("disabled");
		$.each(_pingtimers, function (i, v) {
			clearTimeout(v);
		});
		_pingtimers = [];
		_pingingservers = false;
	};
	UIOnline.displayWarning = function (value) {
		if (!value)
			return _displayedwarning;
		_displayedwarning = value;
	};
	UIOnline.isListEmpty = function () {
		return $(".tdatalist .item", _container).length == 0;
	};

}(window.UIOnline = window.UIOnline || {}, jQuery, __ACClasses));