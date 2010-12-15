var database;

$(function(){
	// get the query string
	var searchString = getUrl().query;
	
	var background = chrome.extension.getBackgroundPage();
	database = background.database;
	
	search(searchString);
});

search = function(searchString){
	
	// show the query
	searchString = unescape(unescape(searchString));
	$("#query").val(searchString);
	
	console.log(searchString);
	
	database.transaction(function(query) {
		query.executeSql("SELECT snippet(history) as snippet, * FROM history WHERE history MATCH ?;", [searchString],
			function(transaction, result){
				showResults(result);
			},
			function(transaction, error){
				console.log(error);
			}
		);
		
	});
}

showResults = function(results){
	// set the number of results found
	var count = results.rows.length;
	if(count == 1){
		$("#count").text(count + " match found.");
	} else {
		$("#count").text(count + " matches found.");		
	}
	
	console.log(results);
	
	for(var i = 0 ; i < results.rows.length ; i++){
		// add a result 
		var record = results.rows.item(i);
		
		var result = "<li>";
		result += "<div class='title'><a href='" + record.url + "'>" + record.title + "</a></div>";
		result += "<div class='snippet'>" + record.snippet + "</div>";
		result += "<div class='url'>" + record.url + "</div>";
		result += "</li>";
		
		$("#results").append(result);
	}
	
}

getUrl = function(){
	var location = window.location.search.substring(1);
	var varVals = location.split("&");
	var result = {};
	
	for(var x = 0 ; x < varVals.length ; x++){
		var varVal = varVals[x].split("=");
		
		result[varVal[0]] = varVal[1].replace("+", " ");
	}
	
	return result;
}
