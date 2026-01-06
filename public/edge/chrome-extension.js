"use strict";

var cur_open_tab;

function open_tab() {
    chrome.tabs.create({
        url: "index.html"
    }, function(tab) {
        cur_open_tab = tab.id;
    });
}

chrome.browserAction.onClicked.addListener(function() {
    if( !cur_open_tab )
        return open_tab();

    chrome.tabs.get( cur_open_tab, function(exists) {
        if( exists )
            chrome.tabs.update( cur_open_tab, { active: true } );
        else
            open_tab();
    });
});

chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        var path = details.url.replace(/^https?:\/\/[^\/]+/, '');

        // Handle directory indexes
        path = path.replace(/^\/?([?#].*)?$/, '/index.html$1');

        // Paths to not override. Shouldn't need the api|json ones as they are
        // not going to be opened in a tab..
        if( path.match( /^\/(song_repo|api|json)\// ) )
            return {};

        return {
            redirectUrl: chrome.extension.getURL(path),
        };
    },

    // URL filter
    {
        urls: [
            '*://songs.yasamkilisesi.com/*',
            '*://ilahiler.yasamkilisesi.com/*',
            '*://songs.worshipleaderapp.com/*',
        ],

        // Only apply to direct loads
        types: ['main_frame'],
    },

    // opt_extraInfoSpec
    ['blocking']
);
