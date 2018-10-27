// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri (str) {
    var	o   = parseUri.options,
        m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
        uri = {},
        i   = 14;

    while (i--) uri[o.key[i]] = m[i] || "";

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) uri[o.q.name][$1] = $2;
    });

    return uri;
};

parseUri.options = {
    strictMode: false,
    key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
    q:   {
        name:   "queryKey",
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
};

// background.html: SearchMark back-end
//
// Copyright (C) 2010  Akshay Dua, and Candy Yiu
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/.

// =============== GLOBALS ==============

// Bookmarked page database
var SearchMarkDB = {};

// Communicate with extension UI
var gPort;

// Used to highlight searched keywords in results
var uiHighlightStart = '<span class=highlight>';
var uiHighlightEnd = '</span>';
var uiEllipses = '<b>...</b>';
var uiContextLen = -30;

// ======================== DATABASE API ==================

// Open the database
SearchMarkDB.db = null;
SearchMarkDB.open = function()
{
    var dbSize = 200 * 1024 * 1024; // 200 MB
    SearchMarkDB.db =
        openDatabase('SearchMarkDB', '1.0', 'Bookmark Page Storage', dbSize);
}

// create the table that stores all the bookmark
// info, including the associated pages.
SearchMarkDB.createTable =
    function()
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
            tx.executeSql('CREATE VIRTUAL TABLE pages ' +
                          'USING fts3(id INTEGER PRIMARY KEY, ' +
                          'url TEXT, title TEXT, page TEXT, ' +
                          'time INTEGER, img TEXT)',
                          [],
                          getCallback("create table", "pages", 1),
                          getCallback("create table", "pages", 0));

            tx.executeSql('CREATE TABLE IF NOT EXISTS ' +
                          'rawpages (id INTEGER PRIMARY KEY, htmlpage TEXT)',
                          [],
                          getCallback("create table", "rawpages", 1),
                          getCallback("create table", "rawpages", 0));
        });
}

// add a bookmark and associated page to the database
SearchMarkDB.addBookmarkedPage =
    function(newId, newUrl, newTitle, newPlainPage, newTime,
             newPageImg, newHtmlPage)
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
            // html-free page for searching
            tx.executeSql('INSERT INTO pages(id, url, title, page, ' +
                          'time, img) VALUES (?,?,?,?,?,?)',
                          [ newId, newUrl, newTitle, newPlainPage,
                            newTime, newPageImg ],
                          getCallback("insert page", newId + " " +
                                      newUrl, 1),
                          getCallback("insert page", newId + " " +
                                      newUrl, 0));

            // html page for showing cached version
            tx.executeSql('INSERT INTO rawpages(id, htmlpage) ' +
                          'VALUES (?,?)',
                          [newId, newHtmlPage ],
                          getCallback("insert page raw", newId +
                                      " " + newUrl, 1),
                          getCallback("insert page raw", newId +
                                      " " + newUrl, 0));
        });
}

// remove a bookmarked page from the database
SearchMarkDB.removeBookmarkedPage =
    function(theId)
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
            tx.executeSql('DELETE FROM pages WHERE id=?', [ theId ],
                          getCallback("remove page", theId, 1),
                          getCallback("remove page", theId, 0));

            tx.executeSql('DELETE FROM rawpages WHERE id=?', [ theId ],
                          getCallback("remove page raw", theId, 1),
                          getCallback("remove page raw", theId, 0));
        });
}

// update an already stored bookmarked page
SearchMarkDB.updateBookmarkedPage =
    function(theId, theUrl, theTitle, thePlainPage, theTime,
             thePageImg, theHtmlPage)
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
            tx.executeSql('UPDATE pages SET url=?, ' +
                          'title=?, page=?, img=? WHERE id=?',
                          [ theUrl, theTitle, thePlainPage,
                            thePageImg, theId ],
                          getCallback("update bookmark", theUrl, 1),
                          getCallback("update bookmark", theUrl, 0));

            tx.executeSql('UPDATE rawpages SET htmlpage=? WHERE id=?',
                          [ theHtmlPage, theId ],
                          getCallback("update bookmark", "raw " + theUrl, 1),
                          getCallback("update bookmark", "raw " + theUrl, 0));
        });
}

// get all bookmark URLs. Callback function can
// be provided use the results as necessary.
SearchMarkDB.getStoredBookmarks =
    function()
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
            tx.executeSql('SELECT id,url,title FROM pages',
                          [],
                          getCallback("show db", "pages", 1),
                          getCallback("show db", "pages", 0));

            tx.executeSql('SELECT id FROM rawpages',
                          [],
                          getCallback("show db", "raw", 1),
                          getCallback("show db", "raw", 0));
        });
}

// Supports the cached page feature. Returns cached raw html page.
SearchMarkDB.getRawHtmlPage =
    function (id, callback)
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
            tx.executeSql('SELECT htmlpage FROM rawpages ' +
                          'WHERE id = ?',
                          [id],
                          callback,
                          getCallback("get page", "raw", 0));
        });
}

SearchMarkDB.doSearch =
    function(callback, keywords)
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
            tx.executeSql('SELECT id,url,title, img, ' +
                          'snippet(pages, "' + uiHighlightStart +
                          '", "' + uiHighlightEnd +
                          '", "' + uiEllipses +
                          '", -1, ' + uiContextLen + ') ' +
                          'as snippet FROM pages WHERE ' +
                          'pages MATCH ' + keywords + ' ' +
                          'ORDER BY time DESC',
                          [],
                          callback,
                          getCallback("search pages", "malformed input", 0));
        });
}

// clear all stored information.
SearchMarkDB.clear =
    function()
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
            tx.executeSql('DELETE FROM pages', [],
                          getCallback("clear table", "pages", 1),
                          getCallback("clear table", "pages", 0));

            tx.executeSql('DELETE FROM rawpages', [],
                          getCallback("clear table", "rawpages", 1),
                          getCallback("clear table", "rawpages", 0));
        });
}

// remove the table and all stored information
SearchMarkDB.purge =
    function()
{
    SearchMarkDB.db.transaction(
        function(tx)
        {
          tx.executeSql('DROP TABLE pages', [],
                        getCallback("delete table", "pages", 1),
                        getCallback("delete table", "pages", 0));

          tx.executeSql('DROP TABLE rawpages', [],
                        getCallback("delete table", "rawpages", 1),
                        getCallback("delete table", "rawpages", 0));
        });
}

// ========================== CORE ===============

// prepare to initialize

// open the database each time extension loads.
SearchMarkDB.open();
console.debug("Opened SearchMark database.");

localStorage['newversion'] = 2.5;

// Important for new installs
if(!localStorage['oldversion'])
{ // not defined

    // set to a version before upgrade functionality ever existed
    localStorage['oldversion'] = 1.1;
}

if(localStorage['newversion'] > localStorage['oldversion'])
{
    // will not be true for new installs
    if(localStorage['initialized'])
    { // already installed. Do upgrade.
        console.log("Upgrading to version " +
                    localStorage['newversion']);

        doUpgrade();
    }

    localStorage['oldversion'] = localStorage['newversion'];
}

init();

chrome.browserAction.onClicked.addListener(
    function(tab)
    {
        chrome.tabs.create(
            {'url' : 'SearchMarkUI.html'},
            function(newTab) {});
    });

chrome.extension.onRequest.addListener(handleRequest);

chrome.bookmarks.onChanged.addListener(
    function(id, changeInfo)
    {
        if (!localStorage['initialized'])
            return;

        getAndStoreBookmarkContent(
            {id : id,
             url : changeInfo.url,
             title : changeInfo.title,
             time : 0},
            SearchMarkDB.updateBookmarkedPage);
    });

chrome.bookmarks.onCreated.addListener(
    function(id, newBookmark)
    {
        localStorage['totalbookmarks']++;

        if (!localStorage['initialized'])
            return;

        getAndStoreBookmarkContent(
            {id : id,
             url : newBookmark.url,
             title : newBookmark.title,
             time : newBookmark.dateAdded},
            SearchMarkDB.addBookmarkedPage);
    });

chrome.bookmarks.onRemoved.addListener(
    function(id, removeInfo)
    {
        localStorage['totalbookmarks']--;

        if (!localStorage['initialized'])
            return;

        SearchMarkDB.removeBookmarkedPage(id);
    });

// experimental APIs require user to start chrome with a specific option
// flag from the command line. So, not using for now.
// chrome.experimental.omnibox.onInputEntered.addListener(
//     function(keywords) {
//         handleRequest({method: 'search', keywords: keywords},
//                       background, function() {});
//     }
// );

// ================= CORE API ===================

function init()
{
    console.log("Initializing...");

    // if bookmarks in DB not in sync with actual bookmarks
    if(localStorage['added'] && localStorage['totalbookmarks'] &&
       localStorage['added'] != localStorage['totalbookmarks'])
        cleanupStorage();

    // initialize once only. Populate the database
    // by retrieving and storing bookmarked pages, and
    // URLs.
    if (!localStorage['initialized'] ||
        localStorage['initialized'] == 0)
    {
        SearchMarkDB.createTable();

        chrome.bookmarks.getTree(
            function(bookmarks)
            {
                localStorage['added'] = 0;
                localStorage['totalbookmarks'] = 0;
    	        initBookmarkDatabase(bookmarks);
            });

        // number of times the welcome page was opened
        localStorage['uivisits'] = 0;

        localStorage['initialized'] = 1;
    } else {
        localStorage['initialized']++;
    }

    // debug and test
    // getUrlContent("http://www.sqlite.org/lang_altertable.html");
}

// any upgrade functionality should be placed here
function doUpgrade()
{
    if(localStorage['oldversion'])
        cleanupStorage();
}

// clean up stored configuration variables
function cleanupStorage()
{
    console.log("Cleaning up...");

    console.log("Clearing database tables");
    SearchMarkDB.clear();

    console.log("Removing the tables");
    SearchMarkDB.purge();

    console.log("Setting to 'not initialized'");
    localStorage['initialized'] = 0;
}

function handleRequest(request, sender, callback)
{
    if (request.method == 'search') {
        gPort = chrome.extension.connect( {name : "uiToBackend"});

        console.debug("search " + request.keywords);

        SearchMarkDB.doSearch(searchBookmarkedPagesCb,
                              "'" + request.keywords + "'");

        callback();
    } else if (request.method == 'cached') {
        SearchMarkDB.getRawHtmlPage(request.bookmarkid, displayRawPage);

        console.debug("cache request " + request.bookmarkid);

        callback();
    } else {
        callback();
    }
}

function displayRawPage(tx, r)
{
    if(r.rows.length) {

        chrome.tabs.create(
            {url: 'rawPageView.html', selected: true},
            function (tab)
            {
                // connect to tab that will show the raw page
                var port = chrome.extension.connect({name:
                "rawPageView"});

                // send the raw page
                port.postMessage(r.rows.item(0).htmlpage);

                // done.
                port.disconnect();
            });

    } else {
        console.log("Unexpected error: this page should have " +
                    "been cached. Please file a bug report " +
                    "at <todo:put github url here>");
    }
}

function searchBookmarkedPagesCb(tx, r)
{
    var result = {};

    for ( var i = 0; i < r.rows.length; i++) {
        // deprecated, remove eventually
        result.matchType = "page";

        result.id = r.rows.item(i).id;
        result.url = r.rows.item(i).url;
        result.title = r.rows.item(i).title;
        result.text = r.rows.item(i).snippet;
        result.img = r.rows.item(i).img;

        console.log(result.img);

        gPort.postMessage(result);

        result = {};
    }

    result.matchType = "DONE";

    gPort.postMessage(result);
}

function removeHTMLfromPage(page)
{
    // reduce spaces, remove new lines
    var pagetxt = page.replace(/\s+/gm, " ");

    // remove 'script', 'head', 'style' tags
    pagetxt = pagetxt.replace(/<\s*?head.*?>.*?<\s*?\/\s*?head\s*?>/i, " ");
    pagetxt = pagetxt.replace(/<\s*?script.*?>.*?<\s*?\/\s*?script\s*?>/gi, " ");
    pagetxt = pagetxt.replace(/<\s*?style.*?>.*?<\s*?\/\s*?style\s*?>/gi, " ");

    // Now remove other tags
    pagetxt = pagetxt.replace(/<.*?\/?>/g, " ");

    // Remove symbols
    pagetxt = pagetxt.replace(/&.*?;/g, " ");

    // Remove comment markers
    pagetxt = pagetxt.replace(/(<!--|-->)/g, " ");

    // After all the filtering, need to fix up spaces again
    pagetxt = pagetxt.replace(/\s+/gm, " ");

    return pagetxt;
}

function extractPageImg(page, url)
{
    // // look for first top-level heading
    // var idx = page.search(/<h[1-3]/i);

    // // if idx =  -1 (not found)
    // // get first image
    // if(idx == -1)
    //     idx = 0;

    var imgstart = page.indexOf("<img", 0);

    // if no image, screw it
    if(imgstart == -1)
        return "";

    // var imgend = page.indexOf(">", imgstart);

    // // if malformed html, screw it
    // if(imgend == -1)
    //     return "";

    // var imgtag = page.substring(imgstart, imgend + 1);

    // fix src url of image if necessary
    var srcstart = page.indexOf("src", imgstart);

    // malformed img tag
    if(srcstart == -1)
        return "";

    var quote = '"';

    srcstart = page.indexOf(quote, srcstart);

    // maybe its a single quote
    if(srcstart == -1)
    {
        quote = "'";
        srcstart = page.indexOf(quote, srcstart);
    }

    // malformed img tag
    if(srcstart == -1)
        return "";

    var srcend = page.indexOf(quote, srcstart + 1);

    // malformed img tag
    if(srcend == -1)
        return "";

    var src = page.substring(srcstart + 1, srcend);

    if(src.indexOf("://", 0) != -1)
    { // full path
        ;
    }
    else if(src[0] == '/')
    { // path from host url

        if(src[1] == '/')
            src = src.substring(2);
        else
            src = parseUri(url).host + src;
    }
    else
    { // relative path
        src = parseUri(url).host + parseUri(url).directory + src;
    }

    console.debug("extracted image: " + src + ", url: " + url);

    return src;
}

// debug and test function. Not called from core
function getUrlContent(url)
{
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.onreadystatechange = function()
        {
            try {
                if (this.readyState == 4) {

                    console.log("got page. extracting img url");

                    imgurl = extractPageImg(this.responseText, url);

                    this.abort();
                }
            } catch (e) {
                console.error(e.message);
            }
        }

        xhr.send();
    } catch (e) {
        console.error(e.message + bookmark.url);
    }
}

function getAndStoreBookmarkContent(bookmark, storeInDB)
{
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", bookmark.url, true);
        xhr.onreadystatechange = function()
        {
            try {
                if (this.readyState == 4) {

                    var pageNoHtml = removeHTMLfromPage(this.responseText);

                    // add page to database
                    storeInDB(bookmark.id, bookmark.url,
                              bookmark.title, pageNoHtml,
                              bookmark.dateAdded,
                              extractPageImg(this.responseText,
                                             bookmark.url),
                              this.responseText);

                    this.abort();
                }
            } catch (e) {
                console.log(e.message);
                storeInDB(bookmark.id, bookmark.url, bookmark.title,
                          bookmark.dateAdded, "", "", "");
            }
        }

        xhr.send();
    } catch (e) {
        console.log(e.message + bookmark.url);
        storeInDB(bookmark.id, bookmark.url, bookmark.title,
                  bookmark.dateAdded, "", "", "");
    }
}

function initBookmarkDatabase(bookmarks)
{
    bookmarks.forEach(
        function(bookmark)
        {
            if (bookmark.url &&
                bookmark.url.match("^https?://*"))
            { // url exists and is well formed

                console.debug("Adding " + bookmark.url);

                localStorage['totalbookmarks']++;

                getAndStoreBookmarkContent(bookmark,
                                           SearchMarkDB.addBookmarkedPage);
            } else {
                console.debug("Skipping. " + bookmark.url);
            }

            if (bookmark.children)
                initBookmarkDatabase(bookmark.children);
        });
}

function getCallback(cbname, msg, type)
{
    switch (cbname) {
    case "show db":
        if (type == 1)
            return function(tx, r)
        {
            for ( var i = 0; i < r.rows.length; i++) {
                console.log("Stored. " + msg + " " +
                            r.rows.item(i).url);
            }
        }
        else
            return function(tx, r)
        {
            console.debug("failed: " + cbname + " " + msg);
            console.log("  " + e.message);
        }
        break;
    case "search pages":
        if (type == 1) // success callback
            return function(tx, r)
        {
            console.debug("succeded: " + cbname + " " + msg);
        }
        else
            return function(tx, e)
        {
            console.debug("failed: " + cbname + " " + msg);
            console.log("  " + e.message);

            // search pages failed, tell user
            var result = {};

            result.matchType = "DONE";
            result.error = 'Sorry, I am not sure what you are ' +
                'looking for. Could you be missing a quote (") ' +
                'while searching for a phrase?';

            gPort.postMessage(result);
        }
        break;
    case "insert page raw":
        if (type == 1) // success callback
            return function(tx, r)
        {
            console.debug("succeded: " + cbname + " " + msg);
            localStorage['added']++;
        }
        else
            // failure callback
            return function(tx, e)
        {
            console.debug("failed: " + cbname + " " + msg);
            console.log("  " + e.message);
        }
        break;
    case "remove page raw":
        if (type == 1) // success callback
            return function(tx, r)
        {
            console.debug("succeded: " + cbname + " " + msg);
            localStorage['added']--;
        }
        else
            // failure callback
            return function(tx, e)
        {
            console.debug("failed: " + cbname + " " + msg);
            console.log("  " + e.message);
        }
        break;
    default:
        if (type == 1) // success callback
            return function(tx, r)
        {
            console.debug("succeded: " + cbname + " " + msg);
        }
        else
            // failure callback
            return function(tx, e)
        {
            console.debug("failed: " + cbname + " " + msg);
            console.log("  " + e.message);
        }
    }
}