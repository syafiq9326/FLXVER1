
// var serverUrl = "http://192.168.0.101";
// var userId = "sasdemo";
// var pwd = "Go4thsas";
var serverUrl = "https://apflxdemo.southeastasia.cloudapp.azure.com";
var userId = "viyademo01";
var pwd = "Orion123lnxsas";
var clientID2 = "sas.ec:";
var authorizationForToken = btoa(clientID2);
var SAS_LOGON_URI = "/SASLogon/oauth/token";
var CAS_MGMNT_CONTEXT_URI = "/casManagement/servers";
var REST_ITEM_COUNT_LIMIT = 1000; // number of items to retrieve from REST calls
var body = "grant_type=password&username=" + encodeURIComponent(userId) + "&password=" + encodeURIComponent(pwd);

// private
var sessionServer = null;
var sessionId = null;
var authorizationHeader = null;

function getServers(fnSuccessCallBack, fnErrorCallBack) {
    var self = this;

    $.ajax({
        cache: false,
        // request to get to apflx demo server through url

        url: serverUrl + CAS_MGMNT_CONTEXT_URI + "?limit=" + REST_ITEM_COUNT_LIMIT + "&excludeItemLinks=true",
        headers: {
            'Authorization': authorizationHeader
        },
        contentType: "application/vnd.sas.collection+json"
    }).done(function (data, status, xhr) {
        var servers = [];
        if (data && data.items && data.items.length > 0) {
            var statusQueue = data.items.map(function (server) {
                return server.name;
            });
            while (data.items.length > 0) {
                var server = data.items.pop();

                self.getServerStatus(server.name, function (data) {
                    statusQueue.splice(statusQueue.indexOf(server.name), 1); // remove from the queue

                    // only keep running servers
                    if (data === "running") {
                        servers.push(server);
                    }

                    // all servers queried?
                    if (statusQueue.length === 0) {
                        if ($.isFunction(fnSuccessCallBack)) {
                            fnSuccessCallBack(servers);
                        }
                    }
                });
            }
        } else if ($.isFunction(fnSuccessCallBack)) {
            fnSuccessCallBack(servers);
        }
    }).fail(function (xhr, status, error) {
        console.error("Error while receiving servers", xhr, error);
        if (xhr && xhr.responseJSON && xhr.responseJSON.message && xhr.responseJSON.message.length > 0) {
            error = xhr.responseJSON.message;
        }
        if ($.isFunction(fnErrorCallBack)) {
            fnErrorCallBack(error);
        }
    });
}

function getServerStatus(serverId, fnSuccessCallBack, fnErrorCallBack) {
    $.ajax({
        cache: false,
        url: serverUrl + CAS_MGMNT_CONTEXT_URI + "/" + serverId + "/state",
        type: "GET",
        dataType: "text",
        headers: {
            'Authorization': authorizationHeader
        }
    }).done(function (data, status, xhr) {
        if ($.isFunction(fnSuccessCallBack)) {
            fnSuccessCallBack(data);
        }
    }).fail(function (xhr, status, error) {
        console.error("Error while receiving server status for " + serverId, xhr, error);
        if (xhr && xhr.responseJSON && xhr.responseJSON.message && xhr.responseJSON.message.length > 0) {
            error = xhr.responseJSON.message;
        }
        if ($.isFunction(fnErrorCallBack)) {
            fnErrorCallBack(error);
        }
    });
}

function getSession(serverId, fnSuccessCallBack, fnErrorCallBack) {
    var self = this;
    if (this.sessionServer != serverId && this.sessionId && this.sessionId.length > 0) {
        // different server - so close existing session
        this.deleteServerSession(this.sessionId, serverId);
    }

    if (this.sessionId && this.sessionId.length > 0) {
        // Use existing session
        var currentTime = Date.now(),
        timeSinceLastCheck = currentTime - this.sessionTime;
        if (timeSinceLastCheck > 600000) {
            // Check the session status if it has been at least 10 minutes since the last check
            $.ajax({
                type: "GET",
                url: serverUrl + CAS_MGMNT_CONTEXT_URI + "/" + encodeURIComponent(serverId) + "/sessions/" + encodeURIComponent(this.sessionId) + "/state",
                headers: {
                    'Authorization': authorizationHeader,
                    'Accept': "text/plain;charset=UTF-8"
                },
                dataType: "text",
                timeout: 30000
            }).done(function (data, status, xhr) {
                if ((typeof data !== "undefined") && (data === "running")) {
                    // Update time on session data
                    self.sessionTime = currentTime;
                    if ($.isFunction(fnSuccessCallBack)) {
                        fnSuccessCallBack(self.sessionId);
                    }
                } else {
                    // Create a new session
                    self.createSession(serverId, fnSuccessCallBack, fnErrorCallBack);
                }
            }).fail(function (xhr, status, error) {
                // Create a new session
                self.createSession(serverId, fnSuccessCallBack, fnErrorCallBack);
            });
        } else {
            if ($.isFunction(fnSuccessCallBack)) {
                fnSuccessCallBack(self.sessionId);
            }
        }
    } else {
        // Create a new session on the server
        self.createSession(serverId, fnSuccessCallBack, fnErrorCallBack);
    }
}

function createSession(serverId, fnSuccessCallBack, fnErrorCallBack) {
    var self = this;

    // Create a new session on the server
    $.ajax({
        type: "POST",
        url: serverUrl + CAS_MGMNT_CONTEXT_URI + "/" + encodeURIComponent(serverId) + "/sessions",
        async: false,
        headers: {
            'Authorization': authorizationHeader,
            'Content-Type': "application/vnd.sas.cas.session+json"
        },
        dataType: "json",
        data: JSON.stringify({
            name: "ViyaOAuth2 Example", // name of the session
            timeOut: 900   // 15 minutes
        }),
        timeout: 30000
    }).done(function (data, status, xhr) {
        self.sessionTime = Date.now();
        self.sessionId = data.id;

        if ($.isFunction(fnSuccessCallBack)) {
            fnSuccessCallBack(self.sessionId);
        }
    }).fail(function (xhr, status, error) {
        if (xhr && xhr.responseJSON && xhr.responseJSON.message && xhr.responseJSON.message.length > 0) {
            error = xhr.responseJSON.message;
        }
        if ($.isFunction(fnErrorCallBack)) {
            fnErrorCallBack(error);
        }
    });
}

/**
 * This function will delete an existing session.
 *
 * @param sessionId {string} - ID of the session to delete
 * @param serverId {string} - ID of the server where the session was created
 */
 function deleteServerSession(sessionId, serverId) {
    // remove reference
    this.sessionId = null;

    $.ajax({
        type: "DELETE",
        url: serverUrl + CAS_MGMNT_CONTEXT_URI + "/" + encodeURIComponent(serverId) + "/sessions/" + encodeURIComponent(sessionId),
        timeout: 30000,
        headers: {
            'Authorization': authorizationHeader
        }
    }).done(function (data, status, xhr) {

    }).fail(function (xhr, status, error) {
        console.debug("Error while deleting server session " + serverId, error);
    });
}

function getOAuth2Token(fnSuccessCallBack, fnErrorCallBack) {
    $.ajax({
        cache: false,
        type: "POST",
        accept: "application/json",
        contentType: "application/x-www-form-urlencoded",
        url: serverUrl + SAS_LOGON_URI,
        headers: {
            "Authorization": "Basic " + authorizationForToken
        },
        data: body,
        success: function (data, textStatus, jqXhr) {
            var TOKEN_KEY = data.access_token;
            var TOKEN_TYPE = data.token_type;

            if (TOKEN_KEY && TOKEN_TYPE && TOKEN_KEY.length > 0 && TOKEN_TYPE.length > 0) {
                if ($.isFunction(fnSuccessCallBack)) {
                    fnSuccessCallBack(TOKEN_TYPE, TOKEN_KEY);
                }
            }
        },
        error: function (xhr, status, error) {
            console.error("ERROR! Failed getting server authentication token. " + error.toString());
            if ($.isFunction(fnErrorCallBack)) {
                fnErrorCallBack(error);
            }
        }
    });
}

function getCASLibs(serverId, fnSuccessCallBack, fnErrorCallBack) {
    $.ajax({
        cache: false,
        url: serverUrl + CAS_MGMNT_CONTEXT_URI + "/" + encodeURIComponent(serverId)
        + "/caslibs?limit=" + REST_ITEM_COUNT_LIMIT,
        headers: {
            'Authorization': authorizationHeader
        }
    }).done(function (data, status, xhr) {
        var casLibs = [];

        // filter out DBMS caslib
        if (data && data.items && data.items.length > 0) {
            casLibs = data.items.filter( function(item) {
                return $.inArray(item.type.toLowerCase(), ["path", "hdfs", "dnfs"]) !== -1;
            });
        }

        if ($.isFunction(fnSuccessCallBack)) {
            fnSuccessCallBack(casLibs);
        }
    }).fail(function (xhr, status, error) {
        console.error("Error while receiving libraries for " + serverId, xhr, error);
        if (xhr && xhr.responseJSON && xhr.responseJSON.message && xhr.responseJSON.message.length > 0) {
            error = xhr.responseJSON.message;
        }
        if ($.isFunction(fnErrorCallBack)) {
            fnErrorCallBack(error);
        }
    });
}

function getCASTables(serverId, casLib, fnSuccessCallBack, fnErrorCallBack) {
    getSession(serverId, function(sessionId) {
        var url = serverUrl + CAS_MGMNT_CONTEXT_URI + "/" + encodeURIComponent(serverId)
        + "/caslibs/" + encodeURIComponent(casLib) + "/tables?limit=" + REST_ITEM_COUNT_LIMIT
            + "&state=" + encodeURIComponent("loaded"); // only show loaded tables
            if (sessionId && sessionId.length > 0) {
                url += "&sessionId=" + encodeURIComponent(sessionId);
            }

            $.ajax({
                cache: false,
                url: url,
                type: "GET",
                headers: {
                    'Authorization': authorizationHeader
                }
            }).done(function (data, status, xhr) {
                var tables = [];

            // filter out DBMS caslib
            if (data && data.items && data.items.length > 0) {
                tables = data.items.filter( function(item) {
                    return $.inArray(item.state.toLowerCase(), ["loaded"]) !== -1;
                });
            }

            if ($.isFunction(fnSuccessCallBack)) {
                fnSuccessCallBack(tables);
            }
        }).fail(function (xhr, status, error) {
            console.error("Error while receiving tables for " + serverId, xhr, error);
            if (xhr && xhr.responseJSON && xhr.responseJSON.message && xhr.responseJSON.message.length > 0) {
                error = xhr.responseJSON.message;
            }
            if ($.isFunction(fnErrorCallBack)) {
                fnErrorCallBack(error);
            }
        });
    }, fnErrorCallBack);
}

function buildTableList(serverId, library) {
    getCASTables( serverId, library, function(tables) {
        $("#tableList").empty();

        tables.forEach(function (table) {
            $("#tableList").append("<li class=\"ui-widget-content\">" + table.name + " (columns: " + table.columnCount + ", rows:" + table.rowCount + ")</li>");
        });

        $("#tableList").selectable({
            stop: function () {
                $(".ui-selected", this).each(function () {
                    var tableIndex = $("#tableList li").index(this);
                    alert("You have selected table " + tables[tableIndex].name);
                });
            }
        });
    });
}

function buildLibraryList(serverId) {
    getCASLibs( serverId, function(libraries) {
        $("#libraryList").empty();

        libraries.forEach(function (library) {
            $("#libraryList").append("<li class=\"ui-widget-content\">" + library.name + " (" + library.description + ")</li>");
        });

        $("#libraryList").selectable({
            stop: function () {
                $(".ui-selected", this).each(function () {
                    var libIndex = $("#libraryList li").index(this);
                    buildTableList(serverId, libraries[libIndex].name);
                });
            }
        });
    });
}

function buildServerList(servers) {
    $("#serverList").empty();

    servers.forEach(function (server) {
        $("#serverList").append("<li class=\"ui-widget-content\">" + server.name + " (" + server.host + ":" + server.port + ")</li>");
    });

    $("#serverList").selectable({
        stop: function () {
            $(".ui-selected", this).each(function () {
                var serverIndex = $("#serverList li").index(this);
                buildLibraryList(servers[serverIndex].name);
                console.log("ROOPA FAKE FREN");
            });
        }
    });
}

function onLogonButtonClick(event) {
    getOAuth2Token(function (type, token) {
        authorizationHeader = type + " " + token;
        getServers(function (servers) {
            buildServerList(servers);
        })
    })
}
