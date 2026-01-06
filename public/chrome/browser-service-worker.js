"use strict";

let cur_open_tab;

function open_tab() {
    chrome.tabs.create({
        url: "index.html"
    }, function(tab) {
        cur_open_tab = tab.id;
    });
}

chrome.action.onClicked.addListener(function() {
    if( !cur_open_tab )
        return open_tab();

    chrome.tabs.get( cur_open_tab, function(exists) {
        if( exists )
            chrome.tabs.update( cur_open_tab, { active: true } );
        else
            open_tab();
    });
});

// Per https://stackoverflow.com/questions/70352182/declarative-web-request-chrome-plugin-how-to-use-regex-filter-on-extension-path
chrome.runtime.onInstalled.addListener(async () => {
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    let id = 1;

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldRules.map(rule => rule.id),
        addRules: [
            {
                id: id++,
                priority: 1,
                condition: {
                    regexFilter: "^https?://songs\\.worshipleaderapp\\.com$",
                    resourceTypes: ["main_frame"],
                },
                action: {
                    type: "redirect",
                    redirect: { extensionPath: "/index.html" },
                },
            },
            {
                id: id++,
                priority: 1,
                condition: {
                    // Capture https://songs.worshipleaderapp.com/song.html?song_id=1234,
                    // https://songs.worshipleaderapp.com/ etc and redirect carrying across any query params
                    regexFilter: "^https?://songs\\.worshipleaderapp\\.com/(index\\.html|song\\.html)?([?#].*)?$",
                    resourceTypes: ["main_frame"],
                },
                action: {
                    type: "redirect",
                    redirect: {
                        regexSubstitution: `chrome-extension://${chrome.runtime.id}/index.html\\2`,
                    },
                },
            },
        ],
    });
});
