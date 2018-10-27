// SearchMarkUI.html: SearchMark front-end
//
// Copyright (C) 2010  Candy Yiu, and Akshay Dua
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// About:
// Initialize communication channel between backend and UI.
// No UI code should be added here. Change only if ABSOLUTELY
// necessary.
//

$(document).ready(
    function()
    {
        // Listen for search results from backend
        chrome.extension.onConnect.addListener(function(port) {
            if(port.name != "uiToBackend") {
                console.log("Invalid port name: " + port.name);
                return;
            }

            port.onMessage.addListener(function(result) {
                processSearchResult(result);
            });
        });

        localStorage['uivisits']++;

        /* stop showing tip after 2 UI visits */
        if(localStorage['uivisits'] < 4)
            $('#welcomesearchbox').append(
                '<div id="tiparea"><p><b>Tip:</b> Use the "*". ' +
                    'For example, to search for words beginning ' +
                    'with "mar", simply type "mar*".</div>');

        if(localStorage['uivisits'] == 3)
            $('#tiparea').delay(3000).fadeOut(
                'slow',
                function () {});

        $('#searchbox').focus();
        $('#searchbox').keyup(function(e) {
	        if(e.keyCode == 13) {
		        leavePage('#welcomepage');
	        }
        });
    });

// Send request to backend for displaying a cached bookmark page
function requestCachedPage(id) {
    chrome.extension.sendRequest(
        {method: 'cached', bookmarkid: id},
        function() {});
}

var resultspagename = '#resultspage';

var results_page_top_html =
    '<div id="topsearch">' +
    '<table><tr>' +
    '<th id = "thlogo"><img src="images/logotext-results.png"/></th>' +
    '<!-- search box -->' +
    '<th id = "thsearchbox"><input type="text" id="searchbox" class="searchbox"/>' +
    '<!-- search button -->' +
    '<button type="button" id="searchbutton" class="searchbutton">Search</button></th>' +
    '</tr></table>' +
    '</div>';

// Take keywords from text box and send to
// backend for searching.
function doSearch(searchwords) {

    $('body').append('<div id = "resultspage"></div>');
    $('#resultspage').append(results_page_top_html);
    $('#resultspage').append(
    '<div id="resultspagebtm"></div>');
    $('#resultspage #searchbutton').click(function(){
        leavePage(resultspagename);
    });

    chrome.extension.sendRequest(
        {method: 'search', keywords: searchwords},
        function() {});
}

function leavePage(pagename)
{
    var searchwords = $('#searchbox').val();
    $(pagename).remove();
    $('body').css('cursor', 'wait');
    doSearch(searchwords);
}

// Each search result will be delivered here.
// result object has fields,
//   result.url: page URL
//   result.text: formatted page text, or URL
//   result.title: page title
//   result.matchType: 'title', 'url', or 'page'
//     If the title matched, then result.text will be
//     empty. if URL matched, then result.text will be
//     a formatted URL (keyword is in bold face), if
//     page text matched, then result.text will contain
//     textual context.
function processSearchResult(result) {
    if(result.matchType == "DONE") {
        $('body').css('cursor', 'auto');
        // search error?
        if(result.error) {
            resultString = result.error;
        } else {
            resultString = "&nbsp;";
        }

        $('#searchbox').focus();
        $('#searchbox').keyup(function(e) {
	        if(e.keyCode == 13) {
		        leavePage('#resultspage');
	        }
        });

    } else {

    if(result.img == "")
    result.img = '<img src="" alt="No Image Available" ' +
    'width=400 />';
    else
    result.img = '<img src="' + result.img +
    '" width=400 />';

        resultString =
            '<a href="' + result.url + '" target="_blank">' + result.title +'</a>' +
            '<br/>' + result.text + '<br/>' +
            '<span class="resulturl">' + result.url + '</span>&nbsp;' +
            '<a href="#" class="resultactions">(Offline Version)</a><br/>' + result.img + '<p><br/>';
    }

    $('#resultspagebtm').append(resultString);
    $('#resultspagebtm .resultactions').click(function(){
        requestCachedPage(result.id);
    });
}

$('#searchbutton').click(function(){
    leavePage('#welcomepage');
});