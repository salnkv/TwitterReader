var apiToken = "IQFPBl4JoV0F1o2pmEDCmGc2x";
var apiSecret = "sCOBjJYVf4ttQKxcx65yboBBGnphEvyI8h9vX2aVW8avWUiT4m";
var myToken = "62648398-sXjROcZ3yR5XeFGDOOhjzs3cKNDMhrHZaac0UZzpj";
var mySecret = "IWo8j9BbqUraFwknCfvnh2NXySkjdKvhCSivVUjyykVil";

var codeBird = new Codebird;
codeBird.setConsumerKey(apiToken, apiSecret);
codeBird.setToken(myToken, mySecret);

var app = angular.module("twitterReaderApp", ["infinite-scroll"]);

app.controller("tweetsController", ["$scope", "tweetsService", "usersService", function ($scope, tweetsService, usersService) {
    $scope.tweetTemplateUrl = "controls/tweet.html";
    $scope.userTemplateUrl = "controls/user.html";
    $scope.tweetsLoading = tweetsService.getTweetsLoading();
    $scope.usersLoading = usersService.getUsersLoading();
    $scope.tweets = tweetsService.getTweets("search");
    $scope.users = usersService.getUsers();
    $scope.query = "";
    
    $scope.loadMoreTweets = function () {
        if ($(window).scrollTop() == $(document).height() - $(window).height()) {
            tweetsService.getTweets();
        }
    }

    $scope.showSearchResults = function() {
        tweetsService.getTweets("search", $scope.query, true);
    }

    $scope.showUserTimeline = function(userId) {
        tweetsService.getTweets("user", userId, true);
    }

    $scope.unfollowClick = function(userId) {
        usersService.removeUser(userId);
    }

    $scope.followClick = function (user) {
        usersService.addUser(user);
    }

    $scope.isUserFollowed = function (userId) {
        return usersService.isUserInStorage(userId);
    }

    $scope.timeAgo = function(time) {
        return $.timeago(time);
    }
}]);

app.service("tweetsService", ["$q", function ($q) {
    var defaultUser = "783214";
    var defaultQuery = "Twitter";
    var lastUser = defaultUser;
    var lastQuery = defaultQuery;

    var tweets = [];
    var lastTweetId;
    var lastMode;
    var tweetsLoading = { busy: false };

    this.getTweetsLoading = function() {
        return tweetsLoading;
    };

    this.getTweets = function (mode, query, clearSearch) {
        if (tweetsLoading.busy) return tweets;
        var promise;

        if (clearSearch || mode != undefined && lastMode != mode) {
            lastTweetId = undefined;
            tweets.length = 0;
            lastMode = mode;
        }
        else if (mode == undefined) {
            mode = lastMode;
        }

        tweetsLoading.busy = true;

        switch (mode) {
            case "user":
                promise = getUserTimeLine(query, lastTweetId);
                break;
            default:
                promise = getSearchResults(query, lastTweetId);
                break;
        }

        promise.then(function (reply) {
            if (!reply.errors) {
                if (reply.statuses)
                    reply = reply.statuses;

                if (reply.length > 0) {
                    lastTweetId = reply[reply.length - 1].id_str;
                    if (tweets.length > 0) {
                        for (var i = 0; i < reply.length; i++)
                            tweets.push(reply[i]);
                    }
                    else {
                        $.extend(tweets, reply);
                    }
                }
            }
            tweetsLoading.busy = false;
        });

        return tweets;
    };

    function getUserTimeLine(userId, maxId) {
        var deferred = $q.defer();
        var params = {
            user_id: userId != undefined && userId != "" ? userId : lastUser,
            exclude_replies: 1
        };
        if (maxId != undefined) {
            params.max_id = (maxId != "" && !isNaN(maxId))
                ? decrementHugeNumberBy1(maxId)
                : 0;

        }
        lastUser = params.user_id;
        codeBird.__call(
            "statuses_userTimeline",
            params,
            function (reply) {
                deferred.resolve(reply);
            }
        );
        return deferred.promise;
    }

    function getSearchResults(query, maxId) {
        var deferred = $q.defer();
        var params = {
            q: typeof query == "string" && query != "" ? query : lastQuery,
            result_type: "recent"
        };
        if (maxId != undefined) {
            params.max_id = (maxId != "" && !isNaN(maxId))
                ? decrementHugeNumberBy1(maxId)
                : 0;
        }
        lastQuery = params.q;
        codeBird.__call(
            "search_tweets",
            params,
            function (reply) {
                deferred.resolve(reply);
            }
        );
        return deferred.promise;
    }

    //---\/---Helpers---\/---
    //
    function decrementHugeNumberBy1(n) {
        n = n.toString();
        var allButLast = n.substr(0, n.length - 1);
        var lastNumber = n.substr(n.length - 1);

        if (lastNumber === "0") {
            return decrementHugeNumberBy1(allButLast) + "9";
        }
        else {
            var finalResult = allButLast + (parseInt(lastNumber, 10) - 1).toString();
            return trimLeft(finalResult, "0");
        }
    }

    function trimLeft(s, c) {
        var i = 0;
        while (i < s.length && s[i] === c) {
            i++;
        }

        return s.substring(i);
    }
    //
    //---/\---Helpers---/\---
}]);

app.service("usersService", ["$q", function ($q) {
    var users = [];
    var usersLoading = { busy: false };

    this.getUsersLoading = function () {
        return usersLoading;
    };

    this.getUsers = function() {
        if (localStorage['userIds'] != undefined) {
            var userIds = JSON.parse(localStorage['userIds']);

            usersLoading.busy = true;
            getUsersRequest(userIds).then(function(reply) {
                if (users.length > 0) {
                    for (var i = 0; i < reply.length; i++)
                        users.push(reply[i]);
                }
                else {
                    $.extend(users, reply);
                }
                usersLoading.busy = false;
            });
        }

        return users;
    }

    this.addUser = function(user) {
        if (addUserToStorage(user.id_str)) {
            users.push(user);
        }
    }

    this.removeUser = function(userId) {
        if (removeUserFromStorage(userId)) {
            for (var i = 0; i < users.length; i++) {
                if (users[i].id_str == userId) {
                    users.splice(i, 1);
                    break;
                }
            }
        }
    }

    this.isUserInStorage = function (userId) {
        var isInStorage = false;

        if (localStorage['userIds'] != undefined) {
            var userIds = JSON.parse(localStorage['userIds']);
            if (userIds.indexOf(userId) >= 0) {
                isInStorage = true;
            }
        }

        return isInStorage;
    }

    function getUsersRequest(userIds) {
        var deferred = $q.defer();
        var params = {
            user_id: userIds.join(",")
        };
        codeBird.__call(
            "users_lookup",
            params,
            function (reply) {
                deferred.resolve(reply);
            }
        );
        return deferred.promise;
    }

    function addUserToStorage(userId) {
        var added = false;

        if (localStorage['userIds'] != undefined) {
            var userIds = JSON.parse(localStorage['userIds']);
            if (userIds.indexOf(userId) < 0) {
                userIds.push(userId);
                localStorage['userIds'] = JSON.stringify(userIds);
                added = true;
            }
        } else {
            localStorage['userIds'] = JSON.stringify([userId]);
            added = true;
        }

        return added;
    }

    function removeUserFromStorage(userId) {
        var removed = false;

        if (localStorage['userIds'] != undefined) {
            var userIds = JSON.parse(localStorage['userIds']);
            if (userIds.indexOf(userId) >= 0) {
                userIds.splice(userIds.indexOf(userId), 1);
                localStorage['userIds'] = JSON.stringify(userIds);
                removed = true;
            }
        }

        return removed;
    }
}]);