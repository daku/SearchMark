var html = document.getElementsByTagName('html')[0].innerHTML;

// call back to get this indexed
chrome.extension.sendRequest(html);