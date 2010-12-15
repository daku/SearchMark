var smbookmarks = new Array();
var smhistory = new Array();
var count = 0;
var requestCount = 0;
var background = chrome.extension.getBackgroundPage();

$(function(){
	$( "#progressbar" ).progressbar({
		value: 0
	});
	
	// get bookmarks
	chrome.bookmarks.getTree(function(nodes){
		collectBookmarkUrls(nodes);
		
		// get history 
		chrome.history.search({
			text: "",
			maxResults: 10000
		},
		function(nodes){
			collectHistoryUrls(nodes);
			
			// start the indexing process
			index();
		});
	});
	
});

collectBookmarkUrls = function(nodes){
	for(var i = 0 ; i < nodes.length ; i ++){
		var node = nodes[i];
		
		if(node.url != undefined){
			smbookmarks.push({url: node.url, id: node.id});
		}
		
		if(node.children != undefined && node.children.length > 0){
			collectBookmarkUrls(node.children);
		}
	}
}

collectHistoryUrls = function(nodes){
	for(var i = 0 ; i < nodes.length ; i++){
		smhistory.push(nodes[i].url);
	}
}

index = function(){
	log(smbookmarks.length + " bookmarks to index<br />");
	log(smhistory.length + " history urls to index<br />");
	log((smhistory.length + smbookmarks.length) + " total urls to index<br /><br />");
	
	for(var i = 0 ; i < smbookmarks.length ; i++){
		requestCount ++;
		background.indexUrl(smbookmarks[i].url, smbookmarks[i].id, updateState);
	}
	
	for(var i = 0 ; i < smhistory.length ; i++){
		requestCount ++;
		background.indexUrl(smhistory[i], null, updateState);
	}
}

updateState = function(logMessage){
	requestCount --;
	updateProgress();
	
	log(logMessage);
	log('<p>' + requestCount + ' remaining.</p>');
	
	if(requestCount == 0){
		indexComplete();
	}
	
}


indexComplete = function(){
	alert("Indexing is complete!  You can safely close this tab now.");
}

updateProgress = function(){
	count++;
	value = Math.round(100 * (count / (smbookmarks.length + smhistory.length)));
	
	$( "#progressbar" ).progressbar({
		value: value
	});
	
	$("#percent").text(value + "%");
}

log = function(text){
	$("#info").append(text);
	$("#info").attr({ scrollTop: $("#info").attr("scrollHeight") });
}