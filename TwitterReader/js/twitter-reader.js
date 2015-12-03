var apiToken = "IQFPBl4JoV0F1o2pmEDCmGc2x";
var apiSecret = "sCOBjJYVf4ttQKxcx65yboBBGnphEvyI8h9vX2aVW8avWUiT4m";
var myToken = "62648398-sXjROcZ3yR5XeFGDOOhjzs3cKNDMhrHZaac0UZzpj";
var mySecret = "IWo8j9BbqUraFwknCfvnh2NXySkjdKvhCSivVUjyykVil";

var codeBird = new Codebird;
codeBird.setConsumerKey(apiToken, apiSecret);
codeBird.setToken(myToken, mySecret);

var mode = "search";
var defaultUser = "783214";
var defaultQuery = "Twitter";
var lastUser = defaultUser;
var lastQuery = defaultQuery;

$(document).ready(function () {
    $("#form-search").submit(function() {
        resetResults();
        showSearchResults($("#search-box").val());
        return false;
    });

    showUserTimeline();
    showUsers();
});

// Endless scroll
$(window).scroll(function () {
    if ($(window).scrollTop() == $(document).height() - $(window).height()) {
        var maxId = $("#last-tweet-id").html();
        switch (mode) {
            case "search":
                showSearchResults($("#search-box").val(), maxId);
                break;
            case "user":
                showUserTimeline(lastUser, maxId);
        }
    }
});

//---\/---Main methods---\/---
//
function showSearchResults(query, maxId) {
    var currentMode = "search";
    $("div#loadmoreajaxloader").show();
    if (mode != currentMode || typeof query == "string" && query != lastQuery) {
        resetResults();
        getSearchResults(query, maxId);
        lastQuery = query;
    } else {
        getSearchResults(lastQuery, maxId);
    }
    mode = currentMode;
}

function showUserTimeline(screenName, maxId) {
    var currentMode = "user";
    $("div#loadmoreajaxloader").show();
    if (mode != currentMode || typeof screenName == "string" && screenName != lastUser) {
        resetResults();
        getUserTimeLine(screenName, maxId);
        lastUser = screenName;
    } else {
        getUserTimeLine(lastUser, maxId);
    }
    mode = currentMode;
}

function showUsers() {
    if (localStorage['userIds'] != undefined) {
        var userIds = JSON.parse(localStorage['userIds']);

        $(".caption-no-followed-people").hide();
        $("#people-loading").show();

        getUsers(userIds);
    }
}
//
//---/\---Main methods---/\---


//---\/---Event methods---\/---
//
function unfollowClick(sender) {
    var userId = $(sender.target).closest(".tweet-item").attr("user-id") || $(sender.target).closest(".people-item").attr("user-id");
    removeUser(userId);
    refreshFollowUnfollowButtons(userId);
}

function followClick(sender) {
    var btn = $(sender.target);
    if (btn == undefined)
        return;
    var user = {
        id_str: btn.closest(".tweet-item").attr("user-id"),
        name: btn.closest(".tweet-item").find(".caption-user span a strong").text(),
        profile_image_url: btn.closest(".tweet-item").find(".img-avatar").attr("src")
    };
    addUser(user);
    refreshFollowUnfollowButtons(user.id_str);
}

function userProfileClick(userId) {
    resetResults();
    showUserTimeline(userId);
}
//
//---/\---Event methods---/\---


//---\/---API---\/---
//
function getUsers(userIds) {
    var params = {
        user_id: userIds.join(",")
    };
    codeBird.__call(
        "users_lookup",
        params,
        function (reply) {
            $("#people-loading").hide();
            checkNoFollowedPeople();
            addUsersToList(reply);
        }
    );
}

function getSearchResults(query, maxId) {
    var params = {
        q: typeof query == "string" && query != "" ? query : defaultQuery,
        result_type: "recent"
    };
    if (maxId != undefined) {
        params.max_id = (maxId != "" && !isNaN(maxId))
            ? decrementHugeNumberBy1(maxId)
            : 0;
    }
    $("#load-tweets-ajax-loader").show();
    codeBird.__call(
        "search_tweets",
        params,
        function (reply) {
            addTweetsToTimeline(reply['statuses']);
            $("#load-tweets-ajax-loader").hide();
        }
    );
}

function getUserTimeLine(userId, maxId) {
    var params = {
        user_id: userId != undefined && userId != "" ? userId : defaultUser,
        exclude_replies: 1
    };
    if (maxId != undefined) {
        params.max_id = (maxId != "" && !isNaN(maxId))
            ? decrementHugeNumberBy1(maxId)
            : 0;

    }
    lastUser = params.user_id;
    $("#load-tweets-ajax-loader").show();
    codeBird.__call(
        "statuses_userTimeline",
        params,
        function (reply) {
            addTweetsToTimeline(reply);
            $("#load-tweets-ajax-loader").hide();
        }
    );
    mode = "user";
}
//
//---/\---API---/\---


//---\/---Lists operations---\/---
//
function addUser(user) {
    if (addUserToStorage(user.id_str)) {
        var item = $(renderUser(user));

        item.find("span.glyphicon-remove").click(unfollowClick);

        $("#people-list").append(item);

        checkNoFollowedPeople();
    }
}

function removeUser(userId) {
    if (removeUserFromStorage(userId)) {
        var people = $(".people-item");
        for (var i = 0; i < people.length; i++) {
            if ($(people[i]).attr("user-id") == userId) {
                people[i].remove();
            }
        }

        checkNoFollowedPeople();
    }
}

function addUsersToList(users) {
    var usersAmount = users.length;
    for (var i = 0; i < usersAmount; i++) {
        var item = $(renderUser(users[i]));

        item.find("span.glyphicon-remove").click(unfollowClick);

        $("#people-list").append(item);
    }
    checkNoFollowedPeople();
}

function addTweetsToTimeline(tweets) {
    var tweetsAmount = tweets.length;
    for (var i = 0; i < tweetsAmount; i++) {
        var item = $(renderTweet(tweets[i]));

        item.find("span.unfollow").click(unfollowClick);
        item.find("span.follow").click(followClick);

        $("#tweets-list").append(item);

        if (i >= tweetsAmount - 1) {
            $("#last-tweet-id").html(tweets[i]['id_str']);
        }
    }
}
//
//---/\---Lists operations---/\---


//---\/---Interface helpers---\/---
//
function checkNoFollowedPeople() {
    var people = $(".people-item");
    if (people.length <= 0) {
        $(".caption-no-followed-people").show();
    } else {
        $(".caption-no-followed-people").hide();
    }
}

function refreshFollowUnfollowButtons(userId) {
    var icons = $(".tweet-item[user-id='" + userId + "']").find(".icons-tweet");

    if (isUserInStorage(userId)) {
        icons.find(".follow").remove();
        icons.append(renderUnfollowButton());
        $("span.unfollow").off("click").on("click", unfollowClick);
    } else {
        icons.find(".unfollow").remove();
        icons.append(renderFollowButton());
        $("span.follow").off("click").on("click", followClick);
    }
}

function resetResults() {
    $("#last-tweet-id").html("");
    $("#tweets-list").html("");
}
//
//---/\---Interface helpers---/\---


//---\/---Templates---\/---
//
function renderUser(user) {
    var html = "<div class=\"people-item\" user-id=\"{user_id}\">" +
                    "<div class=\"col-md-2\">" +
                        "<img class=\"img-avatar\" src=\"{profile_image_url}\" alt=\"{name}\"  onclick=\"userProfileClick('{user_id}');\"/>" +
                    "</div>" +
                    "<div class=\"col-md-8 text-left\"><span onclick=\"userProfileClick('{user_id}');\"><a><strong>{name}</strong></a></span></div>" +
                    "<div class=\"col-md-2 remove\">" +
                        "<span class=\"glyphicon glyphicon-remove\"></span>" +
                    "</div>" +
                "</div>";

    html = html
               .replace("{profile_image_url}", user["profile_image_url"])
               .replace(/{name}/g, user["name"])
               .replace(/{user_id}/g, user["id_str"])
    ;

    return html;
}

function renderTweet(tweet) {
    var retweetedUser;
    if (tweet.hasOwnProperty("retweeted_status")) {
        retweetedUser = tweet["user"];
        tweet = tweet["retweeted_status"];
    }
    var html = "<div class=\"tweet-item\" user-id=\"{user_id}\">" +
                    "<div class=\"col-md-2 text-right\">" +
                        "<div class=\"icon-retweet-by\" {hidden}><span class=\"glyphicon glyphicon-retweet\"></span></div>" +
                        "<div class=\"container-avatar\">" +
                            "<img class=\"img-avatar\" src=\"{profile_image_url}\" alt=\"avatar\" onclick=\"userProfileClick('{user_id}');\" />" +
                        "</div>" +
                    "</div>" +
                    "<div class=\"col-md-10 text-left\">" +
                        "<div class=\"caption-retweet\" {hidden}><a onclick=\"userProfileClick('{retweeted_by_user_id}');\">{retweeted_by}</a> retweeted</div>" +
                        "<div class=\"caption-user\" onclick=\"userProfileClick('{user_id}');\"><span><a><strong>{name}</strong></a> @{screen_name}</span> - <span class=\"time-tweet\"><a>{created_at}</a></span></div>" +
                        "<div class=\"text-tweet\">{text}</div>" +
                        "<div class=\"icons-tweet\">" +
                            "<span class=\"icon-retweets\"><span class=\"glyphicon glyphicon-retweet\"></span> {retweet_count}</span>" +
                            "&nbsp;" +
                            "<span class=\"icon-likes\"><span class=\"glyphicon glyphicon-heart\"></span> {favorite_count}</span>" +
                            "&nbsp;" +
                            "{follow-unfollow-button}" +
                        "</div>" +
                    "</div>" +
                "</div>";

    html = html
               .replace("{follow-unfollow-button}", isUserInStorage(tweet.user.id_str) ? renderUnfollowButton() : renderFollowButton())
               .replace(/{profile_image_url}/g, tweet["user"]["profile_image_url"])
               .replace(/{name}/g, tweet["user"]["name"])
               .replace(/{screen_name}/g, tweet["user"]["screen_name"])
               .replace("{created_at}", $.timeago(tweet["created_at"]))
               .replace("{text}", tweet["text"])
               .replace("{retweet_count}", tweet["retweet_count"])
               .replace("{favorite_count}", tweet["favorite_count"])
               .replace(/{user_id}/g, tweet["user"]["id_str"])
    ;

    if (retweetedUser != undefined) {
        html = html.replace("{retweeted_by_user_id}", retweetedUser["id_str"])
                   .replace("{retweeted_by}", retweetedUser["name"])
                   .replace("{hidden}", "");
    } else {
        html = html.replace(/{hidden}/g, "hidden");
    }

    return html;
}

function renderFollowButton() {
    return "<span class=\"icon-follow-unfollow follow\"><span class=\"glyphicon glyphicon-ok\"></span> <a>Follow</a></span>";
}

function renderUnfollowButton() {
    return "<span class=\"icon-follow-unfollow unfollow\"><span class=\"glyphicon glyphicon-remove\"></span> <a>Unfollow</a></span>";
}
//
//---/\---Templates---/\---


//---\/---Localstorage---\/---
//
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

function isUserInStorage(userId) {
    var isInStorage = false;

    if (localStorage['userIds'] != undefined) {
        var userIds = JSON.parse(localStorage['userIds']);
        if (userIds.indexOf(userId) >= 0) {
            isInStorage = true;
        }
    }

    return isInStorage;
}
//
//---/\---Localstorage---/\---


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